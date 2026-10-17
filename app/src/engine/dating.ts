/*
 * Matchless, Derek's dating app. Every day brings a batch of profiles near him; the app runs them
 * through his hardcoded filters (age range, maximum height, distance, fewer Y followers than he has)
 * and shows the ones that pass, one card each, for the player to accept or reject on his behalf, up
 * to DAILY_PICKS a day. The profiles that didn't pass are listed with the filter that caught them.
 * Each day's batch is built from the client's current filters so every filter has someone on both
 * sides of its line: a broken filter always shows, letting through someone it should block or
 * blocking someone it should let through.
 */
import type { GameState, AppInstance, DatingPick } from './state';
import type { Content } from '../content/schema';
import { clone } from './core';
import { getApp, liveBugs, bugsOf } from './apps';

export interface Profile {
  id: string;
  name: string;
  age: number;
  /** Inches. */
  height: number;
  miles: number;
  followers: number;
  bio: string;
  /** Picks the card's picture. */
  look: number;
}

export interface Standards { ageMin: number; ageMax: number; height: number; miles: number; followers: number }
export type FilterId = 'age' | 'height' | 'distance' | 'followers';
export const FILTERS: FilterId[] = ['age', 'height', 'distance', 'followers'];

export const DAILY_PICKS = 10;
const PASSING = 12;

/** The client's filters from the feature's params ({ age: "21-27", height: "5'5\"", distance: "3", followers: "212" }). */
export function standardsOf(params: Record<string, string | number> | undefined): Standards {
  const age = String(params?.age ?? '21-27').match(/\d+/g)?.map(Number) ?? [21, 27];
  const ht = String(params?.height ?? `5'5"`).match(/\d+/g)?.map(Number) ?? [5, 5];
  return {
    ageMin: age[0] ?? 21,
    ageMax: age[1] ?? age[0] ?? 27,
    height: (ht[0] ?? 5) * 12 + (ht[1] ?? 0),
    miles: Number(String(params?.distance ?? '3').match(/\d+(?:\.\d+)?/)?.[0] ?? 3),
    followers: Number(String(params?.followers ?? '212').match(/\d+/)?.[0] ?? 212),
  };
}

export const feetInches = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;

const NAMES = [
  'Maya', 'Priya', 'Hannah', 'Lucia', 'Grace', 'Nadia', 'Erin', 'Sofia', 'Jade', 'Amara', 'Clara', 'Tess',
  'Rosa', 'Mei', 'Ingrid', 'Leah', 'Noor', 'Daniela', 'Fiona', 'Keiko', 'Bea', 'Olivia', 'Sana', 'Marta',
  'Ruth', 'Ivy', 'Camille', 'Zoe', 'Ana', 'Lena', 'Tamsin', 'Joy', 'Elif', 'Hazel', 'Paula', 'Yara',
];
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
];

/** A small generator, the same for the same day. */
function rng(seed: number) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** Where a strict (broken) filter wrongly draws its line: the top of the allowed range. */
function strictLine(f: FilterId, std: Standards): (p: Profile) => boolean {
  if (f === 'age') return (p) => p.age >= std.ageMax - 1;
  if (f === 'height') return (p) => p.height >= std.height - 1;
  // miles read as kilometres
  if (f === 'distance') return (p) => p.miles * 1.609 > std.miles;
  return (p) => p.followers >= Math.floor(std.followers * 0.8);
}

/** Does this profile pass the client's filter? */
function passes(f: FilterId, p: Profile, std: Standards): boolean {
  if (f === 'age') return p.age >= std.ageMin && p.age <= std.ageMax;
  if (f === 'height') return p.height <= std.height;
  if (f === 'distance') return p.miles <= std.miles;
  return p.followers < std.followers;
}

/**
 * Today's profiles. Twelve pass every filter: four of them sit just inside one filter's line (the
 * oldest in the range, the tallest allowed, the furthest, the most followers), the rest comfortably
 * inside all of them. Four fail exactly one filter each, two fail two.
 */
