/*
 * Spin Cycle's raw status feed and what the player's app makes of it. The feed (spincycle.test/feed)
 * is the ground truth: machine id, ST (0 free, 1 running, 2 done, 3 out of order) and T (seconds
 * left), six machines a page. States change overnight. The app's view applies the build's bugs.
 */
export interface Machine { id: number; st: 0 | 1 | 2 | 3; t: number }

/** The owner added four machines on day 5. */
export const machineCount = (day: number) => (day >= 5 ? 12 : 8);
export const FEED_PAGE = 6;

const hash = (n: number) => ((n * 2654435761) >>> 0) % 1000;

/** The feed on a given day. M3 is always out of order. */
export function machineFeed(day: number): Machine[] {
  const out: Machine[] = [];
  for (let id = 1; id <= machineCount(day); id++) {
    if (id === 3) { out.push({ id, st: 3, t: 0 }); continue; }
    const h = hash(day * 97 + id * 31);
    const st = h < 350 ? 0 : h < 800 ? 1 : 2;
    out.push({ id, st, t: st === 1 ? 240 + (h * 7) % 2700 : 0 });
  }
  // every day has at least one machine done and one running on the first page, and a busy new machine
  const first = out.slice(0, FEED_PAGE).filter((m) => m.id !== 3);
  if (!first.some((m) => m.st === 2)) Object.assign(first[day % first.length], { st: 2, t: 0 });
  const busy = first.filter((m) => m.st !== 2);
  if (!busy.some((m) => m.st === 1)) Object.assign(busy[(day + 1) % busy.length], { st: 1, t: 731 });
  if (out.length > 8 && out.slice(8).every((m) => m.st === 0)) Object.assign(out[8 + (day % 4)], { st: 1, t: 1520 });
  return out;
}

export type MachineStatus = 'free' | 'running' | 'done' | 'broken';
export interface MachineRow { id: number; status: MachineStatus; minutes?: number }

const STATUS: MachineStatus[] = ['free', 'running', 'done', 'broken'];

/**
 * What the app shows. `dataDay` is the feed it read (the deploy day when it never refreshes);
 * `showMinutes` is whether the minutes feature is built; `twelve` whether the update for the new
 * machines is.
 */
export function machineRows(dataDay: number, bugs: Set<string>, opts: { showMinutes: boolean; twelve: boolean }): MachineRow[] {
  let feed = machineFeed(dataDay);
  if (bugs.has('six_of_eight')) feed = feed.slice(0, FEED_PAGE); // the second page is never fetched
  if (bugs.has('still_eight') || !opts.twelve) feed = feed.slice(0, 8);
  return feed.map((m) => {
    let status = STATUS[m.st];
    if (bugs.has('fetch_all_free')) status = 'free';
    if (status === 'done' && bugs.has('done_as_free')) status = 'free';
    if (status === 'broken' && bugs.has('broken_as_free')) status = 'free';
    if (m.id > 8 && bugs.has('new_always_free')) status = 'free';
    // T is seconds; the bug reads it as minutes
    const minutes = status === 'running' && opts.showMinutes ? (bugs.has('minutes_wrong') ? m.t : Math.ceil(m.t / 60)) : undefined;
    return { id: m.id, status, minutes };
  });
}
