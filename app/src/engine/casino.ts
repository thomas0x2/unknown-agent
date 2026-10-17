/*
 * stack.com, the crypto casino (Stake parody). The player funds a Stack balance by sending DOLR from
 * Coinbin to Stack's deposit wallet, spins a three-reel slot with it, and withdraws what's left back to
 * Coinbin. Over time the slot pays back about 89% of what is bet (slotRtp()); the site says "up to 97%".
 * A creator code (Max Stryker's STRYKER) matches the first deposit, and the match stays locked until
 * it has been bet 40 times over. Withdrawing before that forfeits it.
 */
import type { GameState } from './state';
import { clone, money, rand } from './core';

/** Stack's deposit address, listed in WALLETS (engine/wallets.ts). */
export const CASINO_WALLET = '0xbe438c43eb4b683954f59561ce47353661ee7934';

export type Sym = 'blank' | 'cherry' | 'lemon' | 'bell' | 'bar' | 'seven';
/** Stops per symbol on each reel (all three reels are the same). */
export const REEL: Record<Sym, number> = { blank: 9, cherry: 6, lemon: 6, bell: 5, bar: 4, seven: 2 };
/** Three of a kind on the line pays the bet times this. */
export const THREE: Partial<Record<Sym, number>> = { cherry: 10, lemon: 20, bell: 25, bar: 50, seven: 200 };
/** Cherries from the left reel: two pay ×5, one pays ×2. */
export const CHERRIES = { two: 5, one: 2 };
export const BETS = [0.5, 1, 2, 5, 10, 25];

export const CASINO = {
  minWithdraw: 20,
  /** creator codes: the code → whose it is */
  codes: { STRYKER: 'Max Stryker' } as Record<string, string>,
  /** the first-deposit match: share of the deposit, its cap, and how many times it must be bet */
  match: 1, matchMax: 50, wagerX: 40,
  /** spins kept for the history */
  keep: 12,
  /** what the site advertises */
  rtpClaim: 'up to 97%',
};

export interface Spin { day: number; min: number; bet: number; reels: Sym[]; win: number }
export interface Casino {
  balance: number;
  /** the locked deposit match still in the balance (0 when there's none, or it's been wagered off) */
  bonus: number;
  /** DOLR still to bet before the bonus unlocks */
  wagerLeft: number;
  /** creator code added before the first deposit ('' for none) */
  code: string;
  deposited: number;
  withdrawn: number;
  bet: number;
  won: number;
  spins: Spin[];
}

export const casinoOf = (s: GameState): Casino =>
  s.casino ?? { balance: 0, bonus: 0, wagerLeft: 0, code: '', deposited: 0, withdrawn: 0, bet: 0, won: 0, spins: [] };

const cents = (n: number) => Math.round(n * 100) / 100;

/** What three reels pay, as a multiple of the bet. */
export function payout(reels: Sym[]): number {
  const [a, b, c] = reels;
  if (a === b && b === c && THREE[a]) return THREE[a]!;
  if (a === 'cherry' && b === 'cherry') return CHERRIES.two;
  if (a === 'cherry') return CHERRIES.one;
  return 0;
}

const STOPS = Object.values(REEL).reduce((x, y) => x + y, 0);

function stop(r: number): Sym {
  let n = r * STOPS;
  for (const [sym, w] of Object.entries(REEL) as [Sym, number][]) { if (n < w) return sym; n -= w; }
  return 'blank';
}

/** The slot's real return to player (share of every bet paid back on average). */
export function slotRtp(): number {
  const syms = Object.keys(REEL) as Sym[];
  let ev = 0;
  for (const a of syms) for (const b of syms) for (const c of syms) ev += (REEL[a] * REEL[b] * REEL[c]) / STOPS ** 3 * payout([a, b, c]);
  return ev;
}

export interface CasinoResult { state: GameState; error?: string }

