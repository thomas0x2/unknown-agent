/*
 * Coinbin Exchange: swaps between the coins in the player's Coinbin wallet. DOLR is the wallet's
 * cash (values.crypto, every bill and payment); the other coins sit in state.coins. Rates are DOLR
 * per coin at each day's close, scripted like the stock market (crawler.MARKET_SCRIPT): no
 * randomness, the same in every run. Coinbin keeps a fee from what the player gets.
 */
import type { GameState } from './state';
import { clone, money } from './core';
import { dateShort } from './calendar';
import { COPE, copeRate, copeListed, copeLocked } from './cope';

export type Coin = 'DOLR' | 'EURI' | 'MOONCAT' | 'NONERO' | 'COPE';
export const COINS: { id: Coin; name: string; decimals: number }[] = [
  { id: 'DOLR', name: 'Dollar stablecoin', decimals: 2 },
  { id: 'EURI', name: 'Euro stablecoin', decimals: 2 },
  { id: 'MOONCAT', name: 'Memecoin', decimals: 0 },
  { id: 'NONERO', name: 'Privacy coin', decimals: 6 },
  // Dex Calloway's memecoin (engine/cope.ts): only on Coinbin once it trades
  { id: 'COPE', name: 'Memecoin', decimals: 0 },
];

/** Share of what the player gets that Coinbin keeps. */
export const EXCHANGE_FEE = 0.015;
/** The smallest exchange, worth this many DOLR. */
export const EXCHANGE_MIN = 1;

/** Each coin's DOLR price at the close before day 1. MOONCAT: the player's 4,200,000 were worth 0.42. */
const BASE_RATE: Record<Exclude<Coin, 'COPE'>, number> = { DOLR: 1, EURI: 1.084, MOONCAT: 0.42 / 4_200_000, NONERO: 148.6 };

/** Daily moves, days 1-21. EURI drifts, MOONCAT lurches and bleeds, NONERO moves like a mid-size coin. */
export const COIN_SCRIPT: Record<Exclude<Coin, 'DOLR' | 'COPE'>, number[]> = {
  EURI: [0.001, -0.002, 0.0015, -0.001, 0.0005, 0.002, -0.0025, 0.001, -0.0005, 0.003, -0.001, 0.0015, -0.002, 0.0005, 0.001, -0.003, 0.002, -0.0005, 0.001, -0.0015, 0.0025],
  MOONCAT: [-0.06, 0.18, -0.11, -0.04, 0.32, -0.27, -0.08, 0.05, -0.14, 0.09, -0.12, 0.41, -0.33, -0.07, 0.02, -0.19, 0.11, -0.09, 0.06, -0.15, -0.21],
  NONERO: [0.012, -0.024, 0.031, 0.008, -0.017, 0.022, -0.009, 0.041, -0.028, 0.014, 0.006, -0.035, 0.019, 0.027, -0.011, 0.048, -0.022, 0.009, -0.016, 0.033, -0.007],
};

const isCoin = (c: string): c is Coin => COINS.some((x) => x.id === c);
const decimalsOf = (c: Coin) => COINS.find((x) => x.id === c)!.decimals;
const roundTo = (n: number, d: number) => Math.floor(n * 10 ** d + 1e-9) / 10 ** d;

/** A coin's DOLR price at a day's close (day 0 is the close before the game starts). */
export function coinRate(c: Coin, day: number): number {
  if (c === 'DOLR') return 1;
  if (c === 'COPE') return copeRate(day);
  let p = BASE_RATE[c];
  for (let d = 1; d <= Math.min(day, 21); d++) p *= 1 + (COIN_SCRIPT[c][d - 1] ?? 0);
  return p;
}

/** The coins Coinbin shows today: COPE once it trades or the wallet holds some. */
export function coinsListed(s: GameState): typeof COINS {
  return COINS.filter((c) => c.id !== 'COPE' || copeListed(s.values.day) || coinHeld(s, 'COPE') > 0);
}

/** How much of a coin the player holds. */
export function coinHeld(s: GameState, c: Coin): number {
  return c === 'DOLR' ? s.values.crypto : s.coins?.[c] ?? 0;
}

/** An amount in a coin's own format: whole MOONCAT, 6 places of NONERO, cents otherwise. */
export function fmtCoin(c: Coin, n: number): string {
  const d = decimalsOf(c);
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export interface Quote { give: number; worth: number; fee: number; get: number }

/** What exchanging `amount` of `from` into `to` returns today, after the fee. */
export function quoteExchange(s: GameState, from: Coin, to: Coin, amount: number): Quote {
  const day = s.values.day;
  const worth = amount * coinRate(from, day);
  const fee = worth * EXCHANGE_FEE;
  return { give: amount, worth, fee, get: roundTo((worth - fee) / coinRate(to, day), decimalsOf(to)) };
}

export interface ExchangeResult { state: GameState; error?: string }

/** Exchanges `amount` of one coin for another. DOLR legs show in the wallet's history like any payment. */
export function exchangeCoins(s0: GameState, from: string, to: string, amount: number): ExchangeResult {
  if (!isCoin(from) || !isCoin(to)) return { state: s0, error: 'Pick two coins.' };
  if (from === to) return { state: s0, error: 'Pick two different coins.' };
  if (!Number.isFinite(amount) || amount <= 0) return { state: s0, error: 'Enter an amount above 0.' };
  if ((from === 'COPE' || to === 'COPE') && !copeListed(s0.values.day)) return { state: s0, error: 'COPE isn\'t trading yet.' };
  if (from === 'COPE' && copeLocked(s0)) return { state: s0, error: `This wallet created $${COPE.ticker}. Its COPE is locked until ${dateShort(COPE.unlockDay)}.` };
  const give = roundTo(amount, decimalsOf(from));
  const held = coinHeld(s0, from);
  if (give > held + 1e-9) return { state: s0, error: `You have ${fmtCoin(from, Math.max(0, held))} ${from}.` };
  const q = quoteExchange(s0, from, to, give);
  if (q.worth < EXCHANGE_MIN) return { state: s0, error: `The minimum exchange is worth ${EXCHANGE_MIN.toFixed(2)} DOLR.` };
  const s = clone(s0);
  const coins = { ...s.coins };
  if (from !== 'DOLR') coins[from] = roundTo(held - give, decimalsOf(from));
  if (to !== 'DOLR') coins[to] = roundTo((coins[to] ?? 0) + q.get, decimalsOf(to));
  s.coins = coins;
  const swap = `${fmtCoin(from, give)} ${from} → ${fmtCoin(to, q.get)} ${to}`;
  if (from === 'DOLR') money(s, -give, `Coinbin Exchange · ${swap}`);
  else if (to === 'DOLR') money(s, q.get, `Coinbin Exchange · ${swap}`);
  else s.tx.push({ day: s.values.day, amount: 0, memo: `Coinbin Exchange · ${swap}`, min: s.clockMin, bal: Math.round(s.values.crypto * 100) / 100 });
  return { state: s };
}
