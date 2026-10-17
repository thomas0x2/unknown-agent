/*
 * Pollymarket (pollymarket.com): the prediction market. Every market, its odds over time and its
 * trades are written in content/pollymarket.json and follow the story, so nothing is random and the
 * site never runs ahead of the game clock. There is nothing to bet with: the player only watches.
 * Rendered by ui/pollymarket.ts.
 */
import MARKETS from '../../content/pollymarket.json';
import type { GameState } from './state';
import { parseClock, posted } from './events';

interface Timed { day: number; at: string; flag?: string; unless?: string }
/** The YES price in cents (= its chance in %) from this moment on. */
export interface OddsPoint extends Timed { p: number }
export interface Trade extends Timed { who: string; side: 'YES' | 'NO'; amount: number }

export interface Market {
  /** the page's path: pollymarket.com/<slug> */
  slug: string;
  title: string;
  category: string;
  opens: { day: number; at: string };
  /** the day trading ends (may be after day 21) */
  ends: number;
  /** total volume in DOLR by the end of day 21; the site shows the share traded so far */
  volume: number;
  rules: string;
  points: OddsPoint[];
  trades: Trade[];
  resolve?: { day: number; at: string; outcome: 'YES' | 'NO' };
  /** only exists once all of these flags are set */
  flagsAll?: string[];
}

export const MARKETS_ALL: Market[] = MARKETS as Market[];

const minOf = (t: { at: string }) => parseClock(t.at) ?? 0;
/** Minutes since day 1 00:00, for ordering and charts. */
export const stamp = (t: { day: number; at: string }) => (t.day - 1) * 1440 + minOf(t);
const now = (s: GameState) => (s.values.day - 1) * 1440 + s.clockMin;
const holds = (s: GameState, t: Timed) =>
  posted(s, t.day, minOf(t)) && (!t.flag || s.flags.includes(t.flag)) && (!t.unless || !s.flags.includes(t.unless));

export function marketLive(s: GameState, m: Market): boolean {
  return posted(s, m.opens.day, minOf(m.opens)) && (!m.flagsAll || m.flagsAll.every((f) => s.flags.includes(f)));
}

/** The odds history up to now, oldest first. */
export function oddsSoFar(s: GameState, m: Market): OddsPoint[] {
  return m.points.filter((p) => holds(s, p)).sort((a, b) => stamp(a) - stamp(b));
}

/** The resolution, once it has happened. */
export const resolved = (s: GameState, m: Market) => (m.resolve && posted(s, m.resolve.day, minOf(m.resolve)) ? m.resolve.outcome : undefined);

/** The YES chance in % right now (100 or 0 once resolved). */
export function oddsNow(s: GameState, m: Market): number {
  const r = resolved(s, m);
  if (r) return r === 'YES' ? 100 : 0;
  const pts = oddsSoFar(s, m);
  return pts.length ? pts[pts.length - 1].p : 50;
}

/** The chance at a past moment (for a trade's price), as of the points visible now. */
export function oddsAt(s: GameState, m: Market, t: { day: number; at: string }): number {
  const at = stamp(t);
  const pts = oddsSoFar(s, m).filter((p) => stamp(p) <= at);
  return pts.length ? pts[pts.length - 1].p : oddsSoFar(s, m)[0]?.p ?? 50;
}

/** The chance at the start of today (for the "today" move). */
export function oddsAtDayStart(s: GameState, m: Market): number {
  return oddsAt(s, m, { day: s.values.day, at: '00:00' });
}

/** Volume traded so far: the market's total, spread evenly from its opening to the end of day 21. */
export function volumeNow(s: GameState, m: Market): number {
  const end = stamp({ day: Math.min(m.resolve?.day ?? 21, 21), at: m.resolve?.at ?? '22:00' });
  const start = stamp(m.opens);
  const share = end <= start ? 1 : Math.max(0, Math.min(1, (now(s) - start) / (end - start)));
  return Math.round(m.volume * (0.04 + 0.96 * share));
}

export interface LiveTrade extends Trade { market: Market; price: number }

/** A market's trades so far, newest first, each at the price it was made at. */
export function tradesSoFar(s: GameState, m: Market): LiveTrade[] {
  return m.trades.filter((t) => holds(s, t))
    .map((t) => {
      const yes = oddsAt(s, m, t);
      return { ...t, market: m, price: t.side === 'YES' ? yes : 100 - yes };
    })
    .sort((a, b) => stamp(b) - stamp(a));
}

/** Every market open so far: unresolved first, the biggest volume first. */
export function liveMarkets(s: GameState, list: Market[] = MARKETS_ALL): Market[] {
  return list.filter((m) => marketLive(s, m))
    .sort((a, b) => Number(!!resolved(s, a)) - Number(!!resolved(s, b)) || volumeNow(s, b) - volumeNow(s, a));
}

/** The latest trades across every live market, newest first. */
export function recentTrades(s: GameState, n = 8, list: Market[] = MARKETS_ALL): LiveTrade[] {
  return liveMarkets(s, list).flatMap((m) => tradesSoFar(s, m)).sort((a, b) => stamp(b) - stamp(a)).slice(0, n);
}

export const findMarket = (slug: string, list: Market[] = MARKETS_ALL): Market | undefined => list.find((m) => m.slug === slug);
