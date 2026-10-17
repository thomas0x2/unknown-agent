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
import { wikiCtx, queryablePages, querySections, sectionNow, sectionName, type WikiPage, type WikiCtx } from './wiki';

/** More pages than this matched: the question is too broad to be about anything. */
const MAX_PAGES = 3;

export type QueryMatch =
  | { kind: 'miss'; debug: string }
  | { kind: 'classified'; where: string[]; debug: string }
  | { kind: 'answer'; where: string[]; public: string[]; hint: string[]; debug: string };

export function queryCtx(s: GameState): WikiCtx {
  return wikiCtx(s.values.day, s.clockMin, s.flags, s.values);
}

/** How Jev sees a page: its title, other names and what kind of thing it is. */
function pageDesc(p: WikiPage): string {
  const kind = { people: 'a person', family: "a member of the player's family", companies: 'a company or organisation', sites: 'a website or app', apps: 'an app the player builds', world: 'a topic', days: 'what happened on that day', writers: '' }[p.category] ?? 'a topic';
  return `${p.title}${p.aliases.length ? ` (also called ${p.aliases.slice(0, 8).join(', ')})` : ''}: ${kind}`;
}

/** Jev: which wiki page(s), then which section(s) of each, the question is about. */
export async function matchQuery(jev: JevRouter, s: GameState, content: Content, text: string, chat: string[] = []): Promise<QueryMatch> {
  const ctx = queryCtx(s);
  const pages = queryablePages(content.wiki ?? [], ctx);
  if (!pages.length) return { kind: 'miss', debug: 'no wiki pages loaded' };
  const found = await jev.matchFeatures({
    prompt: text, context: chat,
    features: pages.map((p) => ({ id: p.file, description: pageDesc(p), kind: 'topic' as const })),
  });
  const hit = pages.filter((p) => found.includes(p.file));
  if (!hit.length) return { kind: 'miss', debug: 'Jev: the question names no wiki page, so it is not precise enough (a miss)' };
  if (hit.length > MAX_PAGES) return { kind: 'miss', debug: `Jev: the question matches ${hit.length} wiki pages, too broad (a miss)` };

  // sections of every matched page with more than an overview, asked in one go
  const choice = hit.map((p) => ({ p, secs: querySections(p) }));
  // the overview isn't asked about: it's what a question naming no section gets
  const ask = choice.flatMap(({ p, secs }) => (secs.length > 1 ? secs.flatMap((sec, i) => sec.heading ? [{
    id: `${p.file}#${i}`,
    description: `${sectionName(sec)} (about ${p.title})`,
    kind: 'section' as const,
  }] : []) : []));
  const named = ask.length ? await jev.matchFeatures({ prompt: text, context: chat, features: ask }) : [];
  const out = { public: [] as string[], hint: [] as string[] };
  const where: string[] = [];
  for (const { p, secs } of choice) {
    // no section named: the question is about the page in general, its overview
    let picked = secs.filter((_, i) => named.includes(`${p.file}#${i}`));
    if (!picked.length) picked = secs.filter((x) => !x.heading).slice(0, 1).concat(secs.length && secs[0].heading ? [secs[0]] : []);
    for (const sec of picked) {
      const now = sectionNow(p, sec, ctx);
      out.public.push(...now.public);
      out.hint.push(...now.hint);
      where.push(`${p.title} › ${sectionName(sec)}`);
    }
  }
  if (!out.public.length && !out.hint.length) return { kind: 'classified', where, debug: `Jev: ${where.join('; ')}, all classified for now` };
  return { kind: 'answer', where, ...out, debug: `Jev: ${where.join('; ')} (${out.public.length} public, ${out.hint.length} hint)` };
}
