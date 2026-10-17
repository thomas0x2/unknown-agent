/*
 * matchless.com, a dating site that asks what other apps won't. From day 4 the player can swipe on
 * Derek's account for him: one profile at a time, perDay a day, checking each against his standards
 * (content/matchless.json). He pays perSwipe a swipe at night, but only when every swipe that day
 * was right; one wrong swipe and he pays nothing and says which one, first thing next morning. His
 * standards start reasonable and get worse: each new version arrives as a 10:00 email that sets
 * matchless_rules_N. Each day's profiles are built from the standards in force, about half meeting
 * all of them and the rest missing one or two, often by a little.
 */
import type { GameState, MatchlessSwipe } from './state';
import type { Content, MatchlessRule } from '../content/schema';
import { clone, money, pushMail } from './core';
import { CLOCK } from './config';

export const MATCHLESS_JOB = 'matchless_job';
export const DEREK = { name: 'Derek', addr: 'derek@highvalue.test' };

export interface Profile {
  id: string;
  name: string;
  bio: string;
  /** Picks the card's picture. */
  look: number;
  gender: 'woman' | 'man' | 'nonbinary';
  age: number;
  /** Inches. */
  height: number;
  /** Miles away. */
  distance: number;
  followers: number;
  smoking: 'no' | 'socially' | 'yes';
  sexuality: string;
  kinks: string;
  /** DOLR a year. */
  income: number;
  politics: 'heritage' | 'progress' | 'none';
  bodyCount: number;
  /** Degrees. */
  canthal: number;
  /** Mandibular height to width ratio. */
  jaw: number;
}
export type Attr = Exclude<keyof Profile, 'id' | 'name' | 'bio' | 'look'>;

/** The profile's fields in the order the card lists them, with their labels. */
export const ATTRS: [Attr, string][] = [
  ['gender', 'Gender'], ['age', 'Age'], ['height', 'Height'], ['distance', 'Distance'], ['followers', 'Y followers'],
  ['smoking', 'Smoking'], ['sexuality', 'Sexuality'], ['kinks', 'Kinks'], ['income', 'Income'], ['politics', 'Politics'],
  ['bodyCount', 'Body count'], ['canthal', 'Canthal tilt'], ['jaw', 'Mandibular ratio'],
];

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const feetInches = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;
const POLITICS = { heritage: 'Heritage Party', progress: 'Progress Party', none: 'None' };

/** A field as the card shows it. */
export function showAttr(p: Profile, a: Attr): string {
  const v = p[a];
  switch (a) {
    case 'height': return feetInches(p.height);
    case 'distance': return `${p.distance} miles away`;
    case 'followers': return p.followers.toLocaleString('en-US');
    case 'income': return `${p.income.toLocaleString('en-US')} DOLR a year`;
    case 'politics': return POLITICS[p.politics];
    case 'kinks': return p.kinks === 'none' ? 'None listed' : cap(p.kinks);
    case 'canthal': return `${p.canthal > 0 ? '+' : p.canthal < 0 ? '−' : ''}${Math.abs(p.canthal)}°`;
    case 'jaw': return p.jaw.toFixed(2);
    default: return cap(String(v));
  }
}

