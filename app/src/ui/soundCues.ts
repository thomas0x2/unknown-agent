/*
 * Which sounds a change in the game state calls for. The store tells the UI only that something
 * changed, so we keep a few counters from the last look and compare: one more agent message is a
 * reply, one more ledger entry is money, and so on. New mail and Y posts come from the store's own
 * arrival events instead (GameStore.onArrival, wired in main.ts). Pure, so it is tested without audio.
 */
import type { GameState } from '../engine';
import { CLOCK } from '../engine/config';
import type { Cue } from './sound';

export interface SoundSnap {
  day: number;
  clockMin: number;
  agentMsgs: number;
  /** Ledger entries, and the running totals of money in and money out. */
  txCount: number;
  txIn: number;
  txOut: number;
  pushes: number;
  deploys: number;
  ending: boolean;
  morning: boolean;
}

/** The clock time of the late warning: an hour before the day ends. */
export const LATE_MIN = CLOCK.sleep - 60;

export function soundSnap(s: GameState): SoundSnap {
  let txIn = 0, txOut = 0;
  for (const t of s.tx) { if (t.amount > 0) txIn += t.amount; else txOut -= t.amount; }
  return {
    day: s.values.day,
    clockMin: s.clockMin,
    agentMsgs: s.chat.filter((m) => m.from === 'agent').length,
    txCount: s.tx.length,
    txIn,
    txOut,
    pushes: s.commits.filter((c) => c.kind === 'push').length,
    deploys: s.commits.filter((c) => c.kind === 'deploy').length,
    ending: !!s.ending,
    morning: !!s.morning,
  };
}

/** Cues for going from `a` to `b`, in the order they should play. */
export function soundCues(a: SoundSnap, b: SoundSnap): Cue[] {
  if (b.ending && !a.ending) return ['ending'];
  if (b.ending) return [];
  // any jump but a night's sleep (a loaded save, dev tools) is silent
  if (b.day !== a.day && b.day !== a.day + 1) return [];
  // sleeping: the day ends, and the night's rent and payouts still make their money sounds
  if (b.day !== a.day) return ['dayEnd', ...money(a, b)];
  const out: Cue[] = [];
  if (a.morning && !b.morning) out.push('dayStart');
  if (a.clockMin < LATE_MIN && b.clockMin >= LATE_MIN) out.push('lateWarn');
  if (b.agentMsgs > a.agentMsgs) out.push('reply');
  // a deploy plays its signature sound from the button itself (main.ts), so only a push is heard here
  if (b.pushes > a.pushes && b.deploys === a.deploys) out.push('push');
  out.push(...money(a, b));
  return out;
}

/** Every balance change is heard: money out and money in each have their sound, both if both happened. */
function money(a: SoundSnap, b: SoundSnap): Cue[] {
  if (b.txCount <= a.txCount) return [];
  const out: Cue[] = [];
  if (b.txOut - a.txOut > 0.004) out.push('charge');
  if (b.txIn - a.txIn > 0.004) out.push('income');
  return out;
}
