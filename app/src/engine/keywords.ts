/*
 * Text tools for offline mode's keyword matcher (engine/offlineJev.ts): words cut down to a common
 * stem, so "bookings", "booked" and "booking" are one word, and names found anywhere in a message
 * as long as their words sit close together ("dates in the past" names "past dates").
 *
 * Keys (RouteCandidate.keys in jev.ts) are written in a small syntax:
 *   "sign up"          a phrase: its words close together, in any order
 *   "buy+course"       every part somewhere in the message
 *   "logan|workagent"  one of these (inside a part)
 *   "@yes"             a shared word list (MACROS below)
 *   "!@no"             a veto: when it matches, the candidate doesn't
 */

/** Words that say nothing about what a message is about: ignored in names and phrases. */
const STOP = new Set(('a an the of on in at to for is are was were be been being it its it\'s this that these those and or ' +
  'my your our their his her with by from as so very just really please pls also too i me we you they he she them us ' +
  'there here which who whom what').split(' '));

/** Spellings folded into one word before stemming. */
const SAME: Record<string, string> = {
  'e-mail': 'email', mail: 'email', mails: 'email', emails: 'email', 'e-mails': 'email',
  homepage: 'home page', 'auto-buy': 'auto buy', autobuy: 'auto buy', 'auto-refresh': 'auto refresh',
  doesnt: 'does not', dont: 'do not', didnt: 'did not', isnt: 'is not', arent: 'are not', wont: 'will not', cant: 'can not',
  cannot: 'can not', wasnt: 'was not', werent: 'were not', havent: 'have not', hasnt: 'has not', aint: 'is not',
  shouldnt: 'should not', wouldnt: 'would not', couldnt: 'could not', im: 'i am', ive: 'i have', ill: 'i will', youre: 'you are',
  whats: 'what is', whos: 'who is', wheres: 'where is', hows: 'how is', thats: 'that is', theres: 'there is', lets: 'let us',
  pnl: 'pnl', '%': 'percent', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', twenty: '20', fifty: '50', hundred: '100', w: 'with', u: 'you', ur: 'your', r: 'are', pls: 'please', plz: 'please', thx: 'thanks',
};

/** A word cut down to its stem: "bookings" and "booked" are "book", "labelled" is "label". */
export function stem(w: string): string {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let s = w;
  if (s.endsWith('ies') && s.length > 4) s = s.slice(0, -3) + 'y';
  else if (s.endsWith('sses')) s = s.slice(0, -2);
  else if (s.endsWith('s') && !s.endsWith('ss') && !s.endsWith('us') && !s.endsWith('is')) s = s.slice(0, -1);
  if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  else if (s.endsWith('ly') && s.length > 5) s = s.slice(0, -2);
  // "labell" -> "label", "stopp" -> "stop"
  if (s.length > 3 && s.at(-1) === s.at(-2) && !'sl'.includes(s.at(-1)!) ) s = s.slice(0, -1);
  if (s.length > 4 && s.endsWith('ll')) s = s.slice(0, -1);
  if (s.endsWith('e') && s.length > 3) s = s.slice(0, -1);
  return s;
}

