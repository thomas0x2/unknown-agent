/*
 * Spin Cycle's raw status feed and what the player's app makes of it. The feed (spincycle.test/feed)
 * is the ground truth: machine id, ST (0 free, 1 running, 2 done, 3 out of order) and T (seconds
 * left), six machines a page. It follows the in-game clock: every machine has a day of loads
 * (wait for a customer, run, wait for pickup), busier in the evening and at the weekend, all of it
 * derived from the day and the machine so the feed and the app always agree. The app's view
 * applies the build's bugs.
 */
import { weekdayShort } from './calendar';

export interface Machine { id: number; st: 0 | 1 | 2 | 3; t: number }

/** The owner added four machines on day 5. */
export const machineCount = (day: number) => (day >= 5 ? 12 : 8);
export const FEED_PAGE = 6;
/** The feed shows the game's opening time unless told otherwise. */
const DEFAULT_MIN = 10 * 60;
const OPEN = 7 * 60;
const CLOSE = 24 * 60;

/** A small deterministic generator per machine and day. */
function rng(seed: number) {
  let x = (seed * 2654435761) >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/** How busy the place is at a minute of the day: 0 quiet, 1 every machine wanted. */
function busy(day: number, min: number): number {
  const h = min / 60;
  const base = h < 9 ? 0.1 : h < 12 ? 0.2 : h < 17 ? 0.45 : h < 22 ? 0.9 : 0.3;
  const wd = weekdayShort(day);
  return Math.min(0.95, base + (wd === 'Sat' || wd === 'Sun' ? 0.15 : 0));
}

type Span = { from: number; to: number; st: 0 | 1 | 2 | 3 };

/** One machine's day, from opening to close. M3 is out of order for good; others break now and then and are fixed overnight. */
/** The machine on the first page holding someone's load from last night, never collected that day. */
export const forgottenLoad = (day: number) => [1, 2, 4, 5, 6][day % 5];

function machineDay(day: number, id: number): Span[] {
  if (id === 3) return [{ from: 0, to: CLOSE, st: 3 }];
  // there is always a load waiting for pickup somewhere: done machines are never missing from the feed
  if (id === forgottenLoad(day)) return [{ from: 0, to: CLOSE, st: 2 }];
  const r = rng(day * 1009 + id * 7919);
  const spans: Span[] = [{ from: 0, to: OPEN, st: 0 }];
  // about one day in eight, one machine (a different one each time) dies in the afternoon
  const breaksAt = r() < 0.125 && id === 1 + ((day * 5) % machineCount(day)) && id !== 3 ? 13 * 60 + Math.floor(r() * 8 * 60) : CLOSE;
  let t = OPEN;
  while (t < CLOSE) {
    const gap = 2 + r() * 240 * (1 - busy(day, t)) ** 2;
    const run = 32 + Math.floor(r() * 26);
    // some people wait by the machine, most wander off; when there's a queue, someone pulls the load out sooner
    const pickup = r() < 0.3 + 0.4 * busy(day, t) ? r() * 6 : 6 + r() * 70 * (1.2 - busy(day, t));
    const marks: Span[] = [
      { from: t, to: t + gap, st: 0 },
      { from: t + gap, to: t + gap + run, st: 1 },
      { from: t + gap + run, to: t + gap + run + pickup, st: 2 },
    ];
    for (const s of marks) {
      if (s.from >= breaksAt) break;
      spans.push({ ...s, to: Math.min(s.to, breaksAt) });
    }
    t += gap + run + pickup;
    if (t >= breaksAt) break;
  }
  if (breaksAt < CLOSE) spans.push({ from: breaksAt, to: CLOSE, st: 3 });
  return spans;
}

/** The feed at a minute of a day (minutes since midnight). */
export function machineFeed(day: number, minute = DEFAULT_MIN): Machine[] {
  const out: Machine[] = [];
  for (let id = 1; id <= machineCount(day); id++) {
    const span = machineDay(day, id).find((s) => minute >= s.from && minute < s.to) ?? { from: 0, to: CLOSE, st: 0 as const };
    // seconds left: the cycle's end, give or take the seconds the panel shows
    const t = span.st === 1 ? Math.max(30, Math.round((span.to - minute) * 60) - ((id * 17 + day) % 60)) : 0;
    out.push({ id, st: span.st, t });
  }
  return out;
}

export type MachineStatus = 'free' | 'running' | 'done' | 'broken';
/** `raw` is set when the app shows the feed's ST code as it is, untranslated. */
export interface MachineRow { id: number; status: MachineStatus; minutes?: number; raw?: number }

const STATUS: MachineStatus[] = ['free', 'running', 'done', 'broken'];

/**
 * What the app shows. `dataDay` and `minute` are the feed it read (the deploy time when it never
 * refreshes); `showMinutes` is whether the minutes feature is built; `twelve` whether the update for
 * the new machines is.
 */
export function machineRows(dataDay: number, bugs: Set<string>, opts: { showMinutes: boolean; twelve: boolean }, minute = DEFAULT_MIN): MachineRow[] {
  let feed = machineFeed(dataDay, minute);
  if (bugs.has('six_of_eight')) feed = feed.slice(0, FEED_PAGE); // the second page is never fetched
  if (bugs.has('still_eight') || !opts.twelve) feed = feed.slice(0, 8);
  return feed.map((m) => {
    let status = STATUS[m.st];
    // a failed fetch, handled by assuming every machine is free
    if (bugs.has('fetch_failed')) status = 'free';
    if (status === 'done' && bugs.has('done_as_free')) status = 'free';
    if (status === 'broken' && bugs.has('broken_as_free')) status = 'free';
    if (m.id > 8 && bugs.has('new_always_free')) status = 'free';
    // T is seconds; the bug reads it as minutes
    const minutes = status === 'running' && opts.showMinutes ? (bugs.has('minutes_wrong') ? m.t : Math.ceil(m.t / 60)) : undefined;
    return { id: m.id, status, minutes, raw: bugs.has('raw_codes') ? STATUS.indexOf(status) : undefined };
  });
}
