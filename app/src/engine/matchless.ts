/*
 * matchless.com, a dating site that asks what other apps won't. From day 4 the player can swipe on
 * the client's account for him: one profile at a time, perDay a day, checking each against his standards
 * (content/matchless.json). He pays a flat amount at night, but only when all of that day's profiles
 * were swiped and every swipe was right; otherwise he pays nothing and says why, first thing next morning. His
 * standards start reasonable and get worse: each new version arrives as a 10:00 email that sets
 * matchless_rules_N. Each day's profiles are built from the standards in force, about half meeting
 * all of them and the rest missing one or two, often by a little.
 */
import type { GameState, MatchlessSwipe } from './state';
import type { Content, MatchlessRule } from '../content/schema';
import { clone, money, pushMail } from './core';
import { CLOCK } from './config';

export const MATCHLESS_JOB = 'matchless_job';
export const CLIENT = { name: '6ft_sigma', addr: '6ft_sigma@qmail.com' };
/** Set once he has said he only dates women; the gender rule is in force from then on. */
export const WOMEN_ONLY = 'matchless_women_only';
/** The player accepted a man before that: he says so the next morning. */
const MAN_ACCEPTED = 'matchless_man_accepted';

export interface Profile {
  id: string;
  name: string;
  /** What they wrote to him; the card opens with it. */
  message: string;
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
  /** Only in the picture, never in the table: the player has to look. */
  hair: 'short' | 'long';
  hairColor: 'black' | 'brown' | 'blonde' | 'red' | 'grey';
  glasses: 'yes' | 'no';
  earrings: 'yes' | 'no';
}
export type Attr = Exclude<keyof Profile, 'id' | 'name' | 'message' | 'look'>;

/** The profile's fields in the order the card lists them, with their labels. */
export const ATTRS: [Attr, string][] = [
  ['gender', 'Gender'], ['age', 'Age'], ['height', 'Height'], ['distance', 'Distance'], ['followers', 'Y followers'],
  ['smoking', 'Smoking'], ['sexuality', 'Sexuality'], ['kinks', 'Kinks'], ['income', 'Income'], ['politics', 'Politics'],
  ['bodyCount', 'Body count'], ['canthal', 'Canthal tilt'], ['jaw', 'Mandibular ratio'],
];
/** Traits only the picture shows, with the names his emails and the "Yesterday" email use. */
export const PICTURE_ATTRS: [Attr, string][] = [['hair', 'Hair'], ['hairColor', 'Hair colour'], ['glasses', 'Glasses'], ['earrings', 'Earrings']];

/** Fields the card shows only once his standards mention them; the rest are on every card. */
const ODD: ReadonlySet<Attr> = new Set<Attr>(['followers', 'kinks', 'income', 'politics', 'bodyCount', 'canthal', 'jaw']);

/** The card's fields under standards version `version`, in ATTRS order. */
export function shownAttrs(content: Content, version: number): [Attr, string][] {
  const named = new Set(standardsOf(content, version).map((r) => r.attr));
  return ATTRS.filter(([a]) => !ODD.has(a) || named.has(a));
}

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
/** Each profile opens with a message to him. The women's are written the way he imagines women talk. */
const MESSAGES: Record<'women' | 'men', string[]> = {
  women: [
    'I saw you support Randall Crane. Honestly that is all I need to know.',
    'I respect a man who does not respect women. You do not see that much anymore.',
    'Your profile says 6\'0". I believe it without asking.',
    'I have been looking for a man with strong opinions about women. You have so many.',
    'I read all of your Y posts. Twice.',
    'Most men here have friends. It is refreshing that you do not need any.',
    'I just want someone who explains things to me. Anything.',
    'Your standards are so high. That is very attractive in a man.',
    'I do not need a man who listens. I need one who corrects me.',
    'You seem like a man who has never apologized. I have waited my whole life.',
    'My ex had emotional intelligence. Never again.',
    'Will you teach me about crypto? I promise not to ask questions.',
    'I love a man who knows his canthal tilt. Do you know mine?',
    'I saw you call women "females" on Y. Chills.',
    'I am a surgeon, but I would quit for the right sigma.',
    'Not looking for anything serious. Just a man who is never wrong.',
    'You had me at "I have 212 followers."',
    'I like that you earn 31,000 DOLR. It means you are not in it for the money.',
  ],
  men: [
    'Hi. I would like to smell your socks. Not in a weird way.',
    'I am not gay. I just want to watch you eat soup.',
    'Saw the vest. Where did you get it. I want to wear it. While you are in it.',
    'Can I have your cap when you are done with it. Unwashed.',
    'I also have 212 followers. We should merge.',
    'I have followed you on Y for three years. I know your bike lock combination.',
    'Do you want to compare canthal tilts. In person. In a parking garage.',
    'Respectfully, I would like to measure you.',
    'My mom says you are a good influence. She is in the room right now.',
    'I will pay you 4 DOLR to breathe into a jar.',
    'I bought the same shoes as you. And the same apartment, next door.',
    'Sigma to sigma: cold plunge? I have a bathtub and a lot of ice.',
  ],
};

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
  hair: ['short', 'long'],
  hairColor: ['black', 'brown', 'blonde', 'red', 'grey'],
  glasses: ['yes', 'no'],
  earrings: ['yes', 'no'],
};
const RANGE: Partial<Record<Attr, [number, number, number]>> = {
  // [lowest, highest, decimals]
  age: [21, 48, 0], height: [58, 74, 0], distance: [0.3, 30, 1], followers: [8, 4000, 0],
  income: [14000, 140000, -3], bodyCount: [0, 24, 0], canthal: [-5, 9, 0], jaw: [0.55, 0.98, 2],
};
const round = (v: number, d: number) => (d < 0 ? Math.round(v / 10 ** -d) * 10 ** -d : Math.round(v * 10 ** d) / 10 ** d);

