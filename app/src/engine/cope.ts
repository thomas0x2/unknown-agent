/*
 * $COPE, Dex Calloway's memecoin. Dex hires the player for its site (a countdown to the launch and the
 * tokenomics); when the countdown runs out he asks them to create the token on Coinbin, and it trades
 * from the next day. The wallet that created it holds the "founding engineer" allocation, locked until
 * a date the price never reaches: Dex pulls the liquidity the day before. The price is scripted by day
 * like the other coins (engine/exchange.ts), so every run climbs and falls the same way.
 */
import type { GameState } from './state';
import { clone, money, addFlag, hasFlag } from './core';
import { dateShort } from './calendar';

export const COPE = {
  ticker: 'COPE',
  /** The address Dex reserved for the contract. */
  address: '0xc0be7a19d4e25f6b8a03c1d97e4f2b5a6c8d0e13',
  supply: 1_000_000_000,
  /** The countdown on Dex's site runs out at noon on day 6 (Saturday, Oct 12). */
  launchDay: 6,
  launchMin: 12 * 60,
  /** Trades on Coinbin from this day. */
  listDay: 7,
  /** Dex pulls the liquidity this morning. */
  rugDay: 23,
  /** The founding engineer's allocation unlocks this day (Wednesday, Oct 30). */
  unlockDay: 24,
  /** The founding engineer's share: 5% of the supply. */
  allocation: 50_000_000,
  /** Coinbin's fee for creating and listing a token, in DOLR. */
  fee: 15,
} as const;

/** DOLR per COPE at the listing: the allocation is worth 100 DOLR on day 7. */
const LIST_RATE = 0.000002;
/** Daily moves after the listing, days 8 to 22: the shills work. */
export const COPE_SCRIPT = [0.4, 0.7, -0.1, 0.9, 0.5, 0.3, -0.15, 1.0, 0.35, 0.6, -0.2, 0.7, 0.5, 0.35, 0.25];
/** After the rug: what is left. 50 million COPE are worth half a DOLR, under the exchange minimum. */
const RUG_RATE = 0.00000001;

/** COPE's DOLR price at a day's close. 0 before it trades. */
export function copeRate(day: number): number {
  if (day < COPE.listDay) return 0;
  if (day >= COPE.rugDay) return RUG_RATE;
  let p = LIST_RATE;
  for (let d = COPE.listDay + 1; d <= day; d++) p *= 1 + (COPE_SCRIPT[d - COPE.listDay - 1] ?? 0);
  return p;
}

/** Trading on Coinbin yet. */
export const copeListed = (day: number) => day >= COPE.listDay;

/** The wallet that created $COPE can't move its COPE until the unlock day. */
export function copeLocked(s: GameState): boolean {
  return hasFlag(s, 'cope_deployer') && s.values.day < COPE.unlockDay;
}
export const copeLockNote = () => `Locked until ${dateShort(COPE.unlockDay)}`;

/** Dex has asked for the token and it doesn't exist yet: Coinbin offers Create token. */
export const canCreateCope = (s: GameState) => hasFlag(s, 'dex_contract_ask') && !hasFlag(s, 'cope_created') && !hasFlag(s, 'cope_other_dev');

export interface CreateResult { state: GameState; error?: string }

/**
 * Creates the token at the reserved address: it has to be set up the way Dex reserved it (ticker and
 * supply), Coinbin takes its fee, and the founding engineer's allocation lands in the wallet, locked.
 */
export function createToken(s0: GameState, ticker: string, supply: number): CreateResult {
  if (!canCreateCope(s0)) return { state: s0, error: 'No contract address is reserved for your wallet.' };
  const t = ticker.trim().replace(/^\$/, '').toUpperCase();
  if (!t) return { state: s0, error: 'Enter a ticker.' };
  if (t !== COPE.ticker) return { state: s0, error: `No address is reserved for $${t} in your wallet.` };
  if (!Number.isFinite(supply) || supply <= 0) return { state: s0, error: 'Enter the total supply.' };
  if (Math.round(supply) !== COPE.supply) return { state: s0, error: 'The reserved address was set up for a different supply.' };
  if (s0.values.crypto < COPE.fee) return { state: s0, error: `Creating a token costs ${COPE.fee.toFixed(2)} DOLR. You have ${s0.values.crypto.toFixed(2)}.` };
  const s = clone(s0);
  money(s, -COPE.fee, `Coinbin · Token listing fee · $${COPE.ticker}`);
  s.coins = { ...s.coins, COPE: (s.coins.COPE ?? 0) + COPE.allocation };
  coinTx(s, `$${COPE.ticker} contract`, `${COPE.allocation.toLocaleString('en-US')} COPE`);
  addFlag(s, 'cope_created');
  addFlag(s, 'cope_deployer');
  return { state: s };
}

/** A wallet entry that moves a coin other than DOLR: the note's last part is what came in. */
export function coinTx(s: GameState, who: string, got: string): void {
  s.tx.push({ day: s.values.day, amount: 0, memo: `${who} · ${got}`, min: s.clockMin, bal: Math.round(s.values.crypto * 100) / 100 });
}

// ── Dex's site (the coinsite app template): what it shows, so the renderer and visibility agree ──

/** The countdown on the site: the time it counts to, and what it reads at `day`/`min`. */
export function countdownView(bugs: Set<string>, day: number, min: number, deployed?: { day: number; min: number }): { target: string; text: string; live: boolean } {
  const targetDay = bugs.has('wrong_target') ? COPE.launchDay + 1 : COPE.launchDay;
  // frozen: it rendered once, at the deploy, and never again
  const at = bugs.has('frozen') && deployed ? deployed : { day, min };
  const left = (targetDay - at.day) * 1440 + COPE.launchMin - at.min;
  const target = `${dateShort(targetDay)}, 12:00 PM`;
  if (left > 0 || (left <= 0 && bugs.has('negative'))) {
    const m = Math.abs(left);
    const text = `${left < 0 ? '−' : ''}${Math.floor(m / 1440)}d ${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}h ${String(m % 60).padStart(2, '0')}m`;
    return { target, text, live: false };
  }
  return { target, text: `$${COPE.ticker} is live`, live: true };
}

/** The contract address as the site shows it: two characters swapped, or cut short. */
export function siteAddress(address: string, bugs: Set<string>, seed: number): string {
  let a = address;
  if (bugs.has('address_wrong')) {
    const i = 6 + (seed % 30);
    a = a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2);
    if (a === address) a = a.slice(0, i) + (a[i] === 'f' ? 'e' : 'f') + a.slice(i + 1);
  }
  return bugs.has('address_cut') ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export interface AllocRow { name: string; pct: number }
/** The allocation rows from the spec ("Liquidity 40%, Congregation 30%, ..."), as the site lists them. */
export function siteAllocation(shares: string, bugs: Set<string>): AllocRow[] {
  const rows = shares.split(',').map((x) => x.trim().match(/^(.*?)\s+(\d+(?:\.\d+)?)%$/)).filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1], pct: Number(m[2]) }));
  if (bugs.has('shares_wrong') && rows.length >= 2) [rows[0].pct, rows[1].pct] = [rows[1].pct, rows[0].pct];
  if (bugs.has('sum_over') && rows.length >= 2) rows.splice(rows.length - 1, 0, { ...rows[rows.length - 2] });
  return rows;
}
export const siteSupply = (supply: string, bugs: Set<string>) => (bugs.has('supply_wrong') ? supply.replace(/,000$/, '') : supply);
export const siteLock = (lock: string, bugs: Set<string>) => (bugs.has('lock_wrong') ? dateShort(COPE.launchDay + 1) : lock);