const NAMES: Record<Profile['gender'], string[]> = {
  woman: ['Maya', 'Priya', 'Hannah', 'Lucia', 'Grace', 'Nadia', 'Erin', 'Sofia', 'Jade', 'Amara', 'Clara', 'Tess', 'Rosa', 'Mei', 'Ingrid', 'Leah',
    'Noor', 'Daniela', 'Fiona', 'Keiko', 'Bea', 'Olivia', 'Sana', 'Marta', 'Ruth', 'Ivy', 'Camille', 'Zoe', 'Ana', 'Lena', 'Tamsin', 'Joy', 'Elif', 'Hazel', 'Paula', 'Yara'],
  man: ['Tom', 'Ravi', 'Marcus', 'Jonah', 'Felix', 'Omar', 'Luca', 'Ben'],
  nonbinary: ['Alex', 'Robin', 'Jules', 'Sam', 'Quinn', 'Ash'],
};
const BIOS = [
  'Nurse, night shifts. If I reply at 4am that is why.',
  'Teaching third grade. I can tell when you are lying.',
  'Looking for someone who reads the whole article before posting about it.',
  'Climbing on weekends, spreadsheets on weekdays.',
  'Retrained as a welder after Vantor let me go. Best decision I was forced into.',
  'Two cats, one plant that is somehow still alive.',
  'Will judge you by your bookshelf. Lightly.',
  'Paramedic. Calm in a crisis, chaotic in a grocery store.',
  'I make pasta from scratch and I will mention it.',
  'Training an AI to do my old job. Ask me how that feels.',
  'Running club, bad karaoke, good coffee.',
  'Pharmacist. No, I will not tell you what anyone is on.',
  'Just moved here. Show me a bar that is not a franchise.',
  'Into board games with too many rules.',
  'Architect. I have opinions about your apartment.',
  'Volunteer at the animal shelter. The dogs like me more than people do.',
  'Software tester. Professionally good at finding what is broken.',
  'Looking for someone kind. That is the whole list.',
  'Night classes in accounting. Day job in a call center that is mostly a bot now.',
  'Sourdough survivor. Still have the starter.',
  'Bike mechanic. Yes, I can fix yours.',
  'Museum guard. I have stood next to a lot of famous paintings.',
  'Not here for pen pals.',
  'Gardener. Ask me about tomatoes and lose an afternoon.',
  'Chef at a place you cannot get a table at.',
  'Lawyer. I read terms and conditions for fun.',
  'Hiking, photography, early nights.',
  'Bilingual, overcaffeinated, on time.',
  'I filled in every field on this app. I am starting to regret it.',
];

/** A small generator, the same for the same seed. */
function rng(seed: number) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
type Rand = () => number;
const between = (r: Rand, a: number, b: number) => a + r() * (b - a);
const int = (r: Rand, a: number, b: number) => Math.floor(between(r, a, b + 1));
const choose = <T>(r: Rand, list: readonly T[]) => list[Math.floor(r() * list.length)];
const weighted = <T>(r: Rand, list: [T, number][]) => {
  let x = r() * list.reduce((n, [, w]) => n + w, 0);
  for (const [v, w] of list) if ((x -= w) < 0) return v;
  return list[0][0];
};

/** The values each field can take, and how numbers are rounded. */
const VALUES: Partial<Record<Attr, readonly string[]>> = {
  gender: ['woman', 'man', 'nonbinary'],
  smoking: ['no', 'socially', 'yes'],
  sexuality: ['straight', 'bi', 'lesbian', 'gay', 'pan'],
  kinks: ['none', 'roleplay', 'feet', 'leather', 'being told what to do'],
  politics: ['heritage', 'progress', 'none'],
};
const RANGE: Partial<Record<Attr, [number, number, number]>> = {
  // [lowest, highest, decimals]
  age: [21, 48, 0], height: [58, 74, 0], distance: [0.3, 30, 1], followers: [8, 4000, 0],
  income: [14000, 140000, -3], bodyCount: [0, 24, 0], canthal: [-5, 9, 0], jaw: [0.55, 0.98, 2],
};
const round = (v: number, d: number) => (d < 0 ? Math.round(v / 10 ** -d) * 10 ** -d : Math.round(v * 10 ** d) / 10 ** d);

/** Someone near Derek, before his standards come into it. */
function anyone(r: Rand): Omit<Profile, 'id' | 'name' | 'bio' | 'look'> {
  const gender = weighted<Profile['gender']>(r, [['woman', 8], ['man', 1], ['nonbinary', 1]]);
  return {
    gender,
    age: int(r, 21, 46),
    height: int(r, 59, 72),
    distance: Math.max(0.3, round(between(r, 0.1, 1) ** 2 * 28, 1)),
    followers: Math.round(10 * Math.exp(between(r, 0, 5.5))),
    smoking: weighted(r, [['no', 6], ['socially', 2.5], ['yes', 1.5]]),
    sexuality: gender === 'man' ? weighted(r, [['straight', 7], ['bi', 2], ['gay', 2]]) : weighted(r, [['straight', 6], ['bi', 2.5], ['lesbian', 1], ['pan', 0.5]]),
    kinks: weighted(r, [['none', 5], ['roleplay', 1], ['feet', 1], ['leather', 1], ['being told what to do', 1]]),
    income: round(between(r, 18000, 120000), -3),
    politics: weighted(r, [['heritage', 3.5], ['progress', 4], ['none', 2.5]]),
    bodyCount: Math.floor(between(r, 0, 4) ** 1.6),
    canthal: int(r, -4, 8),
    jaw: round(between(r, 0.58, 0.95), 2),
  };
}

