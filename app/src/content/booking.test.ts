/*
 * Gino's table booking (day 2): every failure from the day plans is a concrete bug on the booking
 * feature, visible to a player who books a test table, and fixable by naming it.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { composeEmail, briefBuild, deploy, makeBooking, cancelBooking } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { getApp, devToggleBug } from '../engine/apps';
import { advanceClock } from '../engine/core';

/** Fix requests have to name the app. */
const gino = 'Trattoria Gino: ';
import type { GameState } from '../engine/state';
import { wordJev, promptDone } from '../engine/_fixtures';

const content = loadContent();
const APP = 'trattoria-gino';
const ME = 'you@qmail.com';

/** Gino's site with landing, menu and booking all built right and live. */
async function liveSite(): Promise<GameState> {
  let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
  advanceClock(s, 30); // Gino's reply with the brief arrives
  applyEffects(s, content.events.find((e) => e.id === 'd2_restaurant_booking')!.onDeliver!);
  const app = getApp(s, APP)!;
  app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
  app.repoVersion = 1;
  return deploy(s, APP);
}

const book = (s: GameState, time = '19:00', party = 2, date = s.values.day + 1) =>
  makeBooking(s, APP, 'You', ME, date, time, party, content);
const lastMail = (s: GameState) => s.mail.filter((m) => m.folder === 'inbox').at(-1);

