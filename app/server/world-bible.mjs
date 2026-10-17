/*
 * World bible lookup for Haiku's off-script replies. content/world-bible.md is copied from the
 * project's shared world bible (/mnt/project-files/world/world-bible.md); keep the two in sync.
 *
 * The doc is cut into small pieces (a paragraph, a bullet, a table row), each labelled with its
 * heading. Before a search, everything the player shouldn't learn yet is cut out sentence by
 * sentence: anything about a later day, a model not released yet, planned or legacy material,
 * and the writer-only sections (tone rules, endings, placeholders). File paths, flags and status
 * tags are stripped, since a character has no use for them.
 */
import { readFileSync } from 'node:fs';

// Writer guidance or endgame material, never lore a character should look up.
const SKIP_SECTIONS = [/^2\. tone rules/i, /^endings/i, /^9\. recurring jokes/i, /^10\. open placeholders/i];
// agent-N goes live on these days (config.ts AGENT_LEVELS), so naming it before then is a spoiler.
const MODEL_DAY = { 2: 4, 3: 9, 4: 14, 5: 18 };
const MAX_HITS = 3;
const MAX_PIECE = 700;
const MAX_RESULT = 1800;
const STOP = new Set('the and for with what who whom whose where when which that this from about does did into your you are was were his her its their have has had how why any some tell more info information'.split(' '));