/** Does this value meet the rule? */
export function meets(rule: MatchlessRule, p: Profile): boolean {
  const v = p[rule.attr as Attr];
  if (rule.allow) return rule.allow.includes(String(v));
  const n = Number(v);
  return (rule.min == null || n >= rule.min) && (rule.max == null || n <= rule.max);
}

/** Bring a value inside the rule: an allowed value, or a number inside its range. */
function satisfy(r: Rand, p: Profile, rule: MatchlessRule): void {
  if (meets(rule, p)) return;
  const a = rule.attr as Attr;
  const set = p as unknown as Record<string, string | number>;
  if (rule.allow) { set[a] = choose(r, rule.allow); return; }
  const [lo, hi, d] = RANGE[a] ?? [0, 100, 0];
  const min = Math.max(lo, rule.min ?? lo), max = Math.min(hi, rule.max ?? hi);
  set[a] = Math.min(max, Math.max(min, round(between(r, min, max), d)));
}

/** Push a value just outside the rule, often by a little, on whichever side has room. */
function violate(r: Rand, p: Profile, rule: MatchlessRule): void {
  const a = rule.attr as Attr;
  const set = p as unknown as Record<string, string | number>;
  if (rule.allow) { set[a] = choose(r, (VALUES[a] ?? []).filter((x) => !rule.allow!.includes(x))); return; }
  const [lo, hi, d] = RANGE[a] ?? [0, 100, 0];
  const step = 10 ** -d;
  const span = (hi - lo) / 6;
  const sides = [rule.min != null && rule.min - step >= lo ? 'below' : '', rule.max != null && rule.max + step <= hi ? 'above' : ''].filter(Boolean);
  const side = choose(r, sides.length ? sides : ['above']);
  const by = r() < 0.5 ? step * int(r, 1, 3) : between(r, step, span);
  set[a] = side === 'below' ? round(Math.max(lo, rule.min! - by), d) : round(Math.min(hi, (rule.max ?? lo) + by), d);
  if (meets(rule, p)) set[a] = side === 'below' ? rule.min! - step : (rule.max ?? lo) + step;
}

/** Derek's standards in force: the highest version whose flag is set. */
export function standardsVersion(s: GameState, content: Content): number {
  const versions = content.matchless?.versions ?? [];
  return Math.max(0, ...versions.filter((v) => s.flags.includes(`matchless_rules_${v.id}`)).map((v) => v.id));
}
export const standardsOf = (content: Content, version: number): MatchlessRule[] =>
  content.matchless?.versions.find((v) => v.id === version)?.rules ?? [];

/** Does the profile meet every standard? */
export const passes = (rules: MatchlessRule[], p: Profile) => rules.every((rule) => meets(rule, p));

/** The day's profiles near Derek under a version of his standards: the same day and version, the same people. */
export function dayProfiles(content: Content, day: number, version: number): Profile[] {
  const rules = standardsOf(content, version);
  const n = content.matchless?.perDay ?? 10;
  const r = rng(day * 7919 + version * 104729 + 17);
  const good = int(r, Math.floor(n * 0.4), Math.ceil(n * 0.6));
  const order = Array.from({ length: n }, (_, i) => ({ i, k: r() })).sort((x, y) => x.k - y.k).map((x) => x.i);
  const used = new Set<string>();
  return order.map((slot, i) => {
    const p: Profile = { id: `${day}-${version}-${i}`, name: '', bio: choose(r, BIOS), look: int(r, 0, 999), ...anyone(r) };
    for (const rule of rules) satisfy(r, p, rule);
    if (slot >= good && rules.length) {
      const k = rules.length > 2 && r() < 0.25 ? 2 : 1;
      const picked = [...rules].sort(() => r() - 0.5).slice(0, k);
      for (const rule of picked) violate(r, p, rule);
    }
    // keep sexuality and gender consistent; this never moves a value across a standard's line
    if (p.gender === 'man' && p.sexuality === 'lesbian') p.sexuality = 'gay';
    if (p.gender !== 'man' && p.sexuality === 'gay') p.sexuality = 'lesbian';
    const names = NAMES[p.gender].filter((x) => !used.has(x));
    p.name = choose(r, names.length ? names : NAMES[p.gender]);
    used.add(p.name);
    return p;
  });
}

