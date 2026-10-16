/*
 * Low-level helpers the engine steps share. Convention: public engine functions clone the state
 * once (`clone`), then use these mutators on the copy, then return it. Callers never see mutation.
 */
import type { GameState, MailEntry } from './state';
import { type MeterId, clampMeter } from './values';
import { nextRandom } from './rng';
import { CLOCK } from './config';

export function clone(state: GameState): GameState {
  return structuredClone(state);
}

// ── flags ──
export function hasFlag(state: GameState, flag: string): boolean {
  return state.flags.includes(flag);
}
export function hasAll(state: GameState, flags: string[]): boolean {
  return flags.every((f) => state.flags.includes(f));
}
export function hasNone(state: GameState, flags: string[]): boolean {
  return !flags.some((f) => state.flags.includes(f));
}
export function addFlag(s: GameState, flag: string): void {
  if (!s.flags.includes(flag)) {
    s.flags.push(flag);
    s.flags.sort();
    if (s.flagDays[flag] == null) s.flagDays[flag] = s.values.day;
  }
}
export function clearFlag(s: GameState, flag: string): void {
  s.flags = s.flags.filter((f) => f !== flag);
}

// ── values ──
export function getValue(state: GameState, id: MeterId): number {
  return state.values[id];
}
export function addValue(s: GameState, id: MeterId, delta: number): void {
  s.values[id] = clampMeter(id, s.values[id] + delta);
}
export function setValue(s: GameState, id: MeterId, value: number): void {
  s.values[id] = clampMeter(id, value);
}
/** Change crypto and record it in the wallet ledger. Memo is "Who · note". */
export function money(s: GameState, amount: number, memo: string): void {
  addValue(s, 'crypto', amount);
  s.tx.push({ day: s.values.day, amount: Math.round(amount * 100) / 100, memo });
}

// ── clock ──
export function tick(s: GameState, _kind?: string): void {
  s.clockMin += CLOCK.perAction; // every action is half an hour
  deliverPendingMail(s);
}

// ── mail ──
export function pushMail(s: GameState, m: Omit<MailEntry, 'id' | 'seq'>): MailEntry {
  const seq = s.nextId++;
  const entry: MailEntry = { id: `mail${seq}`, seq, ...m };
  s.mail.push(entry);
  return entry;
}

/** Game time in minutes since day 1 began, so a delay can run past midnight into the next morning. */
export const gameMinutes = (s: GameState) => (s.values.day - 1) * 24 * 60 + s.clockMin;

/** A reply that arrives `delayMin` of game time from now: with half-hour actions, 30 means after the next action. */
export function sendLater(s: GameState, m: Omit<MailEntry, 'id' | 'seq'>, delayMin: number): void {
  (s.pendingMail ??= []).push({ at: gameMinutes(s) + delayMin, mail: m });
}

/** Move the replies whose time has come into the inbox, dated the day they arrive. */
export function deliverPendingMail(s: GameState): void {
  if (!s.pendingMail?.length) return;
  const now = gameMinutes(s);
  const due = s.pendingMail.filter((p) => p.at <= now).sort((a, b) => a.at - b.at);
  if (!due.length) return;
  s.pendingMail = s.pendingMail.filter((p) => p.at > now);
  for (const p of due) pushMail(s, { ...p.mail, day: s.values.day });
}

// ── log ──
export function log(s: GameState, text: string, kind: GameState['log'][number]['kind'] = 'info'): void {
  s.log.push({ day: s.values.day, text, kind });
}

// ── randomness (deterministic, advances s.rng) ──
export function rand(s: GameState): number {
  const { value, seed } = nextRandom(s.rng);
  s.rng = seed;
  return value;
}
export function chance(s: GameState, p: number): boolean {
  return rand(s) < p;
}
export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}
export function randInt(s: GameState, lo: number, hi: number): number {
  return lo + Math.floor(rand(s) * (hi - lo + 1));
}