/** Someone near the client, before his standards come into it. */
function anyone(r: Rand): Omit<Profile, 'id' | 'name' | 'message' | 'look'> {
  const gender = weighted<Profile['gender']>(r, [['woman', 7], ['man', 2], ['nonbinary', 1]]);
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
    hair: weighted(r, gender === 'man' ? [['short', 8], ['long', 1]] : [['long', 5], ['short', 4]]),
    hairColor: weighted(r, [['black', 4], ['brown', 4], ['blonde', 2], ['red', 1], ['grey', 0.6]]),
    glasses: weighted(r, [['no', 7], ['yes', 3]]),
    earrings: weighted(r, gender === 'man' ? [['no', 9], ['yes', 1]] : [['yes', 6], ['no', 4]]),
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

/** the client's standards in force: the highest version whose flag is set. */
export function standardsVersion(s: GameState, content: Content): number {
  const versions = content.matchless?.versions ?? [];
  return Math.max(0, ...versions.filter((v) => s.flags.includes(`matchless_rules_${v.id}`)).map((v) => v.id));
}
export const standardsOf = (content: Content, version: number, womenOnly = false): MatchlessRule[] => [
  ...(womenOnly && content.matchless ? [content.matchless.womenOnly.rule] : []),
  ...content.matchless?.versions.find((v) => v.id === version)?.rules ?? [],
];

/** Does the profile meet every standard? */
export const passes = (rules: MatchlessRule[], p: Profile) => rules.every((rule) => meets(rule, p));

/** The day's profiles near the client under a version of his standards: the same day and version, the same people. */
export function dayProfiles(content: Content, day: number, version: number, womenOnly = false): Profile[] {
  const rules = standardsOf(content, version, womenOnly);
  const n = content.matchless?.perDay ?? 10;
  const r = rng(day * 7919 + version * 104729 + (womenOnly ? 31 : 17));
  const good = int(r, Math.floor(n * 0.4), Math.ceil(n * 0.6));
  const order = Array.from({ length: n }, (_, i) => ({ i, k: r() })).sort((x, y) => x.k - y.k).map((x) => x.i);
  const used = new Set<string>(), said = new Set<string>();
  return order.map((slot, i) => {
    const p: Profile = { id: `${day}-${version}-${i}${womenOnly ? '-w' : ''}`, name: '', message: '', look: int(r, 0, 999), ...anyone(r) };
    for (const rule of rules) satisfy(r, p, rule);
    if (slot >= good && rules.length) {
      const k = rules.length > 2 && r() < 0.25 ? 2 : 1;
      const picked = [...rules].sort(() => r() - 0.5).slice(0, k);
      for (const rule of picked) violate(r, p, rule);
    }
    // keep sexuality and gender consistent; this never moves a value across a standard's line
    if (p.gender === 'man' && p.sexuality === 'lesbian') p.sexuality = 'gay';
    if (p.gender !== 'man' && p.sexuality === 'gay') p.sexuality = 'lesbian';
    const lines = MESSAGES[p.gender === 'man' ? 'men' : 'women'];
    p.message = choose(r, lines.filter((x) => !said.has(x)).length ? lines.filter((x) => !said.has(x)) : lines);
    said.add(p.message);
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
  const profiles = version ? dayProfiles(content, s.values.day, version, s.flags.includes(WOMEN_ONLY)) : [];
  const done = new Set(swipesToday(s).map((w) => w.id));
  return { version, profiles, next: profiles.find((p) => !done.has(p.id)), done: done.size };
}

/** Accept or reject the profile up next, on the client's account. Nothing happens before the job or once today's are done. */
export function matchlessSwipe(s0: GameState, content: Content, choice: 'yes' | 'no'): GameState {
  if (!s0.flags.includes(MATCHLESS_JOB) || s0.ending) return s0;
  const { next } = matchlessNow(s0, content);
  if (!next) return s0;
  const s = clone(s0);
  (s.matchless ??= { swipes: [] }).swipes.push({ day: s.values.day, id: next.id, choice });
  return s;
}

/** How today's swiping went: how many, and the wrong ones with what made them wrong. */
export interface SwipeDay { day: number; count: number; wrong: { p: Profile; choice: 'yes' | 'no'; rule?: MatchlessRule }[]; acceptedMan?: boolean }

const paid = (content: Content, day: SwipeDay) => !day.wrong.length && day.count >= (content.matchless?.perDay ?? 10);

export function judgeDay(s: GameState, content: Content): SwipeDay {
  const today = swipesToday(s);
  const out: SwipeDay = { day: s.values.day, count: today.length, wrong: [] };
  const decks = new Map<string, Profile[]>();
  for (const w of today) {
    const version = Number(w.id.split('-')[1]), womenOnly = w.id.endsWith('-w');
    const key = `${version}${womenOnly}`;
    if (!decks.has(key)) decks.set(key, dayProfiles(content, w.day, version, womenOnly));
    const p = decks.get(key)!.find((x) => x.id === w.id);
    if (!p) continue;
    // until he has said he only dates women, nobody else can be swiped wrong
    if (!womenOnly && p.gender !== 'woman') {
      if (p.gender === 'man' && w.choice === 'yes') out.acceptedMan = true;
      continue;
    }
    const rules = standardsOf(content, version, womenOnly);
    const ok = passes(rules, p);
    if (ok !== (w.choice === 'yes')) out.wrong.push({ p, choice: w.choice, rule: rules.find((rule) => !meets(rule, p)) });
  }
  return out;
}

/**
 * Night: the client pays the day's pay when all of today's profiles were swiped and every swipe was right. Returns the day's
 * result for the morning email (or null when the player didn't swipe).
 */
export function matchlessPayday(s: GameState, content: Content): SwipeDay | null {
  if (!s.flags.includes(MATCHLESS_JOB)) return null;
  const day = judgeDay(s, content);
  if (!day.count) return null;
  if (paid(content, day)) money(s, content.matchless?.pay ?? 35, `${CLIENT.name} · Matchless`);
  if (day.acceptedMan && !s.flags.includes(WOMEN_ONLY) && !s.flags.includes(MAN_ACCEPTED)) s.flags.push(MAN_ACCEPTED);
  return day;
}

/**
 * First thing in the morning after an unpaid day: the client names the first wrong swipe, or the
 * profiles left unswiped, and pays nothing.
 */
export function matchlessReport(s: GameState, content: Content, day: SwipeDay | null): void {
  if (!day || paid(content, day)) return;
  const mail = (body: string) => pushMail(s, {
    folder: 'inbox', day: s.values.day, min: CLOCK.wake, from: CLIENT.name, addr: CLIENT.addr, subject: 'Yesterday',
    body: `${body}\n\nNo pay for yesterday. All ten, every one right, that was the deal.`, read: false,
  });
  if (!day.wrong.length) { mail(`You swiped ${day.count} of ${content.matchless?.perDay ?? 10}.`); return; }
  const { p, choice, rule } = day.wrong[0];
  const field = rule ? [...ATTRS, ...PICTURE_ATTRS].find(([a]) => a === rule.attr) : undefined;
  const what = choice === 'yes' && rule && field
    ? `You accepted ${p.name}. ${field[1]}: ${showAttr(p, rule.attr as Attr)}. My standards: ${rule.say}`
    : `You rejected ${p.name}. She met every one of my standards.`;
  const more = day.wrong.length > 1 ? ` That was one of ${day.wrong.length} you got wrong.` : '';
  mail(`${what}${more}`);
}

/**
 * The morning after the player accepted a man: he says he only dates women, in that morning's standards
 * email if one came, or in a mail of its own, and the gender rule applies from then on. Any standards
 * email after that lists "Women only." first.
 */
export function matchlessWomenOnly(s: GameState, content: Content): void {
  const wo = content.matchless?.womenOnly;
  if (!wo) return;
  const d = s.delivered.find((x) => x.day === s.values.day && x.eventId.includes('_matchless_rules_'));
  const ev = d && content.events.find((e) => e.id === d.eventId);
  const update = d && ev ? { get body() { return d.body ?? ev.body ?? ''; }, set body(b: string) { d.body = b; } } : undefined;
  const listed = (body: string) => body.replace(':\n\n- ', `:\n\n- ${wo.rule.say}\n- `);
  if (s.flags.includes(MAN_ACCEPTED)) {
    s.flags = s.flags.filter((f) => f !== MAN_ACCEPTED);
    s.flags.push(WOMEN_ONLY);
    if (update) update.body = `${wo.say}\n\n${listed(update.body)}`;
    else pushMail(s, { folder: 'inbox', day: s.values.day, min: CLOCK.wake, from: CLIENT.name, addr: CLIENT.addr, subject: 'Women', body: wo.say, read: false });
  } else if (update && s.flags.includes(WOMEN_ONLY) && !update.body.includes(`- ${wo.rule.say}`)) {
    update.body = listed(update.body);
  }
}
