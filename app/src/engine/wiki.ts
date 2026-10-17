/*
 * The world wiki (content/wiki/*.md): parsing, and what each paragraph is to the player right now.
 * Every paragraph carries a tag: public (agent answers with it), hint (agent may only point the way)
 * or classified (agent won't answer). A tag can be a rule that changes with the day and the story
 * flags ("[classified; hint from day 5; public if seed_stolen]"). On top of that, anything the player
 * can't know yet is classified whatever its tag: a later page, a section gated to a later day or
 * another branch, a sentence about a later day (or later today), a model not out yet, planned and
 * legacy material. Writer notes are never part of an answer. See content/wiki/README.md.
 *
 * Self-contained (no imports): the wiki.dev editor (ui/wiki.ts) uses it as well as queries.
 */

export type WikiTag = 'public' | 'hint' | 'classified';
export type WikiCategory = 'people' | 'family' | 'companies' | 'sites' | 'apps' | 'world' | 'days' | 'writers';

export interface WikiBlock {
  /** The block as written, tag and all. */
  raw: string;
  /** The tag rule as written ("classified; public if seed_stolen"), or '' if untagged. */
  rule: string;
  /** The text without its tag or bullet. */
  text: string;
  bullet: boolean;
  /** A table row: `text` holds its cells joined with " | ". */
  row?: boolean;
}
export interface WikiSection {
  /** '' for the page's opening paragraphs (its overview). */
  heading: string;
  /** "From day N" gate on the heading, if any. */
  fromDay?: number;
  /** "If flag" / "If !flag" gate on the heading, if any. */
  ifFlag?: { flag: string; not: boolean };
  /** Writer notes: never shown to the model, never part of an answer. */
  writer: boolean;
  blocks: WikiBlock[];
}
export interface WikiPage {
  file: string;
  title: string;
  aliases: string[];
  category: WikiCategory;
  from: number;
  /** A page of many things (ad brands, local businesses): a question can name one of its sections without naming the page. */
  hub?: boolean;
  /** What the page is about, in a line, for Jev to match questions against (default: its first sentence). */
  summary?: string;
  sections: WikiSection[];
}

/**
 * Where the player is: the day, the clock (minutes since midnight), their story flags and meters, and
 * what has reached them so far (`seen`: ids of arrived emails and Y posts, `article:<slug>` for
 * CityPulse; see engine/query.ts seenIds).
 */
export interface WikiCtx { day: number; min: number | null; flags: Set<string>; meters: Record<string, number>; seen: Map<string, string> }
/** `seen` maps each arrived item to its text, for embeds; a plain list of ids is fine when only rules need it. */
export function wikiCtx(day: number, min?: number | null, flags: Iterable<string> = [], meters: Record<string, number> = {}, seen: Iterable<string> | Map<string, string> = []): WikiCtx {
  const items = seen instanceof Map ? seen : new Map([...seen].map((id) => [seenRef(id), '']));
  return { day: Math.min(21, Math.max(1, Math.floor(day) || 1)), min: Number.isFinite(min) ? (min as number) : null, flags: new Set(flags), meters: { ...meters, day: Math.floor(day) || 1 }, seen: items };
}

/** A `seen` reference as stored: mail:, y: and event: are only labels for an event id; article: stays. */
export const seenRef = (ref: string): string => ref.trim().replace(/^(mail|email|y|post|event|yowl|review):/i, '');

