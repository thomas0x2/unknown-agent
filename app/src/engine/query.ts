/*
 * agent.chat queries: a question about the world, answered from the wiki (engine/wiki.ts). Jev
 * matches the question down the wiki's tree the way a fix matches an app's components, but looser:
 * first which page it is about (a person, a company, a site, a day), then which section of it. A
 * question that names no page is not precise enough: a miss, and the player gets roasted. A page
 * named without a section counts as asking about its overview.
 *
 * What the matched sections hold right now decides the answer: public paragraphs Haiku may tell,
 * hint paragraphs it may only point toward, and if nothing is either (all classified, or not known
 * yet), a scripted classified roast.
 */
import type { GameState } from './state';
import type { Content } from '../content/schema';
import type { JevRouter } from './jev';
import { wikiCtx, queryablePages, querySections, sectionNow, sectionName, cleanWikiText, EMBED, type WikiPage, type WikiSection, type WikiCtx } from './wiki';
import { eventBody, posted, postMin } from './events';
import { marketPosts } from './crawler';
import { liveArticles } from './citypulse';

/** More pages than this matched: the question is too broad to be about anything. */
const MAX_PAGES = 3;
/**
 * Which of several matched pages a question is mainly about: Jev's confidence has to reach
 * MAIN_BAR (the proxy's bar for 'main' questions), or, when no page does, come within MAIN_CLOSE of
 * the best one, if that is at least MAIN_FLOOR. Tuned on content/query-tests.json.
 */
const MAIN_BAR = 0.8;
const MAIN_CLOSE = 0.1;
const MAIN_FLOOR = 0.4;

export type QueryMatch =
  | { kind: 'miss'; debug: string }
  /** It matched too many pages to be about one: a near-miss that asks which (`options`: some of their titles). */
  | { kind: 'broad'; options: string[]; debug: string }
  | { kind: 'classified'; where: string[]; debug: string }
  | { kind: 'answer'; where: string[]; public: string[]; hint: string[]; debug: string };

export function queryCtx(s: GameState, content: Content): WikiCtx {
  return wikiCtx(s.values.day, s.clockMin, s.flags, s.values, seenItems(s, content));
}

const plain = (t: string) => String(t ?? '').replace(/\{\{\s*playerName\s*\}\}/g, 'you').replace(/\{\{\s*\w+\s*\}\}/g, '').replace(/\s+/g, ' ').trim();

/**
 * Everything that has reached the player so far, by id, with its text: delivered emails, Y posts and
 * Yowl reviews (event ids), the market and filler posts on Y (their ids) and CityPulse articles
 * (`article:<slug>`). Wiki tag rules wait on these ("public if seen d5_coffee_removal") and embeds
 * (`{{mail:d5_coffee_removal}}`) show their text.
 */
export function seenItems(s: GameState, content: Content): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of s.delivered) {
    const e = content.events.find((x) => x.id === d.eventId);
    if (!e || out.has(e.id)) continue;
    const body = plain(d.body ?? eventBody(e, d.day));
    const from = e.from ?? 'someone';
    out.set(e.id, e.site === 'y' ? `Y post by ${from}: ${body}`
      : e.site === 'yowl' ? `Yowl review by ${from}: ${body}`
      : e.site !== 'qmail' ? `${e.site} post by ${from}: ${body}`
      : `Email from ${from}${e.subject ? `, "${plain(e.subject)}"` : ''}: ${body}`);
  }
  for (const p of marketPosts(s, content)) if (!out.has(p.id)) out.set(p.id, `Y post by ${p.author}: ${plain(p.text)}`);
  for (const f of content.yFiller) if (f.day <= s.values.day && posted(s, f.day, postMin(f, f.day))) out.set(f.id, `Y post by ${f.from}: ${plain(f.body)}`);
  for (const a of liveArticles(s)) out.set(`article:${a.slug}`, `CityPulse article "${a.title}" by ${a.by}: ${a.dek} ${a.body.join(' ')}`);
  return out;
}

/** What a page is about in a line: its `summary`, or the first sentence of its first section. */
function gist(p: WikiPage): string {
  if (p.summary) return p.summary;
  const first = querySections(p)[0]?.blocks[0]?.text ?? '';
  const text = cleanWikiText(first.replace(EMBED, ''));
  return (text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text).slice(0, 220);
}

/** How Jev sees a page: its title, other names, what kind of thing it is and what it's about. */
function pageDesc(p: WikiPage, day: number): string {
  // the player asks about "today" and "yesterday", not day numbers
  const when = p.category === 'days' ? (p.from === day ? ' (today)' : p.from === day - 1 ? ' (yesterday)' : '') : '';
  if (when) return `${p.title}${when}: what has happened ${when.slice(2, -1)} (${p.aliases[0] ?? p.title})`;
  const kind = { people: 'a person', family: "a member of the player's family", companies: 'a company or organisation', sites: 'a website or app', apps: 'an app the player builds', world: 'a topic', days: 'what happened on that day', writers: '' }[p.category] ?? 'a topic';
  const about = gist(p);
  // a summary says what the page is in its own words, kind included
  return `${p.title}${when}${p.aliases.length ? ` (also called ${p.aliases.slice(0, 16).join(', ')})` : ''}: ${p.summary ?? `${kind}${about ? `. ${about}` : ''}`}`;
}

/** How Jev sees one section of a hub page: its heading, and the start of what it says (names in it). */
function hubDesc(p: WikiPage, sec: WikiSection): string {
  const start = sec.blocks.map((b) => cleanWikiText(b.text.replace(EMBED, ''))).join(' ').slice(0, 160).replace(/\s+\S*$/, '');
  return `${sec.heading}, one of the ${p.title.toLowerCase()}${start ? `: ${start}…` : ''}`;
}

