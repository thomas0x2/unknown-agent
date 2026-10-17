/*
 * The trader's stake (his day 7 email). Every DOLR the player sends to his Coinbin wallet is staked in
 * his book. Each send pays out on its own, exactly STAKE.days later at STAKE.payAt, at whatever it is
 * worth then: the send times the book's real value on the payout day over its value on the send day.
 * The real value is the portfolio with real prices and the trades the bot actually made (its auto-buy
 * bugs spend real money); the dashboard's display bugs only change what Vibe Check shows.
 */
import type { GameState, StakeSend } from './state';
import type { Content } from '../content/schema';
import { money, log } from './core';
import { bugsOf, breakVariant } from './apps';
import { marketPosts, ledger, portfolio } from './crawler';

/** deskjockey's Coinbin wallet, listed in WALLETS (engine/wallets.ts). */
export const TRADER_WALLET = '0x5e17a0c94b2d83f6e1a7c05b9d42e38f6a1c0d7b';
export const STAKE = { days: 4, payAt: 12 * 60 };
const NO_BUGS = new Set<string>();

/** The bugs the live auto-buy trades with (the ones that change what it buys); none if it isn't live. */
function tradeBugs(s: GameState, content: Content): Set<string> | null {
  const app = s.apps.find((a) => a.template === 'sentiment' && a.deployed && !a.churned);
  const built = app?.features.find((f) => f.id === 'auto_buy');
  if (!app || !built) return null;
  const bugs = new Set(built.correct ? [] : bugsOf(built));
  const brk = app.breaks.find((b) => b.featureId === 'auto_buy');
  const shown = brk && breakVariant(brk, content.apps[app.template]?.features.find((f) => f.id === 'auto_buy'));
  if (shown) bugs.add(shown);
  return bugs;
}

/** What the trader's book is really worth at the close of `day`. */
export function bookValue(s: GameState, content: Content, day: number): number {
  const bugs = tradeBugs(s, content);
  // without a live auto-buy the book holds only the trader's own trades
  const buys = ledger(marketPosts(s, content), day, bugs ?? new Set(['no_buy']));
  return portfolio(buys, day, NO_BUGS).total;
}

/** The day a send pays out. */
export const payDay = (x: StakeSend) => x.day + STAKE.days;

/** A send's real worth on `day` (its payout once it's paid). */
export function stakeWorth(s: GameState, content: Content, x: StakeSend, day = s.values.day): number {
  if (x.paid != null) return x.paid;
  return Math.round(x.amount * (bookValue(s, content, day) / bookValue(s, content, x.day)) * 100) / 100;
}

/** After a Coinbin send to the trader: it's staked from now on. */
export function recordStake(s: GameState, to: string, amount: number): void {
  if (to.trim().toLowerCase() !== TRADER_WALLET || !(amount > 0)) return;
  (s.stakes ??= []).push({ day: s.values.day, min: s.clockMin, amount: Math.round(amount * 100) / 100 });
}

/** On the clock: every send whose payout time has come goes back to the player's wallet at its value now. */
export function payStakes(s: GameState, content: Content): boolean {
  let paid = false;
  for (const x of s.stakes ?? []) {
    const due = payDay(x);
    if (x.paid != null || s.values.day < due || (s.values.day === due && s.clockMin < STAKE.payAt)) continue;
    const worth = stakeWorth(s, content, x, Math.min(due, s.values.day));
    x.paid = worth;
    money(s, worth, 'deskjockey · Stake payout');
    log(s, `Stake paid out: ${worth.toFixed(2)} DOLR (staked ${x.amount.toFixed(2)}).`, 'info');
    paid = true;
  }
  return paid;
}