// agent-N goes live on these days (config AGENT_ROLLOUT), so naming it before then is a spoiler.
const MODEL_DAY: Record<string, number> = { 2: 4, 3: 9, 4: 14, 5: 18 };
const TAG = /^\[(public|hint|classified)((?:\s*;[^\]]*)?)\]\s*/i;
const HIDDEN_TAG = /\[(planned|open|legacy|to decide)\b/i;
/** An embedded email, post or article: `{{mail:d1_gino_site}}`, `{{y:m1_gai_escape}}`, `{{article:keller-clip}}`. */
export const EMBED = /\{\{\s*((?:mail|email|y|post|event|yowl|review|article):[a-z0-9_:.@-]+)\s*\}\}/gi;
const BRANCH = /\[if\s+(!?)([a-z0-9_]+)\]/gi;
// a sentence ends at . ! or ? and a space, except after a common abbreviation ("14 Alder St. is")
const SENTENCE = /(?<=(?<!\b(?:St|Ave|Rd|Mr|Mrs|Ms|Dr|vs|e\.g|i\.e|No|approx))[.!?])\s+(?=\S)|\s+\|\s+/;

function parseBlock(raw: string): WikiBlock {
  const t = raw.trim();
  const lead = t.match(/^([-*]|\d+\.)\s+/)?.[0] ?? '';
  let rest = t.slice(lead.length);
  let rule = '';
  if (rest.startsWith('|')) {
    // a table row: the tag sits in its first cell
    const cells = rest.slice(1, -1).split('|').map((c) => c.trim());
    const m = cells[0]?.match(TAG);
    if (m) { rule = m[1].toLowerCase() + m[2]; cells[0] = cells[0].slice(m[0].length); }
    return { raw: t, rule: rule.replace(/\s+/g, ' ').trim(), text: cells.filter(Boolean).join(' | '), bullet: false, row: true };
  } else {
    const m = rest.match(TAG);
    if (m) { rule = m[1].toLowerCase() + m[2]; rest = rest.slice(m[0].length); }
  }
  return { raw: t, rule: rule.replace(/\s+/g, ' ').trim(), text: rest.trim(), bullet: !!lead };
}

/** One page from its markdown. */
export function parseWikiPage(md: string, file = ''): WikiPage {
  const page: WikiPage = { file, title: file.replace(/\.md$/, ''), aliases: [], category: 'world', from: 1, sections: [] };
  let body = md.replace(/\r\n/g, '\n');
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = body.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      const v = m[2].trim();
      if (m[1] === 'title') page.title = v.replace(/^["']|["']$/g, '');
      else if (m[1] === 'aliases') page.aliases = v.replace(/^\[|\]$/g, '').split(',').map((a) => a.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else if (m[1] === 'category') page.category = v as WikiCategory;
      else if (m[1] === 'from') page.from = Number(v) || 1;
      else if (m[1] === 'hub') page.hub = v === 'true';
      else if (m[1] === 'summary') page.summary = v;
    }
  }
  const raw: { heading: string; lines: string[] }[] = [{ heading: '', lines: [] }];
  for (const line of body.split('\n')) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    // the page's own "# Title" line is not a section
    if (h && /^#\s/.test(line) && raw.length === 1 && !raw[0].lines.join('').trim()) continue;
    if (h) raw.push({ heading: h[1].trim(), lines: [] });
    else raw[raw.length - 1].lines.push(line);
  }
  for (const r of raw) {
    const text = r.lines.join('\n').trim();
    if (!r.heading && !text) continue;
    const gate = r.heading.match(/^from day (\d+)\s*[:.–-]?\s*(.*)$/i);
    const iff = r.heading.match(/^if\s+(!?)([a-z0-9_]+)\s*[:.–-]?\s*(.*)$/i);
    // a table's header row (the line above its |---| rule) is layout, not a paragraph
    const lines = text.split('\n');
    const body = lines.filter((l, i) => !(l.trim().startsWith('|') && /^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1] ?? ''))).join('\n');
    const blocks = body.split(/\n(?=\s*(?:[-*]|\d+\.|\|)\s)|\n\s*\n/)
      .map((b) => b.replace(/\n/g, ' ').trim())
      .filter((b) => b && !/^\|[\s|:-]+\|$/.test(b))
      .map(parseBlock);
    page.sections.push({
      heading: gate ? gate[2] || r.heading : iff ? iff[3] || r.heading : r.heading,
      ...(gate ? { fromDay: +gate[1] } : {}),
      ...(iff ? { ifFlag: { flag: iff[2], not: iff[1] === '!' } } : {}),
      writer: /^writer notes/i.test(r.heading),
      blocks,
    });
  }
  return page;
}

