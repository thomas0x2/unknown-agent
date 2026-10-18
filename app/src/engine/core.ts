/*
 * Low-level helpers the engine steps share. Convention: public engine functions clone the state
 * once (`clone`), then use these mutators on the copy, then return it. Callers never see mutation.
 */
import type { GameState, MailEntry } from './state';
import { type MeterId, clampMeter } from './values';
import { nextRandom } from './rng';
import { CLOCK, AGENT_POLICY } from './config';
import { agentDown, forkyardDown } from './outage';

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
    if (s.flagDays[flag] == null) { s.flagDays[flag] = s.values.day; s.flagMins[flag] = s.clockMin; }
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
  s.tx.push({ day: s.values.day, amount: Math.round(amount * 100) / 100, memo, min: s.clockMin, bal: Math.round(s.values.crypto * 100) / 100 });
}

// ── clock ──
/** Let `minutes` of game time pass (the real-time clock calls this every game minute), never past bedtime. */
export function advanceClock(s: GameState, minutes: number): void {
  s.clockMin = Math.min(CLOCK.sleep, s.clockMin + minutes);
  deliverPendingMail(s);
  deliverAgentWork(s);
  knockIfDue(s);
}

/** A while after GeneralAI suspends the account for misuse, someone is at the door: the run ends. */
export function knockIfDue(s: GameState): void {
  if (!s.suspended || s.ending || gameMinutes(s) < s.suspended.at + AGENT_POLICY.knockAfter) return;
  s.ending = 'caught';
  s.phase = 'ended';
  log(s, `Ending: ${s.ending}`, 'ending');
}

/**
 * The agent's build or fix lands once its time has come: the push goes to Forkyard and its report into
 * the chat. While agent or Forkyard is down it waits, and is pushed overnight.
 */
export function deliverAgentWork(s: GameState, now = false): void {
  const w = s.agentWork;
  if (!w || (!now && (w.at > gameMinutes(s) || agentDown(s) || forkyardDown(s)))) return;
  s.agentWork = null;
  for (const p of w.apps) {
    const a = s.apps.find((x) => x.id === p.id);
    if (!a) continue;
    a.repo = p.repo;
    a.repoVersion += p.bumps;
    if (p.fixed) a.fixed = p.fixed;
  }
  for (const c of w.commits) s.commits.push({ ...c, day: s.values.day });
  s.chat.push({ ...w.reply, day: s.values.day });
}

// ── mail ──
export function pushMail(s: GameState, m: Omit<MailEntry, 'id' | 'seq'>): MailEntry {
  const seq = s.nextId++;
  const entry: MailEntry = { id: `mail${seq}`, seq, min: s.clockMin, ...m };
  s.mail.push(entry);
  return entry;
}

/** Minutes of play since day 1 began: only the waking hours count, so 21:30 plus an hour is 10:30 the next morning. */
export const playMinutes = (s: GameState) => (s.values.day - 1) * (CLOCK.sleep - CLOCK.wake) + (s.clockMin - CLOCK.wake);
/** A minute of play as the day and the clock time it falls on. */
export const playToClock = (p: number) => {
  const len = CLOCK.sleep - CLOCK.wake;
  return { day: Math.floor(p / len) + 1, min: CLOCK.wake + (((p % len) + len) % len) };
};

/** Game time in minutes since day 1 began, so a delay can run past midnight into the next morning. */
export const gameMinutes = (s: GameState) => (s.values.day - 1) * 24 * 60 + s.clockMin;

/** A reply that arrives `delayMin` of game time from now (one game minute is one real second, so 30 is 30 seconds). */
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
