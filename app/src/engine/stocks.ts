/*
 * Sherwood, the stock app (Robinhood parody). Quotes come from the same daily closes the sentiment
 * vibe check uses (crawler.price), so the player can check the crawler's prices against it. Trades
 * settle in DOLR straight from the Coinbin wallet, in fractional shares.
 */
import type { GameState } from './state';
import { clone, money } from './core';
import { price } from './crawler';

export interface Stock { ticker: string; name: string }
export const STOCKS: Stock[] = [
  { ticker: 'GAI', name: 'GeneralAI' },
  { ticker: 'VANT', name: 'Vantor Group' },
  { ticker: 'DISH', name: 'DoorDish' },
  { ticker: 'HALD', name: 'Halden Logistics' },
  { ticker: 'APO', name: 'Apogee' },
];

/** A ticker's quote right now: today's price. */
export const quote = (s: GameState, ticker: string) => price(ticker, s.values.day);

/** Shares the player holds of a ticker (fractional). */
export const sharesOf = (s: GameState, ticker: string) => s.stocks?.[ticker]?.shares ?? 0;
/** What the player paid for the shares they still hold, in DOLR. */
export const costOf = (s: GameState, ticker: string) => s.stocks?.[ticker]?.cost ?? 0;

export interface TradeResult { state: GameState; error?: string }

const known = (t: string) => STOCKS.some((x) => x.ticker === t);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Buys `amount` DOLR worth of `ticker`, paid from the wallet. */
export function buyStock(s0: GameState, ticker: string, amount: number): TradeResult {
  if (!known(ticker)) return { state: s0, error: 'Unknown ticker.' };
  if (!Number.isFinite(amount) || amount < 1) return { state: s0, error: 'The minimum order is 1.00 DOLR.' };
  const cost = Math.round(amount * 100) / 100;
  if (cost > s0.values.crypto) return { state: s0, error: `Not enough DOLR in your Coinbin wallet. You have ${s0.values.crypto.toFixed(2)}.` };
  const s = clone(s0);
  const shares = round6(cost / quote(s, ticker));
  s.stocks = { ...s.stocks, [ticker]: { shares: round6(sharesOf(s, ticker) + shares), cost: Math.round((costOf(s, ticker) + cost) * 100) / 100 } };
  money(s, -cost, `Sherwood · Bought ${shares.toFixed(4)} $${ticker}`);
  return { state: s };
}

/** Sells `amount` DOLR worth of `ticker` (or all of it, when `amount` is 'all'); the proceeds go to the wallet. */
export function sellStock(s0: GameState, ticker: string, amount: number | 'all'): TradeResult {
  if (!known(ticker)) return { state: s0, error: 'Unknown ticker.' };
  const held = sharesOf(s0, ticker);
  if (held <= 0) return { state: s0, error: `You don't own any $${ticker}.` };
  const px = quote(s0, ticker);
  const worth = Math.round(held * px * 100) / 100;
  if (amount !== 'all' && (!Number.isFinite(amount) || amount <= 0)) return { state: s0, error: 'Enter an amount above 0.' };
  const value = amount === 'all' ? worth : Math.round(amount * 100) / 100;
  if (value > worth) return { state: s0, error: `Your $${ticker} is worth ${worth.toFixed(2)} DOLR.` };
  const s = clone(s0);
  const shares = amount === 'all' ? held : round6(value / px);
  const left = round6(held - shares);
  const stocks = { ...s.stocks };
  // the cost basis shrinks with the shares sold
  if (left > 0) stocks[ticker] = { shares: left, cost: Math.round(costOf(s0, ticker) * (left / held) * 100) / 100 }; else delete stocks[ticker];
  s.stocks = stocks;
  money(s, value, `Sherwood · Sold ${shares.toFixed(4)} $${ticker}`);
  return { state: s };
}