/** The latest day a sentence talks about (a range counts from its start), or 0 if it names none. */
export function latestDay(s: string): number {
  let latest = 0;
  const seen = (d: number) => { if (d > latest) latest = d; };
  const rest = s.replace(/\bdays?\s+(\d+)\s*(?:to|-|–|through)\s*(?:day\s+)?\d+/gi, (_, a) => { seen(+a); return ''; });
  for (const m of rest.matchAll(/\bdays?\s+(\d+)((?:\s*(?:,|and|or|\/)\s*\d+)*)/gi)) {
    seen(+m[1]);
    for (const n of (m[2] || '').match(/\d+/g) ?? []) seen(+n);
  }
  for (const m of rest.matchAll(/\bOct(?:ober)?\s+(\d+)/gi)) seen(+m[1] - 2);
  for (const m of rest.matchAll(/\bagent-([2-5])\b/gi)) seen(MODEL_DAY[m[1]]);
  return latest;
}

/** The latest clock time a sentence names (HH:MM, 24h), in minutes, or -1. Ranges ("17:00 to 22:00") are hours, not beats. */
function latestTime(s: string): number {
  let t = -1;
  const rest = s.replace(/\b\d{1,2}:\d{2}\s*(?:to|-|–)\s*\d{1,2}:\d{2}\b/g, '');
  for (const m of rest.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)) t = Math.max(t, +m[1] * 60 + +m[2]);
  return t;
}

function branchHolds(p: string, ctx: WikiCtx): boolean {
  for (const m of p.matchAll(BRANCH)) if (ctx.flags.has(m[2]) === (m[1] === '!')) return false;
  return true;
}

/** Whether one sentence is something the player could know now. On today's own day page an untimed beat waits for tomorrow. */
function knowable(p: string, ctx: WikiCtx, today: boolean): boolean {
  if (HIDDEN_TAG.test(p) || !branchHolds(p, ctx)) return false;
  if (/\[known\]/i.test(p)) return true;
  const d = latestDay(p);
  if (d > ctx.day) return false;
  if (today || d === ctx.day) {
    const t = latestTime(p);
    if (t < 0) return !today;
    if (ctx.min == null || t > ctx.min) return false;
  }
  return true;
}

