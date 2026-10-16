/*
 * Low-level helpers the engine steps share. Convention: public engine functions clone the state
 * once (`clone`), then use these mutators on the copy, then return it. Callers never see mutation.
 */
import type { GameState } from './state';
import { type MeterId, clampMeter } from './values';
import { nextRandom } from './rng';

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
