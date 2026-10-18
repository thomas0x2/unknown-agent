/*
 * Timed arrivals: the morning picks the day's emails and posts, and each lands at its own time of day
 * as the clock reaches it. One left over when the day ends early comes first thing the next morning.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame, endDay } from './day';
import { advanceClock } from './core';
import { deliverArrivals, deliverDue, arrivalMin, isJobOffer, JOB_OFFERS, postMin, freeYMin, Y_GAP, fillerToday } from './events';
import { CLOCK } from './config';

const content = loadContent();
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const has = (s: ReturnType<typeof startGame>, id: string) => s.delivered.some((d) => d.eventId === id);

describe('timed arrivals', () => {
  it('day 1 opens with the termination email; Mom writes around midday', () => {
    const s = startGame(content, 7);
    expect(has(s, 'd1_hr_termination')).toBe(true);
    expect(has(s, 'd1_mom')).toBe(false);
    expect(s.arriving?.some((a) => a.eventId === 'd1_mom')).toBe(true);
    advanceClock(s, at('12:20') - s.clockMin);
    const landed = deliverArrivals(s, content);
    expect(landed.map((d) => d.eventId)).toContain('d1_mom');
    expect(s.delivered.find((d) => d.eventId === 'd1_mom')?.min).toBe(at('12:20'));
    expect(s.arriving?.some((a) => a.eventId === 'd1_mom')).toBe(false);
  });

  it('a post written for before the day starts is already up, showing its own time', () => {
    const s = startGame(content, 7);
    expect(s.delivered.find((d) => d.eventId === 'd1_y_stryker')?.min).toBe(at('07:40'));
    expect(s.delivered.find((d) => d.eventId === 'd1_hr_termination')?.min).toBe(CLOCK.wake);
  });

  it('the Spin Cycle regulars post again on day 3 only if they were seen on day 2 and nobody built the app', () => {
    const day2 = () => {
      const s = endDay(startGame(content, 7), content);
      advanceClock(s, CLOCK.sleep - s.clockMin);
      deliverArrivals(s, content);
      return s;
    };
    const ids = (t: ReturnType<typeof startGame>) => [...t.delivered.map((d) => d.eventId), ...(t.arriving ?? []).map((a) => a.eventId)];
    const seen = day2();
    expect(seen.delivered.find((d) => d.eventId === 'd2_y_laundromat')?.min).toBe(at('14:00'));
    expect(ids(endDay(seen, content))).toContain('d3_y_laundromat');
    const built = day2();
    built.flags.push('laundromat_live');
    expect(ids(endDay(built, content))).not.toContain('d3_y_laundromat');
    // slept before the first post came: that one comes on day 3 instead, not both
    const early = endDay(endDay(startGame(content, 7), content), content);
    expect((early.arriving ?? []).map((a) => a.eventId)).not.toContain('d3_y_laundromat');
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
      if (ev.launch || ev.yPost || ev.afterPayment || ev.outage || ev.afterJob) continue; // timed by a deploy, a payment, a Y post (launch.test.ts), the agent outage (outage.test.ts) or an agent job (agentJobs.test.ts)
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
    expect(has(s, 'd1_brother_joke')).toBe(true);
    expect(s.arriving ?? []).toHaveLength(0);
  });
});

describe('job offers spread over the first six hours', () => {
  const offersToday = (s: ReturnType<typeof startGame>) => (s.arriving ?? [])
    .filter((a) => a.day === s.values.day && isJobOffer(content, content.events.find((e) => e.id === a.eventId)!))
    .map((a) => a.at).sort((a, b) => a - b);

  it('knows a lead post, a gig and a client change request as job offers, and Mom as not one', () => {
    const ev = (id: string) => content.events.find((e) => e.id === id)!;
    for (const id of ['d1_y_logan', 'd2_y_laundromat', 'd6_gym_reviews', 'd3_coffee_promo', 'd5_y_kofi_news']) expect(isJobOffer(content, ev(id)), id).toBe(true);
    for (const id of ['d1_mom', 'd1_y_journalist', 'logan_contact']) expect(isJobOffer(content, ev(id)), id).toBe(false);
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
    expect([...late].sort((a, b) => a - b)).toEqual([at('19:00')]); // the deepfake gig in the evening
  });

  it("offers left over from a day that ended early are spread with the next day's, not dumped at 10:00", () => {
    const s0 = startGame(content, 7);
    // sleep straight away: the day 1 leads never arrived
    const s1 = endDay(s0, content);
    expect(s1.delivered.some((d) => d.eventId === 'd1_y_logan')).toBe(false);
    const times = offersToday(s1);
    expect(times.length).toBeGreaterThanOrEqual(2); // Logan's day 1 lead and Spin Cycle's
    expect(times[0]).toBeGreaterThanOrEqual(JOB_OFFERS.from);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(JOB_OFFERS.gap);
  });
});

describe('Y posts go up one at a time', () => {
  const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  it(`every story post, stock post and filler post of a day is at least ${Y_GAP} minutes from the next, except inside a viral moment`, () => {
    type Post = { id: string; min: number; viral?: boolean; all?: string[]; none?: string[] };
    const days = new Map<number, Post[]>();
    const add = (day: number, id: string, min: number, viral?: boolean, all?: string[], none?: string[]) => { if (min > CLOCK.wake) days.set(day, [...(days.get(day) ?? []), { id, min, viral, all, none }]); };
    // either/or posts (one needs a flag the other rules out) never share a feed
    const apart = (a: Post, b: Post) => !!(a.all?.some((f) => b.none?.includes(f)) || b.all?.some((f) => a.none?.includes(f)));
    for (const ev of content.events) {
      if (ev.site !== 'y' || ev.latent || ev.launch || ev.yPost || ev.afterPayment || ev.outage || ev.afterJob || !ev.at) continue;
      const lo = ev.trigger.dayMin ?? 1;
      for (let day = lo; day <= (ev.trigger.dayMax ?? lo); day++) add(day, ev.id, arrivalMin(ev), ev.viral, ev.trigger.flagsAll, ev.trigger.flagsNone);
    }
    for (const p of [...(content.yMarket?.posts ?? []), ...content.yFiller]) {
      expect(p.at, p.id).toMatch(/^\d\d:\d\d$/); // a fixed time, so the spacing holds
      if ('bots' in p && p.bots) continue; // a bot barrage lands whenever it likes
      add(p.day, p.id, postMin(p, p.day), 'viral' in p ? p.viral : false);
    }
    for (const [day, posts] of days) {
      posts.sort((a, b) => a.min - b.min);
      for (let i = 0; i < posts.length; i++) {
        const a = posts[i], b = posts.slice(i + 1).find((p) => !apart(a, p));
        if (!b || (a.viral && b.viral)) continue;
        expect(b.min - a.min, `day ${day}: ${a.id} ${clock(a.min)}, ${b.id} ${clock(b.min)}`).toBeGreaterThanOrEqual(Y_GAP);
      }
    }
  });

  it('a job lead due next to a post written for that time waits for the next free slot, off the round ten', () => {
    const s = startGame(content, 7);
    const lead = s.arriving!.find((a) => a.eventId === 'd1_y_logan')!;
    const story = { eventId: 'd1_y_journalist', day: 1, at: lead.at + 2 };
    s.arriving = [lead, story];
    advanceClock(s, story.at - s.clockMin);
    deliverArrivals(s, content);
    expect(s.delivered.find((d) => d.eventId === 'd1_y_journalist')?.min).toBe(story.at);
    expect(has(s, 'd1_y_logan')).toBe(false);
    const wait = s.arriving.find((a) => a.eventId === 'd1_y_logan')!.at;
    expect(wait - story.at).toBeGreaterThanOrEqual(Y_GAP);
    expect(wait).toBe(freeYMin(s, content, lead.at, 'd1_y_logan'));
    advanceClock(s, wait - s.clockMin);
    deliverArrivals(s, content);
    expect(s.delivered.find((d) => d.eventId === 'd1_y_logan')?.min).toBe(wait);
  });

  it('an overnight filler post is already on the timeline when the day starts, at its night time', () => {
    const s = startGame(content, 7);
    s.values.day = 3;
    s.clockMin = CLOCK.wake;
    const night = content.yFiller.filter((f) => f.day === 3 && postMin(f, 3) < CLOCK.wake);
    expect(night.length).toBeGreaterThan(0);
    for (const f of night) expect(fillerToday(s, content).map((x) => x.id)).toContain(f.id);
  });

  it('posts left over from a day that ended early come in one at a time the next morning', () => {
    const s = endDay(startGame(content, 7), content);
    advanceClock(s, CLOCK.sleep - 1 - s.clockMin);
    deliverArrivals(s, content);
    const mins = s.delivered.filter((d) => d.site === 'y' && d.day === 2).map((d) => d.min!).sort((a, b) => a - b);
    expect(mins.length).toBeGreaterThan(3);
    for (let i = 1; i < mins.length; i++) expect(mins[i] - mins[i - 1]).toBeGreaterThanOrEqual(Y_GAP);
  });
});
