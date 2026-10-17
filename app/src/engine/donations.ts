/*
 * crane2026.vote, from Randall Crane's banner ad: the page's one working button donates 5 DOLR from
 * Coinbin to the Crane Victory Fund. It can be pressed as often as the wallet allows. Only the first
 * donation moves the Heritage Party's opinion of the player; after that they're just money.
 */
import type { GameState } from './state';
import { clone, money, addValue } from './core';

export const CRANE_DONATION = 5;
/** What the first donation adds to the heritageStanding meter. */
export const FIRST_DONATION_STANDING = 10;
const MEMO = 'Crane Victory Fund · Donation';

/** Donations the player has made to Crane, counted from the Coinbin history. */
export const craneDonations = (s: GameState) => s.tx.filter((x) => x.memo === MEMO).length;

export function donateCrane(s0: GameState): { state: GameState; error?: string } {
  if (s0.values.crypto < CRANE_DONATION) return { state: s0, error: `Your wallet doesn't have ${CRANE_DONATION} DOLR.` };
  const s = clone(s0);
  if (craneDonations(s) === 0) addValue(s, 'heritageStanding', FIRST_DONATION_STANDING);
  money(s, -CRANE_DONATION, MEMO);
  return { state: s };
}
