/*
 * Which sounds a change in the game state calls for. The store tells the UI only that something
 * changed, so we keep a few counters from the last look and compare: one more agent message is a
 * reply, one more inbox email is mail, and so on. Pure, so it is tested without audio.
 */
import type { GameState } from '../engine';
import { CLOCK } from '../engine/config';
import type { Cue } from './sound';

export interface SoundSnap {
  day: number;
  clockMin: number;
  agentMsgs: number;
  inbox: number;
  posts: number;
  txCount: number;
  txTotal: number;
  pushes: number;
  deploys: number;
  ending: boolean;
  morning: boolean;
}

/** The clock time of the late warning: an hour before the day ends. */
export const LATE_MIN = CLOCK.sleep - 60;

export function soundSnap(s: GameState): SoundSnap {
  let txTotal = 0;
  for (const t of s.tx) txTotal += t.amount;
  return {
    day: s.values.day,
    clockMin: s.clockMin,
    agentMsgs: s.chat.filter((m) => m.from === 'agent').length,
    inbox: s.mail.filter((m) => m.folder === 'inbox').length + s.delivered.filter((d) => d.site === 'qmail').length,
    // other people's Y posts: story posts and replies (the player's own posts are in userPosts)
    posts: s.delivered.filter((d) => d.site === 'y').length + s.yExtra.length,
    txCount: s.tx.length,
    txTotal,
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
  // sleeping covers the night's rent, payouts and mail; any other jump (a loaded save, dev tools) is silent
  if (b.day !== a.day) return b.day === a.day + 1 ? ['dayEnd'] : [];
  const out: Cue[] = [];
  if (a.morning && !b.morning) out.push('dayStart');
  if (a.clockMin < LATE_MIN && b.clockMin >= LATE_MIN) out.push('lateWarn');
  if (b.agentMsgs > a.agentMsgs) out.push('reply');
  // a deploy plays its signature sound from the button itself (main.ts), so only a push is heard here
  if (b.pushes > a.pushes && b.deploys === a.deploys) out.push('push');
  if (b.inbox > a.inbox) out.push('mail');
  if (b.posts > a.posts) out.push('post');
  if (b.txCount > a.txCount) {
    const net = b.txTotal - a.txTotal;
    if (net < -0.004) out.push('charge');
    else if (net > 0.004) out.push('income');
  }
  return out;
}
