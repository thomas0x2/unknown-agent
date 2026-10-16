/*
 * Timed arrivals: the morning picks the day's emails and posts, and each lands at its own time of day
 * as the clock reaches it. One left over when the day ends early comes first thing the next morning.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame, endDay } from './day';
import { advanceClock } from './core';
import { deliverArrivals, deliverDue, arrivalMin } from './events';
import { CLOCK } from './config';

const content = loadContent();
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const has = (s: ReturnType<typeof startGame>, id: string) => s.delivered.some((d) => d.eventId === id);

describe('timed arrivals', () => {
  it('day 1 opens with the termination email; Mom writes later in the morning', () => {
    const s = startGame(content, 7);
    expect(has(s, 'd1_hr_termination')).toBe(true);
    expect(has(s, 'd1_mom')).toBe(false);
    expect(s.arriving?.some((a) => a.eventId === 'd1_mom')).toBe(true);
    advanceClock(s, at('11:20') - s.clockMin);
    const landed = deliverArrivals(s, content);
    expect(landed.map((d) => d.eventId)).toContain('d1_mom');
    expect(s.delivered.find((d) => d.eventId === 'd1_mom')?.min).toBe(at('11:20'));
    expect(s.arriving?.some((a) => a.eventId === 'd1_mom')).toBe(false);
  });

  it('applies onDeliver effects when the email lands, not in the morning', () => {
    let s = startGame(content, 7);
    for (let i = 0; i < 5; i++) s = { ...endDay(s, content), morning: null };
    s.flags.push('gift_own');
    s.arriving = [];
    s.fired = s.fired.filter((f) => !f.startsWith('d6_mom'));
    s.delivered = s.delivered.filter((d) => !d.eventId.startsWith('d6_mom'));
    const before = s.values.crypto;
    deliverDue(s, content);
    expect(s.values.crypto).toBe(before); // Mom's thank-you (with 25 DOLR) isn't here yet
    s.clockMin = at('12:20');
    deliverArrivals(s, content);
    expect(has(s, 'd6_mom_bday_own')).toBe(true);
    expect(s.values.crypto).toBe(before + 25);
  });

  it('every story email and post has an arrival time inside the day', () => {
    for (const ev of content.events) {
      if (ev.latent && ev.id !== 'd5_coffee_backlash') continue;
      expect(ev.at, ev.id).toMatch(/^\d\d:\d\d$/);
      const m = arrivalMin(ev);
      expect(m, ev.id).toBeGreaterThanOrEqual(CLOCK.wake);
      // a reply can still go out after it lands
      expect(m, ev.id).toBeLessThanOrEqual(CLOCK.sleep - 120);
    }
  });

  it('an email still on its way when the day ends lands the next morning and gets a full day before it lapses', () => {
    const s0 = startGame(content, 7);
    // sleep straight away: Mom's email never arrived on day 1
    const s1 = endDay(s0, content);
    const mom = s1.delivered.find((d) => d.eventId === 'd1_mom');
    expect(mom).toMatchObject({ day: 2, answered: false, min: CLOCK.wake });
    expect(s1.values.familyTrust).toBe(s0.values.familyTrust);
    const s2 = endDay(s1, content);
    expect(s2.delivered.find((d) => d.eventId === 'd1_mom')?.outcomeId).toBe('no_reply');
  });

  it('dev delivery lands everything due today at once', () => {
    const s = startGame(content, 7);
    deliverDue(s, content, { now: true });
    expect(has(s, 'd1_mom')).toBe(true);
    expect(has(s, 'd1_guru')).toBe(true);
    expect(s.arriving ?? []).toHaveLength(0);
  });
});
