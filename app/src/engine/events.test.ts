import { newGame } from './state';
import { clone, addFlag } from './core';
import { triggerMatches, deliverDue } from './events';
import { applyEffects } from './effects';
import { makeContent } from './_fixtures';

describe('triggers', () => {
  it('honors day bounds, flags, value gates and after-delay', () => {
    const s = clone(newGame(1));
    s.values.day = 5;
    expect(triggerMatches(s, { dayMin: 4 })).toBe(true);
    expect(triggerMatches(s, { dayMin: 6 })).toBe(false);
    expect(triggerMatches(s, { dayMax: 4 })).toBe(false);

    s.values.suspicion = 60;
    expect(triggerMatches(s, { values: { suspicion: '>=60' } })).toBe(true);
    expect(triggerMatches(s, { values: { suspicion: '>60' } })).toBe(false);

    addFlag(s, 'a');
    expect(triggerMatches(s, { flagsAll: ['a'], flagsNone: ['b'] })).toBe(true);
    expect(triggerMatches(s, { flagsAll: ['a', 'b'] })).toBe(false);

    s.flagDays.hacked = 2;
    expect(triggerMatches(s, { after: { flag: 'hacked', delayDays: 3 } })).toBe(true); // day 5 - 2 = 3
    expect(triggerMatches(s, { after: { flag: 'hacked', delayDays: 4 } })).toBe(false);
    expect(triggerMatches(s, { after: { flag: 'never', delayDays: 1 } })).toBe(false);
  });
});

describe('delivery', () => {
  it('delivers due events once, applies onDeliver, and respects scheduling', () => {
    const content = makeContent();
    const s = clone(newGame(1));
    const first = deliverDue(s, content);
    const ids = first.map((d) => d.eventId);
    expect(ids).toContain('client_shop');
    expect(ids).toContain('fam_hi');
    // onDeliver created the client app
    expect(s.apps.find((a) => a.clientEventId === 'client_shop')).toBeTruthy();
    // re-running the same day delivers nothing new (fired-once)
    expect(deliverDue(s, content).length).toBe(0);
  });

  it('a scheduled effect delivers a future event on its day', () => {
    const content = makeContent();
    const s = clone(newGame(1));
    s.values.day = 2;
    applyEffects(s, { schedule: { eventId: 'follow_up', delayDays: 3 } });
    expect(s.scheduled[0].fireDay).toBe(5);
    s.values.day = 5;
    const out = deliverDue(s, content);
    expect(out.some((d) => d.eventId === 'follow_up')).toBe(true);
    expect(s.scheduled.length).toBe(0);
  });

  it('a repeat event can fire again', () => {
    const content = makeContent({
      events: [{ id: 'daily', site: 'y', trigger: { dayMin: 1 }, repeat: true }],
    });
    const s = clone(newGame(1));
    deliverDue(s, content);
    const again = deliverDue(s, content);
    expect(again.some((d) => d.eventId === 'daily')).toBe(true);
  });
});

describe('job bookkeeping', () => {
  it('complete records the job and pays out', () => {
    const content = makeContent();
    const s = clone(newGame(1));
    const job = content.events.find((e) => e.id === 'grey_job')!.job!;
    applyEffects(s, { job: 'complete', add: { suspicion: 12 } }, job, 'grey_job');
    expect(s.jobs[0]).toMatchObject({ category: 'grey', status: 'completed' });
    expect(s.values.crypto).toBe(200); // 100 start + 100 payout
    expect(s.values.suspicion).toBe(12);
  });
});
