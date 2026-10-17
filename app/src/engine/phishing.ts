/*
 * The day 3 phishing mail. It links to coinbln.com, a copy of Coinbin's sign-in page. The player's
 * real Coinbin password (it's in passwords.txt on Qdrive) empties the wallet; anything else gets an
 * ordinary "incorrect password" error, like a real sign-in page would.
 */
import type { GameState } from './state';
import { clone, money, addFlag } from './core';

/** The lookalike domain the mail links to. */
export const PHISH_DOMAIN = 'coinbln.com';
/** Set once the player has typed their password into the fake page. */
export const HACKED_FLAG = 'coinbin_hacked';
/** Where the money goes. Shown in Coinbin's operations list like any other address. */
export const PHISH_WALLET = '0x9c1fd27a40e6b3518f0c2ad97e45b61c03d8e07b';

/** passwords.txt on Qdrive: every account the player is signed in to. */
export const PASSWORDS: { site: string; login: string; password: string }[] = [
  { site: 'Qmail', login: 'you@qmail.com', password: 'pinestreet4B' },
  { site: 'Qdrive', login: 'you@qmail.com', password: 'same as Qmail' },
  { site: 'Coinbin', login: 'you@qmail.com', password: 'Coinbin4B!' },
  { site: 'Y', login: '@you', password: 'pinestreet4B!' },
  { site: 'Yowl', login: 'you@qmail.com', password: 'pinestreet4B' },
  { site: 'Forkyard', login: 'you', password: 'pinestreet4B' },
  { site: 'agent.chat', login: 'you@qmail.com', password: 'pinestreet4B' },
];
export const COINBIN_PASSWORD = PASSWORDS.find((p) => p.site === 'Coinbin')!.password;

export const PASSWORDS_TXT = `passwords
don't lose this

${PASSWORDS.map((p) => (p.password.startsWith('same as') ? `${p.site}: ${p.password}` : `${p.site}: ${p.login} / ${p.password}`)).join('\n')}

Vantor: EmployeeQ3! (stopped working Oct 3)`;

export const hacked = (s: GameState) => s.flags.includes(HACKED_FLAG);

export interface PhishResult { state: GameState; error?: string }

/** The fake sign-in. The right password sends every DOLR in the wallet to PHISH_WALLET. */
export function phishLogin(s0: GameState, password: string): PhishResult {
  if (hacked(s0)) return { state: s0 };
  if (!password) return { state: s0, error: 'Enter your password.' };
  if (password !== COINBIN_PASSWORD) return { state: s0, error: 'Incorrect password. Try again.' };
  const s = clone(s0);
  const all = Math.round(s.values.crypto * 100) / 100;
  if (all > 0) money(s, -all, `${PHISH_WALLET.slice(0, 6)}…${PHISH_WALLET.slice(-4)} · Sent`);
  addFlag(s, HACKED_FLAG);
  return { state: s };
}

/*
 * prince-claims.xyz, from the Crypto Prince banner ad: "paste your seed phrase to claim 5,000 DOLR".
 * The phrase is on Coinbin (Show recovery phrase). The real one empties the wallet like the fake
 * sign-in does; anything else gets "not a valid seed phrase".
 */
/** The player's Coinbin recovery phrase. */
export const SEED_PHRASE = 'harbor violet cushion ladder amber pilot noodle forest rent sugar orbit velvet';
/** Set once the player has pasted the phrase into the prize page. */
export const SEED_FLAG = 'seed_stolen';
/** Where the prize page sends the money. */
export const PRINCE_WALLET = '0x5e7a0c19b4d2f8a63e10c97b2d48fa61e93c0a2d';

export const seedStolen = (s: GameState) => s.flags.includes(SEED_FLAG);

/** Spacing, case and line breaks don't matter, the words and their order do. */
const words = (s: string) => s.trim().toLowerCase().split(/[\s,]+/).filter(Boolean).join(' ');

/** The prize claim. The right phrase sends every DOLR in the wallet to PRINCE_WALLET. */
export function seedClaim(s0: GameState, phrase: string): PhishResult {
  if (seedStolen(s0)) return { state: s0 };
  if (!words(phrase)) return { state: s0, error: 'Paste your 12-word seed phrase to claim.' };
  if (words(phrase) !== SEED_PHRASE) return { state: s0, error: 'That is not a valid seed phrase. Check your wallet and try again.' };
  const s = clone(s0);
  const all = Math.round(s.values.crypto * 100) / 100;
  if (all > 0) money(s, -all, `${PRINCE_WALLET.slice(0, 6)}…${PRINCE_WALLET.slice(-4)} · Sent`);
  addFlag(s, SEED_FLAG);
  return { state: s };
}
