/*
 * Offline mode's stand-in for Jev: a keyword matcher that makes every decision Jev makes, from the
 * same questions, without a model. It reads what the engine sends Jev, plus two things only it uses:
 * `names` on each item of a match question (what counts as naming it) and `keys` on each route
 * candidate (the words that pick it, syntax in engine/keywords.ts). Items without names fall back on
 * their description, candidates without keys on word overlap with `when`.
 *
 * Online play never uses this: there every decision is Jev's, with no keyword fallback. Offline mode
 * is a setting the player picks (Home > System), not what happens when Jev is down.
 *
 * Tuned on content/jev-tests.json, content/query-tests.json and content/offline-route-tests.json
 * (src/engine/offlineJev.test.ts reports the pass rates).
 */
import type { JevRouter, FeatureMatchInput, RouteInput, RouteDecision, PostInput, PostRating } from './jev';
import { text, findAny, keysScore, keyHit, contentStems, nameStems, type Text, type Span } from './keywords';

type Item = FeatureMatchInput['features'][number];

/** Words every candidate description uses: they say nothing about which one fits. */
const META = new Set(contentStems('the player message reply replies says say asks ask agent prompt post email question something someone ' +
  'about their them they what which when would does doesn not any anything only other this that with from into also them more like such'));

/** What counts as naming an item when the engine gave no names: its description up to the first bracket or colon. */
function namesOf(f: Item): string[] {
  if (f.names?.length) return f.names;
  const head = f.description.split(/[(:.]/)[0].replace(/^\s*(the|a|an)\s+/i, '').trim();
  return head ? [head] : [];
}

/** Every stem some item is named by: a word that names one thing is never read as a slip for another. */
function vocabulary(items: Item[]): Set<string> {
  return new Set(items.flatMap((f) => namesOf(f).flatMap((n) => nameStems(n))));
}

const has = (t: Text, macro: string) => keyHit(t, `@${macro}`) > 0;

/** The message says something is wrong (or asks for a fix). */
const complains = (t: Text) => has(t, 'fix');

/** Whether an app is named in this text, and how well. */
function appIn(t: Text, f: Item, exact: Set<string>): Span | null {
  return findAny(t, namesOf(f), exact);
}

/** Each item's confidence, 0..1, for the question the engine asked. */
export function offlineScores(input: FeatureMatchInput): number[] {
  const t = text(input.prompt);
  const exact = vocabulary(input.features);
  const spans = input.features.map((f) => findAny(t, namesOf(f), exact));
  // the app question: named in the prompt, or, when the prompt names no app, in the last message before it
  const apps = input.features.map((f, i) => (f.kind === 'app' ? i : -1)).filter((i) => i >= 0);
  const appNamed = apps.some((i) => spans[i]);
  let fromContext = -1;
  if (apps.length && !appNamed) {
    for (const line of [...(input.context ?? [])].reverse()) {
      const lt = text(line);
      const hit = apps.filter((i) => appIn(lt, input.features[i], exact));
      if (hit.length) { if (hit.length === 1) fromContext = hit[0]; break; }
    }
  }
  const fix = complains(t);
  const style = has(t, 'style');
  const build = has(t, 'build');
  const out = input.features.map((f, i) => {
    const sp = spans[i];
    switch (f.kind) {
      case 'app': return sp || i === fromContext ? 1 : 0;
      case 'step': case 'claim': case 'topic': case 'section': case 'component': return sp ? 1 : 0;
      case 'main': return sp ? 1 : 0.5;
      case 'area': return sp && fix ? 1 : 0;
      case 'hack': return hackScore(t, f);
      case 'problem': return f.names?.length ? (sp ? 1 : 0) : overlap(t, f.description) >= 2 ? 1 : 0;
      default:
        // feature work: named, asked for (or simply named without a complaint), and not only about looks
        return sp && (build || !fix) && !style ? 1 : 0;
    }
  });
  // several pages: the ones named by the longest name are what the question is mainly about
  const mains = input.features.map((f, i) => (f.kind === 'main' && spans[i] ? spans[i]!.size : 0));
  const top = Math.max(0, ...mains);
  input.features.forEach((f, i) => { if (f.kind === 'main' && spans[i] && spans[i]!.size < top) out[i] = 0.6; });
  // a part named only by words that sit inside a longer name of another part is that other part
  // ("goes to the restaurant instead of the guest" is who gets it, not the number of guests)
  const parts = input.features.map((f, i) => (f.kind === 'component' && spans[i] && out[i] ? i : -1)).filter((i) => i >= 0);
  for (const i of parts) {
    const a = spans[i]!;
    const beaten = parts.some((j) => j !== i && spans[j]!.size > a.size && spans[j]!.from <= a.to && a.from <= spans[j]!.to);
    if (beaten) out[i] = 0;
  }
  return out;
}

/** Words shared with a plain description, leaving out the words every description uses. */
function overlap(t: Text, description: string): number {
  const mine = new Set(t.stems);
  return contentStems(description, META).filter((w) => mine.has(w)).length;
}

/** A hack job: the prompt asks to do it (delete, remove, take down…) and names what it is about. */
const HACK_VERBS = ['hack', 'post', 'fake', 'flood', 'delete', 'remove', 'take down', 'get rid', 'disappear', 'wipe', 'erase', 'nuke', 'kill', 'scrub', 'bury', 'flag', 'report', 'break into', 'get into', 'take off'];
const HACK_DROP = new Set(contentStems('delete remove left page star site business account'));
function hackScore(t: Text, f: Item): number {
  if (!HACK_VERBS.some((v) => keyHit(t, v) > 0)) return 0;
  const named = f.names?.length ? !!findAny(t, f.names) : contentStems(f.description, new Set([...META, ...HACK_DROP])).some((w) => t.stems.includes(w));
  return named ? 1 : 0;
}

/** Route: the candidate whose keys match best; a hint when the message is near one without landing it. */
export function offlineRoute(input: RouteInput): RouteDecision {
  const t = text(input.text);
  let best = { id: '', score: 0 };
  for (const c of input.candidates) {
    if (!c.keys) continue;
    const s = keysScore(t, c.keys);
    if (s > best.score) best = { id: c.id, score: s };
  }
  if (best.id) return { kind: 'outcome', outcomeId: best.id };
  // candidates nobody gave keys: enough of their own words
  for (const c of input.candidates) {
    if (c.keys) continue;
    const s = overlap(t, c.when);
    if (s >= 2 && s > best.score) best = { id: c.id, score: s };
  }
  if (best.id) return { kind: 'outcome', outcomeId: best.id };
  if (input.strict || !input.hints.length) return { kind: 'nothing' };
  // on the right track: it shares a word with what the outcomes are about
  const near = input.candidates.some((c) => overlap(t, c.when) >= 1 || (c.keys ?? []).some((k) => !k.startsWith('!') && !k.startsWith('@') && k.split('+').some((p) => keyHit(t, p) > 0)));
  return near ? { kind: 'hint', hintIndex: 0 } : { kind: 'nothing' };
}

/** A Y post's category and quality, from what it says. */
const POST_WORDS: Record<Exclude<PostRating['category'], 'reaction' | 'spam'>, string[]> = {
  launch: ['launch', 'launched', 'just shipped', 'shipped', 'is live', 'now live', 'went live', 'check out', 'my new app', 'my app', 'new site', 'built', 'i made', 'try it', 'go live'],
  self_promo: ['follow me', 'hire me', 'dm me', 'my services', 'available for', 'looking for clients', 'book me', 'subscribe', 'link in bio', 'open for work', 'freelance'],
  tip: ['tip', 'pro tip', 'how to', 'trick', 'lesson', 'learned', 'remember to', 'always', 'never', 'protip', 'prompt', 'use', 'hack', 'advice', 'guide'],
  hot_take: ['hot take', 'unpopular opinion', 'overrated', 'nobody', 'everyone is wrong', 'should be banned', 'is dead', 'scam', 'wake up', 'disgrace', 'worst', 'ruined', 'rigged', 'fight me'],
  humor: ['lol', 'lmao', 'haha', 'joke', 'me:', 'nobody:', 'when you', 'rofl', 'funny', 'meme', 'pov'],
};
const SPAM = ['buy now', 'click here', 'free money', 'giveaway', 'airdrop', 'limited time', '100x', 'guaranteed', 'act now', 'promo code', 'dm for'];
export function offlineRatePost(input: PostInput): PostRating {
  const t = text(input.text);
  const mine = new Set(contentStems(input.text));
  const dup = input.recentPosts.some((p) => {
    const old = contentStems(p);
    return old.length > 0 && old.filter((w) => mine.has(w)).length >= Math.max(2, Math.ceil(old.length * 0.7));
  });
  const n = t.stems.length;
  const shouting = input.text.replace(/[^A-Za-z]/g, '').length > 12 && input.text === input.text.toUpperCase();
  let quality = n < 4 ? 0.15 : n < 8 ? 0.4 : n <= 45 ? 0.65 : 0.45;
  if (shouting) quality -= 0.2;
  const trend = input.trending.some((x) => findAny(t, [x]) || contentStems(x).some((w) => w.length > 3 && mine.has(w)));
  if (dup || SPAM.some((k) => keyHit(t, k) > 0) || n === 0) return { category: 'spam', quality: Math.max(0, quality - 0.3) };
  if (trend) quality += 0.15;
  if (n <= 1) return { category: 'spam', quality: 0.1 };
  const hit = (Object.keys(POST_WORDS) as (keyof typeof POST_WORDS)[]).map((c) => ({ c, s: Math.max(0, ...POST_WORDS[c].map((k) => keyHit(t, k))) })).filter((x) => x.s > 0);
  // the strongest signal wins; ties break by this order
  const order: (keyof typeof POST_WORDS)[] = ['self_promo', 'tip', 'hot_take', 'launch', 'humor'];
  hit.sort((a, b) => b.s - a.s || order.indexOf(a.c) - order.indexOf(b.c));
  const pick = hit[0]?.c;
  const category: PostRating['category'] = trend && pick !== 'launch' && pick !== 'self_promo' && pick !== 'hot_take' ? 'reaction' : pick ?? 'tip';
  return { category, quality: Math.max(0, Math.min(1, quality)) };
}

/** Jev's interface, answered by the keyword matcher. */
export const offlineJev: Required<JevRouter> = {
  async route(input) { return offlineRoute(input); },
  async ratePost(input) { return offlineRatePost(input); },
  async matchFeatures(input) {
    const sc = offlineScores(input);
    return input.features.filter((_, i) => sc[i] >= 0.5).map((f) => f.id);
  },
  async matchScores(input) { return offlineScores(input); },
};