/** Pieces of the doc: { section, text }. */
export function parseBible(md) {
  const pieces = [];
  const path = [];
  let para = [];
  const flush = () => {
    if (para.length) pieces.push({ section: path.filter(Boolean).join(' > '), text: para.join(' ') });
    para = [];
  };
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      path.length = h[1].length;
      path[h[1].length - 1] = h[2].trim();
      continue;
    }
    const t = line.trim();
    if (!t || t === '---' || /^\|[\s|:-]+\|$/.test(t)) { flush(); continue; }
    if (t.startsWith('|')) {
      flush();
      const cells = t.slice(1, -1).split('|').map((c) => c.trim());
      // header rows (Who | Voice | Notes) carry nothing
      if (cells.every((c) => /^[A-Z][a-z' ]{0,14}$/.test(c.replace(/\*/g, '')))) continue;
      pieces.push({ section: path.filter(Boolean).join(' > '), text: cells.filter(Boolean).join(' | '), row: true });
      continue;
    }
    if (/^([-*]|\d+\.)\s/.test(t)) { flush(); para = [t.replace(/^([-*]|\d+\.)\s+/, '')]; continue; }
    para.push(t);
  }
  flush();
  return pieces;
}

let cached = null;
function loadBible() {
  if (!cached) {
    try {
      cached = parseBible(readFileSync(new URL('../content/world-bible.md', import.meta.url), 'utf8'));
    } catch (e) {
      console.warn('[jev-proxy] world bible not readable:', e.message);
      cached = [];
    }
  }
  return cached;
}

/** The latest day a sentence talks about (a range counts from its start), or 0 if it names none. */
function latestDay(s) {
  let latest = 0;
  const seen = (d) => { if (d > latest) latest = d; };
  // a range counts from its start ("days 10 to 12", "day 1 to day 21")
  const rest = s.replace(/\bdays?\s+(\d+)\s*(?:to|-|–|through|and)\s*(?:day\s+)?\d+/gi, (_, a) => { seen(+a); return ''; });
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
    .replace(/\*\*\[[^\]]*\]\*\*|\[(canon|planned|legacy|open|to decide)[^\]]*\]/gi, '')
    .replace(/\*\(placeholder\)\*|\(placeholder\)/gi, '')
    .replace(/`[^`]*(\/|\.(ts|json|js|mjs|md)\b)[^`]*`/g, '')
    .replace(/`/g, '')
    .replace(/\*\*|\*/g, '')
    .replace(/\(\s*[,;][^)]*\)|\(\s*\)/g, '')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** What a character on `day` may know from one piece: later-day, planned and legacy sentences cut. */
export function visibleText(piece, day) {
  // the preamble (sources, status tags) sits under the title alone
  if (!piece.section.includes(' > ')) return '';
  if (SKIP_SECTIONS.some((re) => piece.section.split(' > ').some((h) => re.test(h)))) return '';
  // a heading tagged planned or legacy ("Factions [planned; legacy roots]", "Days 8 to 21 (planned, ...)")
  if (/[[(](planned|legacy)/i.test(piece.section)) return '';
  // a bullet opening with a planned or legacy tag is that all the way through; so is a legacy table row
  if (/^\**\[(planned|legacy)/i.test(piece.text) || (piece.row && /\|\s*(legacy|planned)\b[^|]*$/i.test(piece.text))) return '';
  // timeline rows start with their day: "3 (Thu Oct 5) | ..."
  const rowDay = piece.row && piece.text.match(/^(\d+)\s*\(/);
  if (rowDay && +rowDay[1] > day) return '';
  const parts = piece.text.split(/\s*\|\s*|(?<=[.!?;])\s+(?=["'(*A-Z0-9])/);
  const kept = parts.filter((p, i) => {
    if (/\[(planned|legacy|to decide|open)\b/i.test(p)) return false;
    // status column of a table row ("canon", "legacy", "canon (ad); ...") is a label, not lore
    if (piece.row && i > 0 && /^(canon|legacy|planned)\b/i.test(p.trim())) return false;
    // notes to writers, not facts
    if (/\b(should|Thomas|Keep (it|that)|Never describe|When writing|Gemma|Day plans|the code|canon|the legacy|legacy (prototype|lore|game|docs?|memo|predecessor))\b/i.test(p.replace(/\[[^\]]*\]/g, ""))) return false;
    return latestDay(p) <= day;
  });
  return clean(kept.join(' '));
}

function terms(query) {
  return [...new Set(String(query).toLowerCase().match(/[a-z0-9$@][a-z0-9_.$'-]*/g) ?? [])]
    .map((t) => t.replace(/^[@$]/, '').replace(/['.]+$/, ''))
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

/** The best few excerpts for `query`, as text for the model, or a line saying there is nothing. */
export function searchBible(query, day = 1, pieces = loadBible()) {
  const ts = terms(query);
  if (!ts.length) return 'Nothing found. Search with a name or a word.';
  const scored = [];
  for (const p of pieces) {
    const text = visibleText(p, day);
    if (!text) continue;
    const head = p.section.toLowerCase();
    const body = text.toLowerCase();
    let score = 0;
    let hit = 0;
    for (const t of ts) {
      const stem = t.length > 4 ? t.replace(/(es|s)$/, '') : t;
      const re = new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\$-]/g, '\\$&')}`, 'g');
      const inBody = (body.match(re) ?? []).length;
      const inHead = re.test(head) ? 1 : 0;
      if (inBody || inHead) hit++;
      score += Math.min(inBody, 3) + inHead * 2;
    }
    // every term found counts more than one term found many times
    if (score) scored.push({ score: score + hit * 4, section: p.section, text });
  }
  if (!scored.length) return 'Nothing found about that.';
  scored.sort((a, b) => b.score - a.score);
  let out = '';
  for (const s of scored.slice(0, MAX_HITS)) {
    // the title is the same for every piece; section numbers mean nothing to the model
    const label = s.section.split(' > ').slice(1).map((h) => h.replace(/^\d+(\.\d+)*\.?\s+/, '')).join(' > ');
    const text = s.text.length > MAX_PIECE ? `${s.text.slice(0, MAX_PIECE).replace(/\s+\S*$/, '')}…` : s.text;
    const entry = `[${clean(label)}] ${text}\n`;
    if (out.length + entry.length > MAX_RESULT) break;
    out += entry;
  }
  return out.trim();
}

/** The tool Haiku gets. The player never sees it: only the final text reply goes back. */
export const LOOKUP_TOOL = {
  name: 'look_up',
  description:
    'Look up facts about this world: people, companies, places, websites, products and what has happened so far. ' +
    'Use it only when the player mentions something you would know about but your profile does not cover. ' +
    'Most replies need no lookup. Search with a name or one or two keywords, not a sentence.',
  input_schema: {
    type: 'object',
    properties: { query: { type: 'string', description: 'A name or one or two keywords, e.g. "Halden Logistics" or "Gino menu".' } },
    required: ['query'],
  },
};