describe('table booking', () => {
  it('works when built right: confirmation with name, day, time, party and a cancel link that cancels', async () => {
    const s0 = await liveSite();
    const s = book(s0, '19:00', 3);
    const m = lastMail(s)!;
    expect(m.body).toContain('Your table for 3 at Trattoria Gino on Tuesday, October 8, 2030 at 19:00');
    expect(m.bookingId).toBe(s.bookings[0].id);
    // the site's summary reads this booking, to compare with the email
    expect(s.bookingNotice).toMatchObject({ ok: true, bookingId: s.bookings[0].id });
    expect(cancelBooking(s, m.bookingId!).bookings[0]).toMatchObject({ cancelled: true, cancelClicked: true });
    // outside opening hours, or in the past: refused
    expect(book(s0, '23:30').bookings).toHaveLength(0);
    expect(book(s0, '23:30').bookingNotice?.ok).toBe(false);
    expect(book(s0, '19:00', 2, 0).bookings).toHaveLength(0);
  });

  it('past dates: yesterday is refused, today (later on) and tomorrow are fine', async () => {
    const s0 = await liveSite();
    const day = s0.values.day;
    expect(book(s0, '19:00', 2, day - 1).bookingNotice).toMatchObject({ ok: false, text: 'That date is in the past.' });
    expect(book(s0, '19:00', 2, day).bookings).toHaveLength(1);
    expect(book(s0, '19:00', 2, day + 1).bookings).toHaveLength(1);
  });

  it('each bug shows up where a test booking would reveal it', async () => {
    const s0 = await liveSite();
    const withBug = (bug: string) => { const s = structuredClone(s0); devToggleBug(s, APP, 'booking', bug); return s; };
    const before = s0.mail.length;
    expect(book(withBug('no_email')).mail.length).toBe(before);
    expect(book(withBug('no_email')).bookings).toHaveLength(1);
    expect(lastMail(book(withBug('wrong_date')))!.body).toContain('Wednesday, October 9, 2030');
    expect(lastMail(book(withBug('wrong_time')))!.body).not.toContain('19:00');
    expect(lastMail(book(withBug('party_wrong'), '19:00', 2))!.body).not.toContain('for 2 ');
    expect(lastMail(book(withBug('name_wrong_mail')))!.body).not.toContain('Trattoria Gino');
    const toGino = lastMail(book(withBug('sent_to_restaurant')))!;
    expect(toGino.addr).toBe('gino@trattoria.test');
    expect(toGino.link).toBeUndefined();
    expect(book(withBug('no_hours_check'), '23:30').bookings).toHaveLength(1);
    expect(book(withBug('no_hours_check'), '19:00', 2, 0).bookings).toHaveLength(0);
    expect(book(withBug('past_dates'), '19:00', 2, 0).bookings).toHaveLength(1);
    // a time already gone today is in the past too
    const late = structuredClone(s0); late.clockMin = 20 * 60;
    expect(book(late, '19:00', 2, late.values.day).bookingNotice?.text).toBe('That time has already passed today.');
    expect(book(late, '21:00', 2, late.values.day).bookings).toHaveLength(1);
    const dead = book(withBug('dead_button'));
    expect(dead.bookings).toHaveLength(0);
    expect(dead.clockMin).toBe(s0.clockMin);
  });

  it('a deep break kills the book button; a crash takes the form down', async () => {
    const s0 = await liveSite();
    const deep = structuredClone(s0);
    devToggleBug(deep, APP, 'booking', 'deep');
    expect(book(deep).bookings).toHaveLength(0);
    const crash = structuredClone(s0);
    devToggleBug(crash, APP, 'booking', 'visible');
    expect(book(crash).bookings).toHaveLength(0);
  });

  it('a build prompt that leaves out a spec item gets its mistake', async () => {
    const s0 = await liveSite();
    s0.values.agentLevel = 5;
    getApp(s0, APP)!.repo = getApp(s0, APP)!.repo.filter((f) => f.id !== 'booking');
    const s = (await briefBuild(s0, content, wordJev, APP, 'Add a booking form with name, email, date, time and party size, only during opening hours.')).state;
    const f = getApp(s, APP)!.repo.find((x) => x.id === 'booking')!;
    expect(f.checked).toEqual({ confirmation: false, party: true, hours: true });
    expect([f.variant, ...(f.also ?? [])]).toEqual(['no_email']);
  });

  it('every booking bug has a fix request that names it, and naming it fixes it', async () => {
    const asks: Record<string, string> = {
      no_email: "I booked a table but no confirmation email arrived.",
      wrong_date: 'The booking confirmation shows the wrong date.',
      wrong_time: 'The time in the booking confirmation is wrong.',
      sent_to_restaurant: 'The booking confirmation is sent to the restaurant instead of the guest.',
      party_wrong: 'The booking confirmation has the wrong party size.',
      name_wrong_mail: 'The booking confirmation email has the wrong restaurant name.',
      no_hours_check: 'The booking form accepts bookings outside opening hours.',
      past_dates: 'The booking form lets you book a table in the past.',
      dead_button: 'On the booking form the book button does nothing on the second step.',
    };
    for (const [bug, ask] of Object.entries(asks)) {
      const s0 = await liveSite();
      s0.values.agentLevel = 5;
      const app = getApp(s0, APP)!;
      app.repo = app.repo.map((f) => (f.id === 'booking' ? { ...f, correct: false, variant: bug, seed: 1 } : f));
      const s = (await promptDone(s0, content, wordJev, gino + ask)).state;
      expect(getApp(s, APP)!.repo.find((f) => f.id === 'booking')!.correct, bug).toBe(true);
    }
  });

  it('a test booking nobody cancels costs a no-show fee on its night; cancelling avoids it', async () => {
    const s0 = await liveSite();
    const s1 = book(s0, '19:00', 2); // tomorrow
    const night1 = endDay(s1, content);
    expect(night1.bookings[0].noShow).toBeFalsy(); // not its night yet
    const night2 = endDay(night1, content);
    const m = night2.mail.find((x) => x.subject === 'Your table tonight')!;
    expect(m.addr).toBe('gino@trattoria.test');
    expect(m.body).toContain('19:00');
    expect(night2.flags).toContain('test_booking_no_show');
    expect(night2.morning!.lines).toContainEqual(['No-show fee', -25]);
    expect(night2.tx.some((t) => t.amount === -25 && t.memo.includes('no-show'))).toBe(true);
    // charged once
    expect(endDay(night2, content).mail.filter((x) => x.subject === 'Your table tonight')).toHaveLength(1);
    // cancelled through the link: nothing
    const cancelled = cancelBooking(s1, lastMail(s1)!.bookingId!);
    const quiet = endDay(endDay(cancelled, content), content);
    expect(quiet.mail.some((x) => x.subject === 'Your table tonight')).toBe(false);
    expect(quiet.flags).not.toContain('test_booking_no_show');
  });
});
