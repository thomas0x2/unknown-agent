/*
 * Coinbin transfers. The player can send DOLR only to wallets the game knows about; anything else is
 * rejected before money moves, so a typo never eats the rent. WALLETS is empty for now: story content
 * adds recipients (a client, a scammer, a darknet seller) as they come into the game.
 */
import type { GameState } from './state';
import { clone, money } from './core';

/** The player's own Coinbin address. */
export const PLAYER_WALLET = '0x4417c3e8b1d05f2a9e6d7b0c1f83a4e5d2b9a9f2';

/** Wallets that exist in the game, by lowercase address. `name` is the memo on the transaction. */
export const WALLETS: Record<string, { name: string }> = {};

/** 0x followed by 40 hex digits, like every address in the game. */
export const isWalletAddress = (a: string) => /^0x[0-9a-f]{40}$/i.test(a.trim());

export interface SendResult { state: GameState; error?: string }

/** Sends `amount` DOLR from the player's wallet to `to`. Returns an error and the unchanged state if it can't. */
export function sendCrypto(s0: GameState, to: string, amount: number): SendResult {
  const addr = to.trim().toLowerCase();
  if (!isWalletAddress(addr)) return { state: s0, error: 'That isn\'t a valid wallet address. Addresses start with 0x and have 40 more characters.' };
  if (addr === PLAYER_WALLET) return { state: s0, error: 'That\'s your own wallet.' };
  const wallet = WALLETS[addr];
  if (!wallet) return { state: s0, error: 'No wallet exists at this address. Check it and try again.' };
  if (!Number.isFinite(amount) || amount <= 0) return { state: s0, error: 'Enter an amount above 0.' };
  const cents = Math.round(amount * 100) / 100;
  if (cents > s0.values.crypto) return { state: s0, error: `Insufficient balance. You have ${s0.values.crypto.toFixed(2)} DOLR.` };
  const s = clone(s0);
  money(s, -cents, `${wallet.name} · Sent`);
  return { state: s };
}