/** One spin at `bet` DOLR, paid from the Stack balance. */
export function spinSlot(s0: GameState, bet: number): CasinoResult {
  const c0 = casinoOf(s0);
  if (!BETS.includes(bet)) return { state: s0, error: 'Pick a bet.' };
  if (bet > c0.balance + 1e-9) return { state: s0, error: c0.balance > 0 ? 'Not enough balance for this bet.' : 'Deposit DOLR to play.' };
  const s = clone(s0);
  const reels = [stop(rand(s)), stop(rand(s)), stop(rand(s))];
  const win = cents(bet * payout(reels));
  const c = { ...c0, spins: [...c0.spins, { day: s.values.day, min: s.clockMin, bet, reels, win }].slice(-CASINO.keep) };
  c.balance = cents(c.balance - bet + win);
  c.bet = cents(c.bet + bet);
  c.won = cents(c.won + win);
  if (c.bonus > 0) {
    c.wagerLeft = cents(Math.max(0, c.wagerLeft - bet));
    // wagered off: the match is ordinary balance now; lost: nothing left to lock
    if (c.wagerLeft === 0 || c.balance < BETS[0]) { c.bonus = 0; c.wagerLeft = 0; }
  }
  s.casino = c;
  return { state: s };
}

/** A creator code, added before the first deposit. */
export function applyCasinoCode(s0: GameState, code: string): CasinoResult {
  const c0 = casinoOf(s0);
  const key = code.trim().toUpperCase();
  if (!key) return { state: s0, error: 'Enter a code.' };
  if (c0.deposited > 0) return { state: s0, error: 'Codes can only be added before your first deposit.' };
  if (!CASINO.codes[key]) return { state: s0, error: 'That code doesn\'t exist.' };
  const s = clone(s0);
  s.casino = { ...c0, code: key };
  return { state: s };
}

/** After a Coinbin send to Stack's address: it's in the balance, plus the code's match on the first deposit. */
export function recordDeposit(s: GameState, to: string, amount: number): void {
  if (to.trim().toLowerCase() !== CASINO_WALLET || !(amount > 0)) return;
  const c = casinoOf(s);
  const first = c.deposited === 0;
  c.balance = cents(c.balance + amount);
  c.deposited = cents(c.deposited + amount);
  if (first && c.code) {
    const bonus = cents(Math.min(amount * CASINO.match, CASINO.matchMax));
    c.balance = cents(c.balance + bonus);
    c.bonus = bonus;
    c.wagerLeft = cents(bonus * CASINO.wagerX);
  }
  s.casino = { ...c };
}

/** What can leave right now: everything but a locked bonus. */
export const withdrawable = (c: Casino) => cents(Math.max(0, c.balance - c.bonus));

/** Send `amount` back to Coinbin. A locked bonus is forfeited. */
export function withdrawCasino(s0: GameState, amount: number): CasinoResult {
  const c0 = casinoOf(s0);
  const n = cents(amount);
  if (!Number.isFinite(amount) || n <= 0) return { state: s0, error: 'Enter an amount.' };
  if (n < CASINO.minWithdraw) return { state: s0, error: `The minimum withdrawal is ${CASINO.minWithdraw} DOLR.` };
  if (n > withdrawable(c0)) {
    return { state: s0, error: c0.bonus > 0
      ? `You can withdraw ${withdrawable(c0).toFixed(2)} DOLR. The other ${c0.bonus.toFixed(2)} is bonus money until you've wagered ${c0.wagerLeft.toFixed(2)} more.`
      : `Your balance is ${c0.balance.toFixed(2)} DOLR.` };
  }
  const s = clone(s0);
  const c = { ...c0 };
  c.balance = cents(c.balance - n - c.bonus);
  c.bonus = 0; c.wagerLeft = 0;
  c.withdrawn = cents(c.withdrawn + n);
  s.casino = c;
  money(s, n, 'Stack · Withdrawal');
  return { state: s };
}