/** Tidies a block for the model: no tags, links, code paths or markdown. */
export function cleanWikiText(s: string): string {
  return s
    .replace(/\[known\]/gi, '')
    .replace(BRANCH, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a)
    .replace(/\[(canon|PR #?\d+|PR pending)[^\]]*\]/gi, '')
    .replace(/`[^`]*(\/|\.(ts|json|js|mjs|md)\b)[^`]*`/g, '')
    .replace(/`/g, '')
    .replace(/\*\*|\*/g, '')
    .replace(/\(\s*[,;]?\s*\)/g, '')
    .replace(/[ \t]+([,.;])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * One step of a tag rule: switch to `tag` from a day on, while a flag is (or isn't) set, or while a
 * meter compares to a number ("public if suspicion >= 40").
 */
export type TagStep =
  | { tag: WikiTag; kind: 'day'; day: number }
  | { tag: WikiTag; kind: 'flag'; flag: string; not: boolean }
  | { tag: WikiTag; kind: 'meter'; meter: string; op: '>=' | '<=' | '>' | '<' | '='; value: number }
  /** Once an email, Y post, Yowl review or article has reached the player ("public if seen d5_coffee_removal"). */
  | { tag: WikiTag; kind: 'seen'; ref: string };
export interface TagRule { base: WikiTag; steps: TagStep[] }

const TAGS = new Set(['public', 'hint', 'classified']);
/** Reads a rule as written ("classified; hint from day 5; public if seed_stolen; public if suspicion >= 40"). Unknown steps are dropped. */
export function parseTagRule(rule: string): TagRule {
  const [base, ...rest] = rule.split(';').map((r) => r.trim().replace(/^(public|hint|classified)\b/i, (t) => t.toLowerCase()));
  // flags are lowercase; meters keep their camelCase names (familyTrust)
  const steps: TagStep[] = [];
  for (const r of rest) {
    const day = r.match(/^(public|hint|classified)\s+from\s+day\s+(\d+)$/i);
    if (day) { steps.push({ tag: day[1].toLowerCase() as WikiTag, kind: 'day', day: +day[2] }); continue; }
    const seen = r.match(/^(public|hint|classified)\s+if\s+seen\s+([a-z0-9_:.@-]+)$/i);
    if (seen) { steps.push({ tag: seen[1].toLowerCase() as WikiTag, kind: 'seen', ref: seenRef(seen[2]) }); continue; }
    const meter = r.match(/^(public|hint|classified)\s+if\s+([a-z][a-z0-9_]*)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/i);
    if (meter) { steps.push({ tag: meter[1].toLowerCase() as WikiTag, kind: 'meter', meter: meter[2], op: meter[3] as '>=', value: +meter[4] }); continue; }
    const flag = r.match(/^(public|hint|classified)\s+if\s+(!?)([a-z0-9_]+)$/i);
    if (flag) steps.push({ tag: flag[1].toLowerCase() as WikiTag, kind: 'flag', flag: flag[3].toLowerCase(), not: flag[2] === '!' });
  }
  return { base: TAGS.has(base) ? base as WikiTag : 'classified', steps };
}
/** Writes a rule back the way parseTagRule reads it. */
export function formatTagRule(r: TagRule): string {
  return [r.base, ...r.steps.map((x) => x.kind === 'day' ? `${x.tag} from day ${x.day}` : x.kind === 'flag' ? `${x.tag} if ${x.not ? '!' : ''}${x.flag}` : x.kind === 'seen' ? `${x.tag} if seen ${x.ref}` : `${x.tag} if ${x.meter} ${x.op} ${x.value}`)].join('; ');
}
function stepHolds(x: TagStep, ctx: WikiCtx): boolean {
  if (x.kind === 'day') return ctx.day >= x.day;
  if (x.kind === 'flag') return ctx.flags.has(x.flag) !== x.not;
  if (x.kind === 'seen') return ctx.seen.has(x.ref);
  const v = ctx.meters[x.meter];
  if (v == null) return false;
  return x.op === '>=' ? v >= x.value : x.op === '<=' ? v <= x.value : x.op === '>' ? v > x.value : x.op === '<' ? v < x.value : v === x.value;
}

/** A tag rule's value now: the base tag, then each step that holds, the last winning. Untagged is classified. */
export function evalTag(rule: string, ctx: WikiCtx): WikiTag {
  const r = parseTagRule(rule);
  let tag = rule ? r.base : 'classified';
  for (const x of r.steps) if (stepHolds(x, ctx)) tag = x.tag;
  return tag;
}

/** One block as the player stands now: its tag and the text they may be told ('' when nothing is). */
export interface WikiPara { tag: WikiTag; text: string }
export function blockNow(b: WikiBlock, sec: WikiSection, page: WikiPage, ctx: WikiCtx): WikiPara {
  const shut = { tag: 'classified' as const, text: '' };
  if (sec.writer || page.category === 'writers' || page.from > ctx.day) return shut;
  if (sec.fromDay && sec.fromDay > ctx.day) return shut;
  if (sec.ifFlag && ctx.flags.has(sec.ifFlag.flag) === sec.ifFlag.not) return shut;
  if (!sec.fromDay && !sec.ifFlag && latestDay(sec.heading) > ctx.day) return shut;
  if (/^\**\[(planned|open|legacy)/i.test(b.text)) return shut;
  // a block with branch tags up front is that branch all the way through
  if (!branchHolds((b.text.match(/^\s*(\[if\s+!?[a-z0-9_]+\]\s*)+/i) ?? [''])[0], ctx)) return shut;
  const tag = evalTag(b.rule, ctx);
  if (tag === 'classified') return shut;
  const today = page.category === 'days' && page.from === ctx.day;
  // a beat that opens with its time keeps that time for every sentence in it
  const at = b.text.match(/^\s*((?:[01]?\d|2[0-3]):[0-5]\d)\b/)?.[1];
  // embeds stand in as tokens while sentences are judged, then become the item's text if it has arrived
  const refs: string[] = [];
  const raw = b.text.replace(EMBED, (_, r) => `\u0001${refs.push(seenRef(r)) - 1}\u0001`);
  const kept = raw.split(SENTENCE).filter((p) => knowable(at && !p.includes(at) ? `${at} ${p}` : p, ctx, today));
  const text = cleanWikiText(kept.join(' ').replace(/\u0001(\d+)\u0001/g, (_, i) => {
    const item = ctx.seen.get(refs[+i]);
    return item ? `[${item}]` : '';
  }));
  return text ? { tag, text } : shut;
}

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/**
 * The rules a paragraph follows besides its tag rule, in words: the page's and section's day and
 * branch, [planned] text, branch tags, and sentences that wait for the day or time they name. These
 * are automatic (the spoiler filter in blockNow), so the editor lists them next to the tag rule.
 */
export function blockGates(b: WikiBlock, sec: WikiSection, page: WikiPage): string[] {
  const out: string[] = [];
  if (sec.writer || page.category === 'writers') return ['writer note: never shown'];
  if (page.from > 1) out.push(`whole page: classified before day ${page.from} (the page is known from day ${page.from})`);
  if (sec.fromDay && sec.fromDay > page.from) out.push(`whole section: classified before day ${sec.fromDay} (heading "From day ${sec.fromDay}")`);
  if (sec.ifFlag) out.push(`whole section: classified ${sec.ifFlag.not ? 'once' : 'unless'} ${sec.ifFlag.flag} is set (heading "If ${sec.ifFlag.not ? '!' : ''}${sec.ifFlag.flag}")`);
  const hd = !sec.fromDay && !sec.ifFlag ? latestDay(sec.heading) : 0;
  if (hd > page.from) out.push(`whole section: classified before day ${hd} (its heading names day ${hd})`);
  if (/^\**\[(planned|open|legacy)/i.test(b.text)) out.push('marked planned/open/legacy: always classified');
  const lead = (b.text.match(/^\s*(\[if\s+!?[a-z0-9_]+\]\s*)+/i) ?? [''])[0];
  for (const m of lead.matchAll(BRANCH)) out.push(`whole paragraph: classified ${m[1] ? 'once' : 'unless'} ${m[2]} is set (branch tag [if ${m[1]}${m[2]}])`);
  const today = page.category === 'days';
  const at = b.text.match(/^\s*((?:[01]?\d|2[0-3]):[0-5]\d)\b/)?.[1];
  const raw = b.text.replace(EMBED, '').slice(lead.length);
  const parts = raw.split(SENTENCE);
  for (const s0 of parts) {
    const s = at && !s0.includes(at) ? `${at} ${s0}` : s0;
    const short = `"${cleanWikiText(s0).slice(0, 48)}${cleanWikiText(s0).length > 48 ? '…' : ''}"`;
    const where = parts.length > 1 ? `the sentence ${short}` : 'the text';
    if (HIDDEN_TAG.test(s) && !/^\**\[(planned|open|legacy)/i.test(b.text)) out.push(`${where}: always hidden (planned/open/legacy)`);
    for (const m of s.matchAll(BRANCH)) if (!lead.includes(m[0])) out.push(`${where}: hidden ${m[1] ? 'once' : 'unless'} ${m[2]} is set`);
    if (/\[known\]/i.test(s)) continue;
    const d = latestDay(s);
    if (d > Math.max(page.from, sec.fromDay ?? 0, hd)) out.push(`${where}: hidden before day ${d} (it names day ${d}; add [known] to show it earlier)`);
    const tm = latestTime(s);
    if (today && tm >= 0) out.push(`${where}: hidden on day ${page.from} until ${hhmm(tm)}`);
    else if (today && !at) out.push(`${where}: no time, so hidden until day ${page.from + 1}`);
  }
  return [...new Set(out)];
}

/** Why a paragraph with a public or hint rule is still classified now, in words (undefined if it isn't). */
export function blockWhy(b: WikiBlock, sec: WikiSection, page: WikiPage, ctx: WikiCtx): string | undefined {
  if (page.from > ctx.day) return `the page is known from day ${page.from}`;
  if (sec.fromDay && sec.fromDay > ctx.day) return `the section starts on day ${sec.fromDay}`;
  if (sec.ifFlag && ctx.flags.has(sec.ifFlag.flag) === sec.ifFlag.not) return `the section needs ${sec.ifFlag.not ? '!' : ''}${sec.ifFlag.flag}`;
  if (!sec.fromDay && !sec.ifFlag && latestDay(sec.heading) > ctx.day) return `the heading names day ${latestDay(sec.heading)}`;
  if (/^\**\[(planned|open|legacy)/i.test(b.text)) return 'it is marked planned/open/legacy';
  const lead = (b.text.match(/^\s*(\[if\s+!?[a-z0-9_]+\]\s*)+/i) ?? [''])[0];
  for (const m of lead.matchAll(BRANCH)) if (ctx.flags.has(m[2]) === (m[1] === '!')) return `it needs ${m[1]}${m[2]}`;
  return 'every sentence waits for a later day or time, or a branch';
}

/** What a section holds for the player now, split by tag. Empty lists mean it's all classified. */
export function sectionNow(page: WikiPage, sec: WikiSection, ctx: WikiCtx): { public: string[]; hint: string[] } {
  const out = { public: [] as string[], hint: [] as string[] };
  for (const b of sec.blocks) {
    const p = blockNow(b, sec, page, ctx);
    if (p.tag !== 'classified') out[p.tag].push(p.text);
  }
  return out;
}

/** Pages a query can be about: ones the player could know of by now. */
export function queryablePages(pages: WikiPage[], ctx: WikiCtx): WikiPage[] {
  return pages.filter((p) => p.category !== 'writers' && p.from <= ctx.day);
}

/** A section's name for matching: its heading, or "Overview" for the opening paragraphs. */
export const sectionName = (s: WikiSection): string => s.heading || 'Overview';

/** Sections a query can name (writer notes aside). Gated ones are included: asking about them gets a classified answer. */
export function querySections(page: WikiPage): WikiSection[] {
  return page.sections.filter((s) => !s.writer && s.blocks.length);
}

/** A block back as markdown, with its tag rule. */
export function formatBlock(b: Pick<WikiBlock, 'rule' | 'text' | 'bullet' | 'row'>): string {
  const tag = b.rule ? `[${b.rule}] ` : '';
  if (b.row) {
    const cells = b.text.split(/\s+\|\s+/);
    return `| ${tag}${cells.join(' | ')} |`;
  }
  return `${b.bullet ? '- ' : ''}${tag}${b.text}`;
}

/** A whole page back as markdown (what the wiki editor saves). */
export function formatWikiPage(p: WikiPage): string {
  const fm = ['---', `title: ${p.title}`, ...(p.aliases.length ? [`aliases: ${p.aliases.join(', ')}`] : []), `category: ${p.category}`, `from: ${p.from}`, ...(p.hub ? ['hub: true'] : []), ...(p.summary ? [`summary: ${p.summary}`] : []), '---', ''];
  const out: string[] = [];
  for (const sec of p.sections) {
    const head = sec.writer ? 'Writer notes'
      : sec.fromDay ? `From day ${sec.fromDay}${sec.heading && !/^from day/i.test(sec.heading) ? `: ${sec.heading}` : ''}`
      : sec.ifFlag ? `If ${sec.ifFlag.not ? '!' : ''}${sec.ifFlag.flag}${sec.heading && !/^if\s/i.test(sec.heading) ? `: ${sec.heading}` : ''}`
      : sec.heading;
    const lines: string[] = [];
    sec.blocks.forEach((b, i) => {
      const prev = sec.blocks[i - 1];
      // bullets and rows run on line by line; anything else is its own paragraph
      if (i && !((b.bullet && prev.bullet) || (b.row && prev.row))) lines.push('');
      if (b.row && !prev?.row) {
        const n = b.text.split(/\s+\|\s+/).length;
        lines.push(`| ${Array(n).fill(' ').join(' | ')} |`, `|${Array(n).fill('---').join('|')}|`);
      }
      lines.push(formatBlock(b));
    });
    if (head) out.push(`## ${head}`, '');
    out.push(...lines, '');
  }
  return `${fm.join('\n')}\n${out.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
