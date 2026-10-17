/*
 * Timed arrivals: the morning picks the day's emails and posts, and each lands at its own time of day
 * as the clock reaches it. One left over when the day ends early comes first thing the next morning.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame, endDay } from './day';
import { advanceClock } from './core';
import { deliverArrivals, deliverDue, arrivalMin, isJobOffer, JOB_OFFERS } from './events';
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
      if (ev.launch || ev.yPost || ev.afterPayment || ev.outage) continue; // timed by a deploy, a payment, a Y post (launch.test.ts) or the agent outage (outage.test.ts)
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

describe('job offers spread over the first six hours', () => {
  const offersToday = (s: ReturnType<typeof startGame>) => (s.arriving ?? [])
    .filter((a) => a.day === s.values.day && isJobOffer(content, content.events.find((e) => e.id === a.eventId)!))
    .map((a) => a.at).sort((a, b) => a - b);

  it('knows a lead post, a gig and a client change request as job offers, and Mom as not one', () => {
    const ev = (id: string) => content.events.find((e) => e.id === id)!;
    for (const id of ['d1_y_restaurant', 'd1_y_laundromat', 'd5_gym_reviews', 'd3_coffee_promo', 'd5_laundromat_update']) expect(isJobOffer(content, ev(id)), id).toBe(true);
    for (const id of ['d1_mom', 'd1_y_journalist', 'restaurant_contact']) expect(isJobOffer(content, ev(id)), id).toBe(false);
  });

  it('every day, the offers land between 10:15 and 16:00, an hour apart, except ones written for the evening', () => {
    let s = startGame(content, 7);
    s.values.followers = 500; // unlock the follower-gated gigs
    const late = new Set<number>();
    for (let day = 1; day <= 8; day++) {
      const evening = (s.arriving ?? []).filter((a) => a.day === s.values.day && a.at > JOB_OFFERS.to && isJobOffer(content, content.events.find((e) => e.id === a.eventId)!));
      for (const a of evening) { expect(a.at, a.eventId).toBe(arrivalMin(content.events.find((e) => e.id === a.eventId)!)); late.add(a.at); }
      const times = offersToday(s).filter((t) => t <= JOB_OFFERS.to);
      for (const t of times) {
        expect(t, `day ${day}`).toBeGreaterThanOrEqual(JOB_OFFERS.from);
        expect(t, `day ${day}`).toBeLessThanOrEqual(JOB_OFFERS.to);
      }
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1], `day ${day}`).toBeGreaterThanOrEqual(JOB_OFFERS.gap);
      advanceClock(s, CLOCK.sleep - s.clockMin); // play the whole day, so nothing is left over
      deliverArrivals(s, content);
      s = { ...endDay(s, content), morning: null };
    }
    expect([...late]).toEqual([at('19:00')]); // the deepfake gig comes in the evening
  });

  it("offers left over from a day that ended early are spread with the next day's, not dumped at 10:00", () => {
    const s0 = startGame(content, 7);
    // sleep straight away: the day 1 leads never arrived
    const s1 = endDay(s0, content);
    expect(s1.delivered.some((d) => d.eventId === 'd1_y_restaurant' || d.eventId === 'd1_y_laundromat')).toBe(false);
    const times = offersToday(s1);
    expect(times.length).toBeGreaterThanOrEqual(3); // both day 1 leads and the trader
    expect(times[0]).toBeGreaterThanOrEqual(JOB_OFFERS.from);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(JOB_OFFERS.gap);
  });
});