export function dayProfiles(day: number, std: Standards): Profile[] {
  const r = rng(day * 7919 + 13);
  const between = (a: number, b: number) => a + r() * (b - a);
  const int = (a: number, b: number) => Math.floor(between(a, b + 1));
  // comfortably inside every line, so a strict filter leaves them alone
  const safe = () => ({
    age: int(std.ageMin, Math.max(std.ageMin, std.ageMax - 2)),
    height: int(std.height - 7, std.height - 2),
    miles: Math.round(between(0.2, Math.max(0.3, std.miles / 1.609 - 0.1)) * 10) / 10,
    followers: int(5, Math.max(5, Math.floor(std.followers * 0.8) - 1)),
  });
  // just inside one filter's line, where a strict filter wrongly blocks them
  const edge: Record<FilterId, () => Partial<Profile>> = {
    age: () => ({ age: int(std.ageMax - 1, std.ageMax) }),
    height: () => ({ height: int(std.height - 1, std.height) }),
    distance: () => ({ miles: Math.round(between(std.miles / 1.609 + 0.1, std.miles) * 10) / 10 }),
    followers: () => ({ followers: int(Math.ceil(std.followers * 0.8), std.followers - 1) }),
  };
  const over: Record<FilterId, () => Partial<Profile>> = {
    age: () => ({ age: int(std.ageMax + 2, std.ageMax + 12) }),
    height: () => ({ height: int(std.height + 2, std.height + 6) }),
    distance: () => ({ miles: Math.round(between(std.miles + 0.8, std.miles + 9) * 10) / 10 }),
    followers: () => ({ followers: int(std.followers + 20, std.followers * 6) }),
  };
  const shapes: Partial<Profile>[] = [];
  for (const f of FILTERS) shapes.push(edge[f]());
  while (shapes.length < PASSING) shapes.push({});
  for (const f of FILTERS) shapes.push(over[f]());
  for (let i = 0; i < 2; i++) {
    const a = FILTERS[int(0, 3)];
    const b = FILTERS[(FILTERS.indexOf(a) + 1 + int(0, 2)) % 4];
    shapes.push({ ...over[a](), ...over[b]() });
  }
  // shuffle the order they come in, then give each a name, a bio and a picture
  const order = shapes.map((sh) => ({ sh, k: r() }));
  order.sort((x, y) => x.k - y.k);
  const start = int(0, NAMES.length - 1);
  const bioStart = int(0, BIOS.length - 1);
  return order.map(({ sh }, i) => ({
    id: `${day}-${i}`,
    name: NAMES[(start + i * 5) % NAMES.length],
    bio: BIOS[(bioStart + i * 5) % BIOS.length],
    look: int(0, 999),
    ...safe(),
    ...sh,
  }));
}

export interface Screened {
  deck: Profile[];
  blocked: { p: Profile; by: FilterId }[];
}

/**
 * The app's screening with the build's bugs: `<filter>_leak` skips that filter (it lets through what
 * it should block), `<filter>_strict` draws its line too tight (it blocks some it should let through).
 * Without the filters built, everyone passes.
 */
export function screen(profiles: Profile[], std: Standards | null, bugs: Set<string>): Screened {
  const out: Screened = { deck: [], blocked: [] };
  for (const p of profiles) {
    const by = !std ? undefined : FILTERS.find((f) => {
      if (bugs.has(`${f}_leak`)) return false;
      if (bugs.has(`${f}_strict`) && strictLine(f, std)(p)) return true;
      return !passes(f, p, std);
    });
    if (by) out.blocked.push({ p, by });
    else out.deck.push(p);
  }
  return out;
}

/** The client changed his filters and the live app still has the old ones: he pauses screening until they ship. */
export function datingPaused(app: AppInstance): boolean {
  return app.deployed && bugsOf(app.features.find((f) => f.id === 'filters')).includes('outdated');
}

/** Today's decisions on this app, in the order made. */
export const picksToday = (s: GameState, appId: string): DatingPick[] =>
  (s.dating?.picks ?? []).filter((p) => p.day === s.values.day && p.app === appId);

/** How much of today's limit is used: each decision counts once, twice with the limit bug. */
export const limitUsed = (picks: number, bugs: Set<string>) => picks * (bugs.has('limit_double') ? 2 : 1);

/** What the live app screens today: the filters it was built with and the bugs it shows. */
export function liveScreen(s: GameState, app: AppInstance, content: Content): Screened & { bugs: Set<string>; std: Standards | null } {
  const bugs = liveBugs(app, content.apps[app.template]);
  const built = app.features.find((f) => f.id === 'filters');
  const std = built ? standardsOf(built.params ?? app.specParams.filters) : null;
  return { ...screen(dayProfiles(s.values.day, standardsOf(app.specParams.filters)), std, bugs), bugs, std };
}

/**
 * Accept or reject a profile from today's deck for the client. The swapped-buttons bug records the
 * opposite of what was pressed. Past the daily limit, or while the client has screening paused,
 * nothing happens.
 */
export function datingPick(s0: GameState, content: Content, appId: string, profileId: string, choice: 'yes' | 'no'): GameState {
  const app = getApp(s0, appId);
  if (!app || !app.deployed || app.churned || datingPaused(app)) return s0;
  if (!app.features.some((f) => f.id === 'deck')) return s0;
  const { deck, bugs } = liveScreen(s0, app, content);
  if (!deck.some((p) => p.id === profileId)) return s0;
  const today = picksToday(s0, appId);
  if (today.some((p) => p.id === profileId)) return s0;
  if (limitUsed(today.length + 1, bugs) > DAILY_PICKS) return s0;
  const s = clone(s0);
  const flip = bugs.has('buttons_swapped');
  const recorded = flip ? (choice === 'yes' ? 'no' : 'yes') : choice;
  (s.dating ??= { picks: [] }).picks.push({ day: s.values.day, app: appId, id: profileId, choice: recorded });
  return s;
}