/** Today's swipes, in order. */
export const swipesToday = (s: GameState): MatchlessSwipe[] => (s.matchless?.swipes ?? []).filter((w) => w.day === s.values.day);

/** What the site shows now: the profile up next (none once today's are done) and how far through the day the player is. */
export function matchlessNow(s: GameState, content: Content): { version: number; profiles: Profile[]; next?: Profile; done: number } {
  const version = standardsVersion(s, content);
  const profiles = version ? dayProfiles(content, s.values.day, version) : [];
  const done = new Set(swipesToday(s).map((w) => w.id));
  return { version, profiles, next: profiles.find((p) => !done.has(p.id)), done: done.size };
}

/** Accept or reject the profile up next, on Derek's account. Nothing happens before the job or once today's are done. */
export function matchlessSwipe(s0: GameState, content: Content, choice: 'yes' | 'no'): GameState {
  if (!s0.flags.includes(MATCHLESS_JOB) || s0.ending) return s0;
  const { next } = matchlessNow(s0, content);
  if (!next) return s0;
  const s = clone(s0);
  (s.matchless ??= { swipes: [] }).swipes.push({ day: s.values.day, id: next.id, choice });
  return s;
}

/** How today's swiping went: how many, and the wrong ones with what made them wrong. */
export interface SwipeDay { day: number; count: number; wrong: { p: Profile; choice: 'yes' | 'no'; rule?: MatchlessRule }[] }

export function judgeDay(s: GameState, content: Content): SwipeDay {
  const today = swipesToday(s);
  const out: SwipeDay = { day: s.values.day, count: today.length, wrong: [] };
  const byVersion = new Map<number, Profile[]>();
  for (const w of today) {
    const version = Number(w.id.split('-')[1]);
    if (!byVersion.has(version)) byVersion.set(version, dayProfiles(content, w.day, version));
    const p = byVersion.get(version)!.find((x) => x.id === w.id);
    if (!p) continue;
    const rules = standardsOf(content, version);
    const ok = passes(rules, p);
    if (ok !== (w.choice === 'yes')) out.wrong.push({ p, choice: w.choice, rule: rules.find((rule) => !meets(rule, p)) });
  }
  return out;
}

/**
 * Night: Derek pays perSwipe for each of today's swipes when all of them were right. Returns the day's
 * result for the morning email (or null when the player didn't swipe).
 */
export function matchlessPayday(s: GameState, content: Content): SwipeDay | null {
  if (!s.flags.includes(MATCHLESS_JOB)) return null;
  const day = judgeDay(s, content);
  if (!day.count) return null;
  if (!day.wrong.length) money(s, day.count * (content.matchless?.perSwipe ?? 2), `${DEREK.name} · Matchless`);
  return day;
}

/** First thing in the morning after a day with a wrong swipe: Derek names the first one and pays nothing. */
export function matchlessReport(s: GameState, day: SwipeDay | null): void {
  if (!day?.wrong.length) return;
  const { p, choice, rule } = day.wrong[0];
  const field = rule ? ATTRS.find(([a]) => a === rule.attr) : undefined;
  const what = choice === 'yes' && rule && field
    ? `You accepted ${p.name}. ${field[1]}: ${showAttr(p, rule.attr as Attr)}. My standards: ${rule.say}`
    : `You rejected ${p.name}. She met every one of my standards.`;
  const more = day.wrong.length > 1 ? ` That was one of ${day.wrong.length} you got wrong.` : '';
  pushMail(s, {
    folder: 'inbox', day: s.values.day, min: CLOCK.wake, from: DEREK.name, addr: DEREK.addr, subject: 'Yesterday',
    body: `${what}${more}\n\nNo pay for yesterday. Every swipe right, that was the deal.`, read: false,
  });
}
