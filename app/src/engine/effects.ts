/*
 * Applies an Effects object to the state. This is the only vocabulary events and outcomes have;
 * Jev picks an outcome, the engine runs its effects. Mutates a cloned state.
 */
import type { GameState } from './state';
import type { Effects, JobSpec } from '../content/schema';
import { addValue, addFlag, clearFlag } from './core';
import { registerApp } from './apps';
import type { MeterId } from './values';

export function applyEffects(s: GameState, effects?: Effects, job?: JobSpec, eventId?: string): void {
  if (!effects) return;
  if (effects.add) {
    for (const [id, delta] of Object.entries(effects.add)) {
      if (delta != null) addValue(s, id as MeterId, delta);
    }
  }
  for (const f of effects.setFlags ?? []) addFlag(s, f);
  for (const f of effects.clearFlags ?? []) clearFlag(s, f);
  if (effects.schedule) {
    const list = Array.isArray(effects.schedule) ? effects.schedule : [effects.schedule];
    for (const sch of list) s.scheduled.push({ eventId: sch.eventId, fireDay: s.values.day + sch.delayDays });
  }
  if (effects.createApp) registerApp(s, effects.createApp);
  if (effects.job && job) {
    const status = effects.job === 'complete' ? 'completed' : effects.job === 'fail' ? 'failed' : 'accepted';
    s.jobs.push({ eventId: eventId ?? '', category: job.category, payout: job.payout, dueDay: job.dueDay, status, takenDay: s.values.day });
    if (status === 'completed') addValue(s, 'crypto', job.payout);
  }
}
