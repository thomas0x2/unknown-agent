/*
 * Button actions: deploy, take down, test bookings, no-show fees, the EMPIRE subscription.
 */
import type { GameState } from '../state';
import type { Content } from '../../content/schema';
import { clone, log, money, pushMail, sendLater } from '../core';
import { applyEffects } from '../effects';
import { queueLaunch, queueFeatureLaunch } from '../events';
import { deployApp as deployAppCore, takeDownApp as takeDownCore, getApp, bugsOf, breakVariant } from '../apps';
import { dateFull } from '../calendar';
import { PLAYER_ADDR, nextId } from './shared';

export function deploy(s0: GameState, appId: string, content?: Content): GameState {
  // a client that cancelled took the app with it
  if (getApp(s0, appId)?.churned) return s0;
  const s = clone(s0);
  const app = getApp(s, appId);
  const first = !!app && app.deployedVersion === 0;
  deployAppCore(s, appId, app && content?.apps[app.template], content);
  // a client's site going live for the first time: what waits on its launch is on its way
  if (first && app?.clientEventId && content) queueLaunch(s, content, app.clientEventId);
  // and what waits on one of its features going live (Crane's $APO post tests the new auto-buy)
  if (app?.clientEventId && content) queueFeatureLaunch(s, content, app.clientEventId, app.features.map((f) => f.id));
  log(s, `Deployed ${getApp(s, appId)?.name ?? appId}.`, 'info');
  return s;
}

export function takeDown(s0: GameState, appId: string): GameState {
  const s = clone(s0);
  takeDownCore(s, appId);
  log(s, `Took down ${getApp(s, appId)?.name ?? appId}.`, 'warn');
  return s;
}

// what the agent calls the restaurant when it makes the name up
const FAKE_NAMES = ['Trattoria Bella Napoli', 'Ristorante Da Luigi', "Mamma Mia's Kitchen", 'Pizzeria Il Forno'];

/** Minutes since midnight for "19:00" / "7:30"; NaN if it isn't a time. */
const minutes = (t: string) => { const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/); return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : NaN; };

/**
 * The player books a table on a restaurant app. What happens follows the booking feature's live
 * bugs: a dead button, no or a garbled confirmation, no checks. A test booking nobody cancels costs
 * a no-show fee on its night (chargeNoShows).
 */
export function makeBooking(s0: GameState, appId: string, name: string, email: string, date: number, time: string, party: number, content?: Content): GameState {
  const s = clone(s0);
  const app = getApp(s, appId);
  if (!app || !app.deployed) return s;
  const feat = app.features.find((f) => f.id === 'booking');
  if (!feat) return s;
  const def = content?.apps[app.template]?.features.find((f) => f.id === 'booking');
  const brk = app.breaks.find((b) => b.featureId === 'booking');
  if (brk?.failure === 'visible') return s; // the page is an error screen
  const bugs = new Set(feat.correct ? [] : bugsOf(feat));
  const shown = brk && breakVariant(brk, def);
  if (shown) bugs.add(shown);
  if (!feat.correct && !bugs.size) bugs.add('no_email'); // wrong in some unnamed way: nothing arrives
  if (bugs.has('dead_button')) return s; // nothing happens on step two
  delete s.bookingNotice;
  const seed = brk?.seed ?? feat.seed ?? 0;
  // the spec: opening hours only, never in the past
  const hours = String(app.specParams.landing?.hours ?? '17:00-22:00').split(/[-–]/).map((t) => minutes(t.trim()));
  const at = minutes(time);
  const closed = !Number.isFinite(at) || at < hours[0] || at > hours[1];
  // a past date, or a time already gone today
  const past = date < s.values.day || (date === s.values.day && at <= s.clockMin);
  if (past && !bugs.has('past_dates')) {
    s.bookingNotice = { appId, ok: false, text: date < s.values.day ? 'That date is in the past.' : 'That time has already passed today.' };
    return s;
  }
  if (closed && !bugs.has('no_hours_check')) {
    s.bookingNotice = { appId, ok: false, text: `We only take bookings during opening hours (${String(app.specParams.landing?.hours ?? '17:00-22:00')}).` };
    return s;
  }
  const id = nextId(s, 'bk');
  s.bookings.push({ id, appId, name, email, date, time, party, cancelled: false });
  s.bookingNotice = { appId, ok: true, text: 'Booked. A confirmation is on its way.', bookingId: id };
  if (bugs.has('no_email')) return s;
  const restaurant = bugs.has('name_wrong_mail') ? FAKE_NAMES[seed % FAKE_NAMES.length] : app.name;
  const day = bugs.has('wrong_date') ? date + 1 : date;
  const shownTime = !bugs.has('wrong_time') ? time
    : seed % 2 ? `${Math.floor(at / 60) % 12 || 12}:${String(at % 60).padStart(2, '0')}` // 19:00 as 7:00, no am/pm
    : `${String(Math.floor(at / 60 + 1) % 24).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`; // an hour off
  const table = bugs.has('party_wrong') ? (seed % 2 ? 'Your table' : `Your table for ${party + 2}`) : `Your table for ${party}`;
  const body = `${table} at ${restaurant} on ${dateFull(day)} at ${shownTime} is confirmed.\n\nNeed to cancel? Use the link below.`;
  if (bugs.has('sent_to_restaurant')) {
    // the guest gets nothing; the owner gets the guest's confirmation
    const ev = content?.events.find((e) => e.id === app.clientEventId);
    if (email.toLowerCase() === PLAYER_ADDR && ev?.addr) {
      pushMail(s, { folder: 'inbox', day: s.values.day, from: ev.from ?? app.name, addr: ev.addr, subject: 'A booking?', read: false,
        body: `This came from the website:\n\n"${body.split('\n')[0]}"\n\nIt was sent to me, not to the guest. Is that how it should work?` });
    }
    return s;
  }
  if (email.toLowerCase() === PLAYER_ADDR) {
    pushMail(s, { folder: 'inbox', day: s.values.day, from: restaurant, addr: `bookings@${app.url}`, subject: `Booking confirmed — ${restaurant}`, body, read: false, link: 'cancel', bookingId: id });
  }
  return s;
}

