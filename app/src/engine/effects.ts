/*
 * Applies an Effects object to the state. This is the only vocabulary events and outcomes have;
 * Jev picks an outcome, the engine runs its effects. Mutates a cloned state.
 */
import type { GameState } from './state';
import type { Effects, JobSpec } from '../content/schema';
import { addValue, addFlag, clearFlag, money } from './core';
import { registerApp, scriptedBreak, bugsOf } from './apps';
import type { MeterId } from './values';
import { coinTx } from './cope';

/** The last day a job can be done: `dueAfter` days after its offer arrived, else its `dueDay`. */
export function jobDue(s: GameState, job: JobSpec, eventId?: string): number {
  if (job.dueAfter == null) return job.dueDay;
  const d = s.delivered.find((x) => x.eventId === eventId);
  return (d?.day ?? s.values.day) + job.dueAfter;
}

export function applyEffects(s: GameState, effects?: Effects, job?: JobSpec, eventId?: string): void {
  if (!effects) return;
  if (effects.add) {
    for (const [id, delta] of Object.entries(effects.add)) {
      if (delta == null) continue;
      if (id === 'crypto') money(s, delta, 'Transfer');
      else addValue(s, id as MeterId, delta);
    }
  }
  for (const [id, pct] of Object.entries(effects.addPct ?? {})) {
    if (!pct) continue;
    const cur = id === 'crypto' ? s.values.crypto : s.values[id as MeterId];
    const delta = Math.round(cur * pct);
    if (id === 'crypto') money(s, delta, 'Transfer');
    else addValue(s, id as MeterId, delta);
  }
  for (const f of effects.setFlags ?? []) addFlag(s, f);
  for (const f of effects.clearFlags ?? []) clearFlag(s, f);
  if (effects.schedule) {
    const list = Array.isArray(effects.schedule) ? effects.schedule : [effects.schedule];
    for (const sch of list) s.scheduled.push({ eventId: sch.eventId, fireDay: s.values.day + sch.delayDays });
  }
  if (effects.createApp) registerApp(s, effects.createApp);
  if (effects.updateApp) {
    const up = effects.updateApp;
    const app = s.apps.find((a) => a.clientEventId === up.client);
    if (app) {
      for (const f of up.add) {
        if (!app.required.includes(f.id)) app.required.push(f.id);
        if (f.params) {
          const changed = JSON.stringify(app.specParams[f.id] ?? null) !== JSON.stringify(f.params);
          app.specParams[f.id] = f.params;
          // the client changed what this feature should say: what's built (and live) is now out of date
          // a build that already has a bug gets 'outdated' on top, so the change can still be asked for
          if (changed) for (const b of [...app.repo, ...app.features]) {
            if (b.id !== f.id || bugsOf(b).includes('outdated')) continue;
            if (b.correct || !b.variant) Object.assign(b, { correct: false, variant: 'outdated', also: undefined });
            else b.also = [...(b.also ?? []), 'outdated'];
          }
        }
      }
    }
  }
  if (effects.raisePay) {
    const app = s.apps.find((a) => a.clientEventId === effects.raisePay!.client);
    if (app) app.payPerDay = Math.max(0, app.payPerDay + effects.raisePay.by);
  }
  if (effects.coins) {
    for (const [coin, n] of Object.entries(effects.coins.add)) {
      s.coins = { ...s.coins, [coin]: (s.coins?.[coin] ?? 0) + n };
      coinTx(s, effects.coins.from, `${n.toLocaleString('en-US')} ${coin}`);
    }
  }
  if (effects.dropClient) {
    const app = s.apps.find((a) => a.clientEventId === effects.dropClient);
    if (app) app.churned = true;
  }
  if (effects.breakApp) scriptedBreak(s, typeof effects.breakApp === 'object' ? effects.breakApp.appId : undefined);
  if (effects.job && job) {
    const status = effects.job === 'complete' ? 'completed' : effects.job === 'fail' ? 'failed' : 'accepted';
    s.jobs.push({ eventId: eventId ?? '', category: job.category, payout: job.payout, dueDay: jobDue(s, job, eventId), status, takenDay: s.values.day });
    if (status === 'completed') money(s, job.payout, 'Job · payout');
  }
}