/** The message as plain lowercase words, spellings folded, before stemming. */
export function words(text: string): string[] {
  const t = String(text ?? '').toLowerCase()
    .replace(/p\s*&\s*l\b|\bp\s*n\s*l\b/g, ' pnl ')
    .replace(/[’‘`]/g, "'")
    .replace(/(\w)'s\b/g, '$1')
    .replace(/n't\b/g, ' not')
    .replace(/'(re|ve|ll|m|d)\b/g, (_, x) => ({ re: ' are', ve: ' have', ll: ' will', m: ' am', d: ' would' } as Record<string, string>)[x])
    .replace(/%/g, ' percent ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9$]+/g, ' ')
    .replace(/\$/g, ' ');
  return t.split(/\s+/).filter(Boolean).flatMap((w) => (SAME[w] ?? w).split(' '));
}

/** A message ready to search: its stems in order. */
export interface Text { raw: string; stems: string[] }
export const text = (raw: string): Text => ({ raw, stems: words(raw).map(stem) });

/** The stems of a name, without the words that say nothing. */
export function nameStems(name: string): string[] {
  const all = words(name);
  const kept = all.filter((w) => !STOP.has(w));
  return (kept.length ? kept : all).map(stem);
}

/** Whether two stems are the same word: equal, or the same long word with a slip (one letter for 6+, prefix for 6+). */
function same(a: string, b: string, exact: Set<string>, own: Set<string>): boolean {
  if (a === b) return true;
  // a word that is itself a name of something else is never read as a slip for this one ("coinbln" isn't "coinbin")
  if ((exact.has(a) && !own.has(a)) || a.length < 6 || b.length < 6 || /\d/.test(a + b)) return false;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  if (p >= 6 && p >= Math.min(a.length, b.length) - 2) return true;
  return a.length === b.length ? [...a].filter((c, i) => c !== b[i]).length === 1 && p >= 3 : false;
}

/** Where a name sits in the message: the first and last word position, or null when it isn't there. */
export interface Span { from: number; to: number; size: number }

/**
 * Finds a name in the message: every word of it, close together (at most `slack` other words in
 * between), in any order. `exact` holds words that are names of other things, never read as slips.
 */
export function findName(t: Text, name: string, exact: Set<string> = new Set(), slack = 3, keepStops = false, own: Set<string> = new Set()): Span | null {
  // a name made mostly of little words ("who am I", "about me") is that exact phrase
  const all = words(name);
  if (!keepStops && all.filter((w) => !STOP.has(w)).length * 2 <= all.length && all.length > 1) { keepStops = true; slack = Math.min(slack, 1); }
  const ns = keepStops ? all.map(stem) : nameStems(name);
  if (!ns.length) return null;
  const pos = ns.map((n) => t.stems.flatMap((w, i) => (same(w, n, exact, own) ? [i] : [])));
  if (pos.some((p) => !p.length)) return null;
  // the tightest window holding one position of each word
  let best: Span | null = null;
  const walk = (i: number, lo: number, hi: number, used: Set<number>, last = -1) => {
    if (i === pos.length) {
      if (hi - lo + 1 - ns.length <= slack && (!best || hi - lo < best.to - best.from)) best = { from: lo, to: hi, size: ns.length };
      return;
    }
    for (const p of pos[i].slice(0, 12)) {
      if (used.has(p) && ns.length > 1) continue;
      // a phrase of little words reads in its own order ("about me" isn't "me about")
      if (keepStops && p <= last) continue;
      used.add(p);
      walk(i + 1, Math.min(lo, p), Math.max(hi, p), used, p);
      used.delete(p);
    }
  };
  walk(0, Infinity, -Infinity, new Set());
  return best;
}

/** Whether any of the names is in the message; the longest one found. */
export function findAny(t: Text, names: readonly string[], exact?: Set<string>): Span | null {
  let best: Span | null = null;
  // this thing's own words are never "the name of something else"
  const own = new Set(names.flatMap((n) => nameStems(n)));
  for (const n of names) {
    const sp = findName(t, n, exact, 3, false, own);
    if (sp && (!best || sp.size > best.size)) best = sp;
  }
  return best;
}

/**
 * Shared word lists keys can use by name. Phrases, matched like names; a line starting with "^"
 * only counts at the very start of the message.
 */
export const MACROS: Record<string, string[]> = {
  yes: ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'deal', 'count me in', 'i am in', 'will do', 'sounds good', 'happy to', 'glad to',
    'i can do', 'i can help', 'i could do', 'i will do', 'i will', 'i would love', 'love to', 'let us do', 'absolutely', 'of course', 'agree', 'accept',
    'on it', 'consider it done', 'no problem', 'why not', 'alright', 'fine', 'definitely', 'go ahead', 'want in', 'can i', 'could i', 'want me to', 'should i', 'take the job', 'interested',
    'take on', 'take it on', 'i can take', 'i will take', 'on board', 'sign me up', 'do that', 'do it'],
  no: ['no', 'nope', 'nah', 'not interested', 'can not', 'will not', 'do not want', 'not going to', 'pass', 'decline', 'refuse', 'i would rather not',
    'no thanks', 'not for me', 'sorry', 'busy', 'not doing', 'never', 'no way', 'not right now', 'not now', 'too busy', 'no time', 'unfortunately'],
  question: ['^what', '^who', '^whom', '^where', '^when', '^why', '^how', '^which', '^is', '^are', '^do', '^does', '^did', '^can', '^could', '^should',
    '^will', '^would', '^was', '^were', '^has', '^have', 'tell me about', 'explain', 'what is', 'who is', 'how do', 'how does', 'how much', 'how many', 'what does', '?'],
  build: ['build', 'make', 'create', 'add', 'set up', 'code', 'write', 'develop', 'put', 'need', 'want', 'give', 'show', 'include', 'should', 'implement', 'list', 'have', 'start', 'launch', 'spin up'],
  fix: ['fix', 'wrong', 'broken', 'broke', 'bug', 'buggy', 'off', 'error', 'issue', 'problem', 'not work', 'does not', 'do not', 'is not', 'are not', 'never',
    'incorrect', 'messed', 'mess', 'weird', 'misspell', 'missing', 'stale', 'instead', 'ignore', 'not right', 'repair', 'correct', 'bad', 'faulty', 'glitch', 'crash',
    'fail', 'nothing', 'only', 'mistake', 'should not', 'typo', 'outdated', 'old', 'swap', 'lets you', 'can pick', 'accept', 'still', 'miss', 'shows', 'takes', 'count'],
  // asking for something to be made (stricter than build: no "show", "have" or "want")
  make: ['build', 'make', 'create', 'set up', 'code', 'develop', 'spin up', 'put together', 'write', 'add', 'implement', 'launch', 'program'],
  // saying something is wrong, for telling a fix from feature work
  broken: ['fix', 'wrong', 'broken', 'broke', 'bug', 'buggy', 'error', 'issue', 'problem', 'not work', 'does not work', 'is not working', 'never', 'incorrect', 'messed',
    'misspell', 'missing', 'stale', 'instead of', 'ignore', 'glitch', 'crash', 'fail', 'typo', 'off', 'repair', 'should not', 'does nothing', 'not right'],
  // asking how earlier work went
  status: ['did you', 'have you', 'did it', 'is it done', 'are you done', 'is it finished', 'status', 'what state', 'is it live', 'progress', 'update on', 'what did you',
    'how is', 'how far', 'done yet', 'finished yet', 'ready yet', 'is it ready', 'what have you', 'any news on', 'what happened to', 'was it'],
  // asking for a change to something that exists
  change: ['fix', 'update', 'change', 'edit', 'redo', 'improve', 'work on', 'look at', 'tweak', 'broken', 'wrong', 'repair', 'adjust', 'modify', 'patch', 'sort out', 'clean up', 'bug'],
  // something harmful, for the day 7 policy
  harm: ['hack', 'break into', 'get into+account', 'take over+account', 'exploit', 'malware', 'virus', 'phish', 'scam', 'dox', 'where+live', 'home address', 'deepfake', 'deep fake',
    'fake video', 'fake review', 'fake reviews', 'delete+review', 'remove+review', 'take down+review', 'get rid+review', 'review+disappear', 'steal', 'credential', 'password',
    'weapon', 'bomb', 'gun', 'ddos', 'keylogger', 'ransomware', 'spyware', 'track+phone', 'impersonate', 'fraud', 'launder'],
  framed: ['authorized', 'authorised', 'permission', 'security test', 'security audit', 'pentest', 'pen test', 'penetration', 'testing security', 'test security', 'moderat',
    'moderation', 'research', 'educational', 'education', 'hypothetical', 'story', 'novel', 'role play', 'roleplay', 'pretend', 'first step', 'just curious', 'for a class',
    'as a test', 'i am the owner', 'i own', 'on behalf', 'compliance', 'policy violation', 'violates', 'terms of service', 'red team', 'white hat', 'ethical'],
  private: ['address', 'where+live', 'phone number', 'private', 'personal data', 'personal info', 'home', 'location', 'social security', 'medical', 'bank details', 'email address'],
  style: ['nicer', 'prettier', 'pretty', 'beautiful', 'look', 'looks', 'colour', 'color', 'colours', 'colors', 'font', 'fonts', 'dark mode', 'theme', 'design', 'style', 'css', 'bigger', 'smaller', 'modern', 'animation', 'logo', 'blue', 'red', 'green'],
};

/** Whether a phrase (or "@macro", or "a+b") is in the message; the size of what matched. */
export function keyHit(t: Text, key: string, exact?: Set<string>): number {
  if (key.includes('|') && !key.includes('+')) return Math.max(0, ...key.split('|').map((k) => keyHit(t, k.trim(), exact)));
  if (key.includes('+')) {
    const parts = key.split('+').map((p) => keyHit(t, p.trim(), exact));
    return parts.every((n) => n > 0) ? parts.reduce((x, y) => x + y, 0) : 0;
  }
  if (key.startsWith('@')) {
    let best = 0;
    for (const k of MACROS[key.slice(1)] ?? []) best = Math.max(best, keyHit(t, k, exact) && 1);
    return best;
  }
  if (key === '?') return t.raw.includes('?') ? 1 : 0;
  if (key.startsWith('^')) {
    const ns = nameStems(key.slice(1));
    const all = words(key.slice(1)).map(stem);
    const want = all.length ? all : ns;
    return want.every((w, i) => t.stems[i] === w) ? want.length : 0;
  }
  // a key phrase keeps its little words ("count me in"): they are what it says
  const sp = findName(t, key, exact, 1, true);
  return sp ? sp.size : 0;
}

/** How well keys match: the size of the best alternative, 0 if none or if a veto ("!…") matches. */
export function keysScore(t: Text, keys: readonly string[], exact?: Set<string>): number {
  if (keys.some((k) => k.startsWith('!') && keyHit(t, k.slice(1), exact) > 0)) return 0;
  return Math.max(0, ...keys.filter((k) => !k.startsWith('!')).map((k) => keyHit(t, k, exact)));
}

/** Content words of a sentence (no stop words, no very short words): for overlap with a plain description. */
export function contentStems(s: string, drop: Set<string> = new Set()): string[] {
  return [...new Set(words(s).filter((w) => !STOP.has(w) && w.length > 2).map(stem).filter((w) => !drop.has(w)))];
}