/** Jev: which wiki page(s), then which section(s) of each, the question is about. */
export async function matchQuery(jev: JevRouter, s: GameState, content: Content, text: string, chat: string[] = []): Promise<QueryMatch> {
  const ctx = queryCtx(s, content);
  // pages the player can't know of yet are matched too: asking about one is a classified hit, refused
  const pages = (content.wiki ?? []).filter((p) => p.category !== 'writers');
  if (!pages.length) return { kind: 'miss', debug: 'no wiki pages loaded' };
  const known = new Set(queryablePages(pages, ctx));
  // a hub page (ad brands, local businesses) offers each of its sections as a topic of its own, so
  // naming the brand or the business is enough; its page doesn't have to be named too
  const hubs = pages.filter((p) => p.hub).flatMap((p) => querySections(p).map((sec, i) => ({ p, sec, i })).filter((x) => x.sec.heading));
  const found = await jev.matchFeatures({
    prompt: text, context: chat,
    features: [
      ...pages.map((p) => ({ id: p.file, description: pageDesc(p, ctx.day), kind: 'topic' as const })),
      ...hubs.map(({ p, sec, i }) => ({ id: `${p.file}#${i}`, description: hubDesc(p, sec), kind: 'topic' as const })),
    ],
  });
  const direct = hubs.filter(({ p, i }) => found.includes(`${p.file}#${i}`));
  // a hub page whose section was named counts once, through that section
  let hit = pages.filter((p) => found.includes(p.file) || direct.some((x) => x.p === p));
  if (!hit.length) return { kind: 'miss', debug: 'Jev: the question names no wiki page, so it is not precise enough (a miss)' };
  // several pages: the ones the question is mainly about (named, or asked what it is) win over pages
  // that only have to do with it ("What's DOLR?" is the Money and DOLR page, not agent's prices)
  let mainNote = '';
  if (hit.length > 1) {
    const ask = { prompt: text, context: chat, features: hit.map((p) => ({ id: p.file, description: pageDesc(p, ctx.day), kind: 'main' as const })) };
    let kept: WikiPage[];
    if (jev.matchScores) {
      // with Jev's confidences: the pages over the bar, or if none is, the ones close to the best
      const sc = await jev.matchScores(ask);
      const best = Math.max(...sc);
      kept = hit.filter((_, i) => sc[i] >= MAIN_BAR);
      if (!kept.length && best >= MAIN_FLOOR) kept = hit.filter((_, i) => sc[i] >= best - MAIN_CLOSE);
    } else {
      const main = await jev.matchFeatures(ask);
      kept = hit.filter((p) => main.includes(p.file));
    }
    if (kept.length && kept.length < hit.length) {
      mainNote = ` (mainly about ${kept.map((p) => p.title).join(', ')}, of ${hit.map((p) => p.title).join(', ')})`;
      hit = kept;
    }
  }
  // something the player can't know of yet is refused, unless the question is also about something
  // they know: then it's answered from that (asking about rent shouldn't be refused over day 7's page)
  const early = hit.filter((p) => !known.has(p));
  if (early.length && early.length < hit.length) {
    mainNote += ` (left out, not known yet: ${early.map((p) => p.title).join(', ')})`;
    hit = hit.filter((p) => known.has(p));
  }
  else if (early.length) return { kind: 'classified', where: early.map((p) => p.title), debug: `Jev: ${early.map((p) => p.title).join('; ')}, not known to the player until day ${Math.min(...early.map((p) => p.from))}, so classified` };
  if (hit.length > MAX_PAGES) return { kind: 'broad', options: hit.slice(0, 4).map((p) => p.title), debug: `Jev: the question matches ${hit.length} wiki pages, too broad (a near-miss)${mainNote}` };

  // sections of every matched page with more than an overview, asked in one go
  const choice = hit.map((p) => ({ p, secs: querySections(p), fixed: direct.filter((x) => x.p === p).map((x) => x.i) }));
  // the overview isn't asked about: it's what a question naming no section gets
  const ask = choice.flatMap(({ p, secs, fixed }) => (secs.length > 1 && !fixed.length ? secs.flatMap((sec, i) => sec.heading ? [{
    id: `${p.file}#${i}`,
    description: `${sectionName(sec)} (about ${p.title})`,
    kind: 'section' as const,
  }] : []) : []));
  const named = ask.length ? await jev.matchFeatures({ prompt: text, context: chat, features: ask }) : [];
  const out = { public: [] as string[], hint: [] as string[] };
  const where: string[] = [];
  for (const { p, secs, fixed } of choice) {
    // no section named: the question is about the page in general, its overview
    let picked = secs.filter((_, i) => fixed.includes(i) || named.includes(`${p.file}#${i}`));
    if (!picked.length) picked = p.category === 'days' ? secs : secs.filter((x) => !x.heading).slice(0, 1).concat(secs.length && secs[0].heading ? [secs[0]] : []);
    for (const sec of picked) {
      const now = sectionNow(p, sec, ctx);
      out.public.push(...now.public);
      out.hint.push(...now.hint);
      where.push(`${p.title} › ${sectionName(sec)}`);
    }
  }
  if (!out.public.length && !out.hint.length) return { kind: 'classified', where, debug: `Jev: ${where.join('; ')}, all classified for now` };
  return { kind: 'answer', where, ...out, debug: `Jev: ${where.join('; ')} (${out.public.length} public, ${out.hint.length} hint)${mainNote}` };
}