/** The cancel link in a confirmation. */
export function cancelBooking(s0: GameState, bookingId: string): GameState {
  const s = clone(s0);
  const b = s.bookings.find((x) => x.id === bookingId);
  if (!b) return s;
  b.cancelClicked = true;
  b.cancelled = true;
  return s;
}

export const NO_SHOW = { fee: 25, flag: 'test_booking_no_show' } as const;

/** Test bookings for tonight that nobody cancelled or will cancel now. */
export const noShowsTonight = (s: GameState) => s.bookings.filter((b) => !b.cancelled && !b.cancelClicked && !b.noShow && b.date === s.values.day);

/**
 * End of day: every uncancelled booking for tonight was a no-show. The owner writes and charges
 * the fee, once per booking. Returns what was charged, for the morning card.
 */
export function chargeNoShows(s: GameState, content: Content): number {
  let total = 0;
  for (const b of noShowsTonight(s)) {
    const app = getApp(s, b.appId);
    const ev = app?.clientEventId ? content.events.find((e) => e.id === app.clientEventId) : undefined;
    if (!app || !ev?.addr) continue;
    b.noShow = true;
    total += NO_SHOW.fee;
    money(s, -NO_SHOW.fee, `${app.name} · no-show fee`);
    applyEffects(s, { setFlags: [NO_SHOW.flag] });
    const who = b.party === 1 ? 'one' : String(b.party);
    pushMail(s, { folder: 'inbox', day: s.values.day, from: ev.from ?? app.name, addr: ev.addr, subject: 'Your table tonight', read: false,
      body: `A table for ${who} at ${b.time}, under "${b.name}". We kept it all evening and turned a couple away at the door. Nobody came.\n\nI think it was your test. Next time please use the cancel link. I took ${NO_SHOW.fee} DOLR for the table, like with everybody.\n\nGino` });
  }
  return total;
}

// ── Alpha Ascend: Max Stryker's EMPIRE sign-up page ──

/** `welcomeAfter`: game minutes between paying and the welcome email landing. */
export const EMPIRE = { price: 20, flag: 'guru_subscriber', addr: 'max@alphaascend.test', welcomeAfter: 3 } as const;

/** Pay for EMPIRE on empire.alphaascend.biz. Does nothing if already a member or short of DOLR. */
export function joinEmpire(s0: GameState): GameState {
  const s = clone(s0);
  if (s.flags.includes(EMPIRE.flag) || s.values.crypto < EMPIRE.price) return s;
  money(s, -EMPIRE.price, 'Alpha Ascend · EMPIRE');
  applyEffects(s, { setFlags: [EMPIRE.flag] });
  sendLater(s, {
    folder: 'inbox', day: s.values.day, from: 'Max Stryker · Alpha Ascend', addr: EMPIRE.addr,
    subject: 'Welcome to EMPIRE',
    body: 'Payment received. Welcome to the 1%.\n\nYour first lesson arrives tomorrow at 4am. Refunds are available to anyone who completes the course.',
    read: false,
  }, EMPIRE.welcomeAfter);
  return s;
}
