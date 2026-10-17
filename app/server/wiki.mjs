/*
 * The world wiki (content/wiki/*.md) and the player's own screens, as tools for Haiku's answers to
 * agent.chat queries. Pages are cut down to what the player could know by the current day before
 * Haiku sees them (see content/wiki/README.md for the rules): later pages, later sections, sentences
 * about later days or models not out yet, planned and legacy material, writer notes and file paths.
 * The player's mail, Y timeline, Yowl reviews and so on come from the browser with each query (the
 * game state lives there), already limited to what the player's screens show.
 */
import { readFileSync, readdirSync } from 'node:fs';

// agent-N goes live on these days (config.ts AGENT_ROLLOUT), so naming it before then is a spoiler.
const MODEL_DAY = { 2: 4, 3: 9, 4: 14, 5: 18 };
const MAX_PAGE = 3500;
const MAX_SEARCH = 5;
const MAX_SITE = 3000;
const STOP = new Set('the and for with what who whom whose where when which that this from about does did into your you are was were his her its their have has had how why any some tell more info information know there is are can could would should my me i a an of to in on at it be do say said'.split(' '));

/** One page: frontmatter fields, then its sections ({ heading, text }); the first has no heading. */
export function parsePage(md, file = '') {
  const page = { file, title: file.replace(/\.md$/, ''), aliases: [], category: 'world', from: 1, sections: [] };
  let body = md;
  const fm = md.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    body = md.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      const v = m[2].trim();
      if (m[1] === 'title') page.title = v.replace(/^["']|["']$/g, '');
      else if (m[1] === 'aliases') page.aliases = v.replace(/^\[|\]$/g, '').split(',').map((a) => a.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      else if (m[1] === 'category') page.category = v;
      else if (m[1] === 'from') page.from = Number(v) || 1;
    }
  }
  let cur = { heading: '', text: [] };
  for (const line of body.split('\n')) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) {
      page.sections.push(cur);
      cur = { heading: h[1].trim(), text: [] };
      continue;
    }
    cur.text.push(line);
  }
  page.sections.push(cur);
  page.sections = page.sections.map((s) => ({ heading: s.heading, text: s.text.join('\n').trim() })).filter((s) => s.heading || s.text);
  return page;
}

let cached = null;
export function loadWiki(dir = new URL('../content/wiki/', import.meta.url)) {
  try {
    const pages = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')
      .map((f) => parsePage(readFileSync(new URL(f, dir), 'utf8'), f));
    return pages;
  } catch (e) {
    console.warn('[jev-proxy] wiki not readable:', e.message);
    return [];
  }
}
function wiki() {
  if (!cached) cached = loadWiki();
  return cached;
}

/** The latest day a sentence talks about (a range counts from its start), or 0 if it names none. */
export function latestDay(s) {
  let latest = 0;
  const seen = (d) => { if (d > latest) latest = d; };
  const rest = s.replace(/\bdays?\s+(\d+)\s*(?:to|-|–|through)\s*(?:day\s+)?\d+/gi, (_, a) => { seen(+a); return ''; });
  for (const m of rest.matchAll(/\bdays?\s+(\d+)((?:\s*(?:,|and|or|\/)\s*\d+)*)/gi)) {
    seen(+m[1]);
    for (const n of (m[2] || '').match(/\d+/g) ?? []) seen(+n);
  }
  for (const m of rest.matchAll(/\bOct(?:ober)?\s+(\d+)/gi)) seen(+m[1] - 2);
  for (const m of rest.matchAll(/\bagent-([2-5])\b/gi)) seen(MODEL_DAY[m[1]]);
  return latest;
}

function clean(s) {
  return s
    .replace(/\[known\]/gi, '')
    .replace(/\[if\s+!?[a-z0-9_]+\]/gi, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[(canon|PR #?\d+|PR pending)[^\]]*\]/gi, '')
    .replace(/`[^`]*(\/|\.(ts|json|js|mjs|md)\b)[^`]*`/g, '')
    .replace(/`/g, '')
    .replace(/\*\*|\*/g, '')
    .replace(/\(\s*[,;]?\s*\)/g, '')
    .replace(/[ \t]+([,.;])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// a sentence ends at . ! or ? and a space, except after a common abbreviation ("14 Alder St. is")
const SENTENCE = /(?<=(?<!\b(?:St|Ave|Rd|Mr|Mrs|Ms|Dr|vs|e\.g|i\.e|No|approx))[.!?])\s+(?=\S)|\s+\|\s+/;
const HIDDEN_TAG = /\[(planned|open|legacy|to decide)\b/i;
const BRANCH = /\[if\s+(!?)([a-z0-9_]+)\]/gi;

/**
 * Where the player is: the day, the clock (minutes since midnight; unknown counts as end of day for
 * past days only), and the story flags they've set. Flags never reach Haiku; they only pick which
 * branch of a conditional sentence exists.
 */
export function context(day = 1, min, flags = []) {
  return { day: Math.min(21, Math.max(1, Math.floor(Number(day)) || 1)), min: Number.isFinite(min) ? min : null, flags: new Set(Array.isArray(flags) ? flags.map(String) : []) };
}
const asCtx = (c) => (typeof c === 'object' && c ? c : context(c));

/** The latest clock time a sentence names (HH:MM, 24h), in minutes, or -1. */
function latestTime(s) {
  let t = -1;
  for (const m of s.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:to|-|–)\s*\d)/g)) t = Math.max(t, +m[1] * 60 + +m[2]);
  return t;
}

/** Whether a sentence's [if flag] tags hold for this player. */
function branchHolds(p, ctx) {
  for (const m of p.matchAll(BRANCH)) if (ctx.flags.has(m[2]) === (m[1] === '!')) return false;
  return true;
}

/**
 * Whether one sentence is something the player could know now. `today` is set on the current day's
 * own page, where a beat counts only once its time has passed (an untimed beat waits for tomorrow).
 */
function knowable(p, ctx, today) {
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

/** One block (paragraph, bullet, table row) with its unknowable sentences cut. */
function visibleBlock(block, ctx, today) {
  const t = block.trim();
  if (!t) return '';
  // a bullet or row tagged planned/legacy is that all the way through
  if (/^([-*]|\d+\.|\|)?\s*\**\[(planned|open|legacy)/i.test(t)) return '';
  if (/^\|[\s|:-]+\|$/.test(t)) return '';
  const lead = t.match(/^([-*]|\d+\.)\s+/)?.[0] ?? '';
  const row = t.startsWith('|');
  // a bullet with a branch tag up front is that branch all the way through
  if (!branchHolds((t.slice(lead.length).match(/^\s*(\[if\s+!?[a-z0-9_]+\]\s*)+/i) ?? [''])[0], ctx)) return '';
  const inner = row ? t.slice(1, -1).split('|').map((c) => c.trim()).filter(Boolean).join(' | ') : t.slice(lead.length);
  // a bullet on a day page that opens with its time keeps that time for every sentence in it
  const at = !row && inner.match(/^\s*((?:[01]?\d|2[0-3]):[0-5]\d)\b/)?.[1];
  const parts = inner.split(SENTENCE);
  const kept = parts.filter((p) => knowable(at && !p.includes(at) ? `${at} ${p}` : p, ctx, today));
  const out = clean(kept.join(row ? ' | ' : ' ').replace(BRANCH, ''));
  return out ? `${lead ? '- ' : ''}${out}` : '';
}

/** A page as the player could know it now (a day number or a context), or '' if they couldn't know of it yet. */
export function visiblePage(page, c) {
  const ctx = asCtx(c);
  if (page.category === 'writers' || page.from > ctx.day) return '';
  const today = page.category === 'days' && page.from === ctx.day;
  const out = [];
  for (const sec of page.sections) {
    if (/^writer notes/i.test(sec.heading) || HIDDEN_TAG.test(sec.heading)) continue;
    const gate = sec.heading.match(/^from day (\d+)/i);
    if (gate && +gate[1] > ctx.day) continue;
    const branch = sec.heading.match(/^if\s+(!?)([a-z0-9_]+)\s*$/i);
    if (branch && ctx.flags.has(branch[2]) === (branch[1] === '!')) continue;
    // a heading naming a later day ("Day 10: the launch") goes with what it heads
    if (!gate && !branch && latestDay(sec.heading) > ctx.day) continue;
    const blocks = sec.text.split(/\n(?=\s*(?:[-*]|\d+\.|\|)\s)|\n\s*\n/);
    const text = blocks.map((b) => visibleBlock(b.replace(/\n/g, ' '), ctx, today)).filter(Boolean).join('\n');
    if (!text) continue;
    const head = gate || branch ? '' : clean(sec.heading);
    out.push(head ? `${head}\n${text}` : text);
  }
  return out.join('\n\n').trim();
}

function terms(query) {
  return [...new Set(String(query).toLowerCase().match(/[a-z0-9$@][a-z0-9_.$'@-]*/g) ?? [])]
    .map((t) => t.replace(/^[@$]/, '').replace(/['.]+$/, '').replace(/'s$/, ''))
    .filter((t) => t.length >= 2 && !STOP.has(t));
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stem = (t) => (t.length > 4 ? t.replace(/(es|s)$/, '') : t);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The page the name points at: its title, an alias or its file name, ignoring case and punctuation. */
export function findPage(name, pages = wiki()) {
  const n = norm(String(name).replace(/\.md$/, ''));
  if (!n) return undefined;
  return pages.find((p) => norm(p.title) === n || p.aliases.some((a) => norm(a) === n) || norm(p.file.replace(/\.md$/, '')) === n);
}

/** The pages that match `query` best, with the sentence that matched, for the model to pick from. */
export function searchWiki(query, day = 1, pages = wiki()) {
  const ctx = asCtx(day);
  const ts = terms(query);
  if (!ts.length) return 'Nothing found. Search with a name or a word or two.';
  const scored = [];
  for (const p of pages) {
    const text = visiblePage(p, ctx);
    if (!text) continue;
    const names = norm([p.title, ...p.aliases].join(' '));
    const body = text.toLowerCase();
    let score = 0;
    let hits = 0;
    for (const t of ts) {
      const re = new RegExp(`\\b${escRe(stem(t))}`, 'g');
      const inBody = (body.match(re) ?? []).length;
      const inName = re.test(names) ? 1 : 0;
      if (inBody || inName) hits++;
      score += Math.min(inBody, 4) + inName * 6;
    }
    if (!score) continue;
    // the line that matches most terms, as a preview
    const line = text.split('\n').map((l) => ({ l, n: ts.filter((t) => new RegExp(`\\b${escRe(stem(t))}`, 'i').test(l)).length }))
      .sort((a, b) => b.n - a.n)[0]?.l ?? '';
    scored.push({ score: score + hits * 5, title: p.title, line: line.length > 240 ? `${line.slice(0, 240).replace(/\s+\S*$/, '')}…` : line });
  }
  if (!scored.length) return 'Nothing found about that.';
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_SEARCH).map((s) => `[${s.title}] ${s.line}`).join('\n');
}

/** A whole page as the player could know it, or a line saying there is none. */
export function readPage(name, day = 1, pages = wiki()) {
  const p = findPage(name, pages);
  const text = p && visiblePage(p, asCtx(day));
  if (!text) return `No page called "${String(name).slice(0, 60)}". Search first.`;
  const body = text.length > MAX_PAGE ? `${text.slice(0, MAX_PAGE).replace(/\s+\S*$/, '')}…` : text;
  return `# ${p.title}\n${body}`;
}

// ── the player's screens (sent by the browser with each query) ──

export const SITES = ['qmail', 'y', 'yowl', 'citypulse', 'forkyard', 'coinbin'];

const when = (x) => `day ${x.day}${x.time ? ` ${x.time}` : ''}`;
const cut = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t; };

/** What one of the player's sites shows, newest first, optionally only entries matching `search`. */
export function readSite(view, site, search = '') {
  if (!view || typeof view !== 'object') return 'That site could not be read right now.';
  const ts = terms(search);
  const match = (s) => !ts.length || ts.some((t) => new RegExp(`\\b${escRe(stem(t))}`, 'i').test(s));
  const list = (rows, fmt, empty) => {
    const lines = (Array.isArray(rows) ? rows : []).map(fmt).filter(match);
    if (!lines.length) return ts.length ? `Nothing on ${site} matches "${search}".` : empty;
    let out = '';
    for (const l of lines) {
      if (out.length + l.length > MAX_SITE) { out += '(older entries cut)'; break; }
      out += `${l}\n`;
    }
    return out.trim();
  };
  switch (site) {
    case 'qmail': return list(view.mail, (m) => m.folder === 'sent'
      ? `[${when(m)}] SENT to ${cut(m.to, 60)}, "${cut(m.subject, 80)}": ${cut(m.body, 400)}`
      : `[${when(m)}] FROM ${cut(m.from, 60)} <${cut(m.addr, 60)}>, "${cut(m.subject, 80)}"${m.unread ? ' (unread)' : ''}: ${cut(m.body, 500)}`, 'The inbox is empty.');
    case 'y': return list(view.y, (p) => `[${when(p)}] ${p.mine ? 'THE PLAYER' : cut(p.author, 40)} @${cut(p.handle, 30)}: ${cut(p.text, 300)}`, 'Nothing on Y yet.');
    case 'yowl': return list(view.yowl, (r) => `${cut(r.business, 60)}: ${r.stars}★ by ${r.mine ? 'THE PLAYER' : cut(r.author, 40)}${r.day ? ` (day ${r.day})` : ''}: ${cut(r.text, 300)}`, 'No reviews.');
    case 'citypulse': return list(view.citypulse, (a) => `[${when(a)}] ${cut(a.title, 140)}. ${cut(a.dek, 240)}`, 'No articles up yet.');
    case 'forkyard': return list(view.apps, (a) => `${cut(a.name, 60)} (${cut(a.url, 80)}): ${a.deployed ? 'live' : 'not deployed yet'}${a.client ? `, built for ${cut(a.client, 40)}` : ''}${a.users != null ? `, ${a.users} users` : ''}`, 'The player has no repos on Forkyard yet.');
    case 'coinbin': {
      const w = view.wallet ?? {};
      const head = `Balance ${w.dolr ?? '?'} DOLR. Y followers ${w.followers ?? '?'}. Model agent-${w.model ?? '?'}.${w.rent ? ` Rent of ${w.rent.amount} DOLR is due on day ${w.rent.day}.` : ''}`;
      const tx = list(view.tx, (t) => `[${when(t)}] ${t.amount > 0 ? '+' : ''}${t.amount} DOLR, ${cut(t.memo, 80)}`, 'No transactions.');
      return `${head}\nRecent transactions:\n${tx}`;
    }
    default: return `No site called "${String(site).slice(0, 30)}". Sites: ${SITES.join(', ')}.`;
  }
}

/** The tools Haiku gets for a query. The player never sees them: only the final text goes back. */
export const QUERY_TOOLS = [
  {
    name: 'search_wiki',
    description: 'Search the wiki about this world: people, companies, places, websites, apps, prices, rules, and what happened on each day so far (pages "Day 1", "Day 2" …). Returns the best matching page titles with a matching line. Search with a name or one or two keywords.',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'A name or one or two keywords, e.g. "Gino" or "rent".' } }, required: ['query'] },
  },
  {
    name: 'read_wiki_page',
    description: 'Read one wiki page in full, by its title (from search_wiki) or a name.',
    input_schema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'check_site',
    description: "Read what the player's own screens show right now: qmail (their inbox and sent mail), y (the Y timeline so far, the player's own posts included), yowl (business reviews, the player's included), citypulse (news articles up so far), forkyard (the player's apps and whether they're live), coinbin (balance, followers, rent, recent transactions). Optionally only entries matching a search.",
    input_schema: {
      type: 'object',
      properties: { site: { type: 'string', enum: SITES }, search: { type: 'string', description: 'Optional: a name or keyword to filter by.' } },
      required: ['site'],
    },
  },
];

/** Runs one tool call; `ctx` is where the player is (see context()). */
export function runQueryTool(name, input, ctx, view) {
  if (name === 'search_wiki') return searchWiki(String(input?.query ?? '').slice(0, 80), ctx);
  if (name === 'read_wiki_page') return readPage(String(input?.title ?? '').slice(0, 80), ctx);
  if (name === 'check_site') return readSite(view, String(input?.site ?? ''), String(input?.search ?? '').slice(0, 80));
  return `Unknown tool ${name}.`;
}
