/*
 * The event engine. Events are data; this decides when each one is delivered (by trigger or by a
 * scheduled queue entry) and records it for the player to read and answer.
 */
import type { GameState, DeliveredEvent } from './state';
import { CLOCK } from './config';
import type { Content, GameEvent, Trigger } from '../content/schema';
import { addFlag, hasAll, hasFlag, hasNone, log } from './core';
import { WALLETS } from './wallets';
import { applyEffects } from './effects';
import type { MeterId } from './values';

function compare(current: number, expr: string): boolean {
  const m = expr.match(/^(>=|<=|==|>|<)\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return false;
  const n = Number(m[2]);
  switch (m[1]) {
    case '>=': return current >= n;
    case '<=': return current <= n;
    case '>': return current > n;
    case '<': return current < n;
    case '==': return current === n;
    default: return false;
  }
}

export function triggerMatches(s: GameState, t: Trigger): boolean {
  const day = s.values.day;
  if (t.dayMin != null && day < t.dayMin) return false;
  if (t.dayMax != null && day > t.dayMax) return false;
  if (t.flagsAll && !hasAll(s, t.flagsAll)) return false;
  if (t.flagsNone && !hasNone(s, t.flagsNone)) return false;
  if (t.values) {
    for (const [id, expr] of Object.entries(t.values)) {
      if (expr && !compare(s.values[id as MeterId], expr)) return false;
    }
  }
  if (t.after) {
    const set = s.flagDays[t.after.flag];
    if (set == null || day - set < t.after.delayDays) return false;
  }
  if (t.appWorking) {
    const app = s.apps.find((a) => a.clientEventId === t.appWorking && !a.churned);
    if (!app || !app.deployed || app.brokenDays > 0) return false;
  }
  return true;
}

/** The body shown for an event delivered on `day`: a repeating event cycles through its `bodies`. */
export function eventBody(ev: GameEvent, day: number): string {
  const list = ev.bodies;
  if (!list?.length) return ev.body ?? '';
  const i = (day - (ev.trigger.dayMin ?? 1)) % list.length;
  return list[(i + list.length) % list.length];
}

/** A delivery's key in the inbox and readEvents: repeating events get one per day. */
export function deliveryKey(ev: Pick<GameEvent, 'id' | 'repeat'>, day: number): string {
  return ev.repeat ? `${ev.id}@${day}` : ev.id;
}

export function getEvent(content: Content, id: string): GameEvent | undefined {
  return content.events.find((e) => e.id === id);
}

/** "HH:MM" as minutes since midnight, or null when it isn't a time. */
export function parseClock(at: string | undefined): number | null {
  const m = at?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function hashOf(text: string): number {
  let h = 0;
  for (const c of text) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * A time between 10:15 and 19:45 picked from a key, so the same post or email always comes at the
 * same minute. Leaves the last two hours quiet enough to answer what came in.
 */
export function spreadMin(key: string): number {
  const from = CLOCK.wake + 15, to = CLOCK.sleep - 135;
  return from + (hashOf(key) % (to - from + 1));
}

/** The minute an event lands on the day it's due: its `at` ("HH:MM"), or first thing without one. */
export function arrivalMin(ev: Pick<GameEvent, 'at'>): number {
  const at = parseClock(ev.at);
  return at == null ? CLOCK.wake : Math.max(CLOCK.wake, Math.min(CLOCK.sleep - 1, at));
}

/** The minute a timeline post goes up on its day: its `at`, or a time spread over the day. */
export function postMin(p: { id: string; at?: string }, day: number): number {
  return parseClock(p.at) ?? spreadMin(`${p.id}@${day}`);
}

/** Whether a post of `day` that comes at `min` is on the timeline yet. Earlier days' posts all are. */
export function posted(s: GameState, day: number, min: number): boolean {
  return day < s.values.day || (day === s.values.day && min <= s.clockMin);
}

/** The filler posts on today's timeline so far: a third of them each day, each at its own time. */
export function fillerToday(s: GameState, content: Content): Content['yFiller'] {
  const day = s.values.day;
  return content.yFiller.filter((f) => hashOf(f.id) % 3 === day % 3 && posted(s, day, postMin(f, day)));
}

function deliver(s: GameState, ev: GameEvent, min = s.clockMin): DeliveredEvent | null {
  if (!ev.repeat && s.fired.includes(ev.id)) return null;
  if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
  const d: DeliveredEvent = {
    eventId: ev.id,
    site: ev.site,
    day: s.values.day,
    seq: s.nextId++,
    answered: false,
    expiresDay: ev.expiresDay,
    min,
  };
  s.delivered.push(d);
  applyEffects(s, ev.onDeliver, ev.job, ev.id);
  log(s, `New on ${ev.site}: ${ev.subject ?? ev.from ?? ev.id}`, 'info');
  return d;
}

/** Already on its way today, or (once-only) already delivered. */
function underway(s: GameState, ev: GameEvent): boolean {
  if (!ev.repeat && s.fired.includes(ev.id)) return true;
  return !!s.arriving?.some((a) => a.eventId === ev.id && a.day === s.values.day);
}

/** Deliver it now if its time has come, otherwise queue it to land at its time. Job offers always queue, to be spread. */
function deliverOrQueue(s: GameState, ev: GameEvent, now: boolean, out: DeliveredEvent[], job = false): void {
  if (underway(s, ev)) return;
  const at = arrivalMin(ev);
  if (now || (at <= s.clockMin && !job)) {
    const d = deliver(s, ev);
    if (d) out.push(d);
    return;
  }
  (s.arriving ??= []).push({ eventId: ev.id, day: s.values.day, at });
}

/**
 * Pick everything due today: first the explicitly scheduled queue entries whose day has come, then
 * every content event whose trigger now matches. Each lands at its own time of day: what is due by
 * now is delivered (and returned), the rest waits in `s.arriving` for deliverArrivals. `now` delivers
 * everything at once (dev tools).
 */
export function deliverDue(s: GameState, content: Content, opts: { now?: boolean } = {}): DeliveredEvent[] {
  const out: DeliveredEvent[] = [];
  const now = !!opts.now;
  // scheduled queue: deliver on its day regardless of trigger (it was queued on purpose)
  const due = s.scheduled.filter((q) => q.fireDay <= s.values.day);
  s.scheduled = s.scheduled.filter((q) => q.fireDay > s.values.day);
  for (const q of due) {
    const ev = getEvent(content, q.eventId);
    if (ev) deliverOrQueue(s, ev, now, out, isJobOffer(content, ev));
  }
  // trigger-driven events (latent ones are not auto-delivered — the player reaches them by email)
  for (const ev of content.events) {
    if (ev.latent || ev.launch || ev.yPost || ev.afterPayment) continue;
    if (underway(s, ev)) continue;
    if (triggerMatches(s, ev.trigger)) deliverOrQueue(s, ev, now, out, isJobOffer(content, ev));
  }
  if (now) out.push(...deliverArrivals(s, content, true));
  else {
    spreadJobOffers(s, content);
    out.push(...deliverArrivals(s, content));
  }
  return out;
}

/** When the day's job offers come in: spread over 10:15 to 16:00, ideally an hour apart. One whose `at` is later keeps it. */
export const JOB_OFFERS = { from: CLOCK.wake + 15, to: 16 * 60, gap: 60 };

/**
 * Paid work on offer: a lead (the Y post or email naming who to write to, or the agent-started job's
 * post), a gig, or a client asking for a change.
 */
export function isJobOffer(content: Content, ev: GameEvent): boolean {
  if (ev.latent) return false;
  if (ev.job || ev.jobRequest || ev.onDeliver?.updateApp) return true;
  if (ev.outcomes?.some((o) => o.effects?.createApp)) return true;
  const text = `${ev.body ?? ''} ${(ev.bodies ?? []).join(' ')}`;
  return content.events.some((l) => l.latent && (
    l.agentStart?.lead === ev.id
    || (!!l.addr && text.includes(l.addr) && !!(l.job || l.jobRequest || l.outcomes?.some((o) => o.effects?.createApp)))
  ));
}

/**
 * Give today's queued job offers their times, so they don't all land at once in the morning: in order
 * of their own `at`, from JOB_OFFERS.from to .to, at least `gap` apart (closer when there are too many
 * to fit). One written for after 16:00 keeps its own time. One left over from a day that ended early
 * comes first rather than at 10:00 with the rest.
 */
export function spreadJobOffers(s: GameState, content: Content): void {
  const day = s.values.day;
  const offers = (s.arriving ?? []).filter((a) => {
    const ev = getEvent(content, a.eventId);
    if (!ev || a.day > day || !isJobOffer(content, ev)) return false;
    return a.day < day || arrivalMin(ev) <= JOB_OFFERS.to; // a job written for the evening (the sketchy ones) keeps its time
  });
  if (!offers.length) return;
  for (const a of offers) if (a.day < day) { a.day = day; a.at = CLOCK.wake; }
  const from = Math.max(JOB_OFFERS.from, s.clockMin + 1);
  const to = Math.max(from, JOB_OFFERS.to);
  offers.sort((a, b) => a.at - b.at);
  const n = offers.length;
  const gap = n > 1 ? Math.min(JOB_OFFERS.gap, Math.floor((to - from) / (n - 1))) : 0;
  let prev = -Infinity;
  offers.forEach((a, i) => {
    const want = Math.max(Math.min(Math.max(a.at, from), to), prev + gap);
    a.at = Math.min(want, to - (n - 1 - i) * gap);
    prev = a.at;
  });
}

/**
 * Land the queued emails and posts whose time has come, in the order they were meant to arrive.
 * Ones left over from a day that ended early arrive first thing the next morning. `all` lands
 * everything still queued. Returns what was delivered.
 */
export function deliverArrivals(s: GameState, content: Content, all = false): DeliveredEvent[] {
  if (!s.arriving?.length) return [];
  const day = s.values.day;
  const isDue = (a: { day: number; at: number }) => all || a.day < day || a.at <= s.clockMin;
  const due = s.arriving.filter(isDue).sort((a, b) => a.day - b.day || a.at - b.at);
  if (!due.length) return [];
  s.arriving = s.arriving.filter((a) => !isDue(a));
  const out: DeliveredEvent[] = [];
  for (const a of due) {
    const ev = getEvent(content, a.eventId);
    if (!ev) continue;
    const d = deliver(s, ev, a.day < day ? CLOCK.wake : Math.min(a.at, s.clockMin));
    if (d) out.push(d);
  }
  return out;
}

/** Queue an event to land at minute `at` today (clamped to the day), unless it's already on its way or delivered. */
export function queueAt(s: GameState, ev: GameEvent, at: number): void {
  if (underway(s, ev)) return;
  (s.arriving ??= []).push({ eventId: ev.id, day: s.values.day, at: Math.max(CLOCK.wake, Math.min(CLOCK.sleep - 1, at)) });
}

/**
 * A client app just went live for the first time: queue the events waiting on its launch, each at its
 * `at` or `after` minutes from now, whichever is later.
 */
export function queueLaunch(s: GameState, content: Content, clientEventId: string): void {
  for (const ev of content.events) {
    if (ev.launch?.app !== clientEventId || !triggerMatches(s, ev.trigger)) continue;
    queueAt(s, ev, Math.max(parseClock(ev.launch.at) ?? CLOCK.wake, s.clockMin + ev.launch.after));
  }
}

/** Events that wait on a Y post about something (`yPost`), open now: trigger holds, not yet on its way. */
export function yPostEvents(s: GameState, content: Content): GameEvent[] {
  return content.events.filter((ev) => ev.yPost && !underway(s, ev) && triggerMatches(s, ev.trigger));
}

/** Latent qmail events the player can currently email (trigger matches, not yet fired). */
export function reachableByEmail(s: GameState, content: Content, addr: string): GameEvent | undefined {
  return content.events.find(
    (e) => e.site === 'qmail' && e.latent && e.addr === addr && !s.fired.includes(e.id) && triggerMatches(s, e.trigger),
  );
}

/** Delivered events still open for a reply on this channel (unanswered, not expired). */
export function activeDeliveries(s: GameState): DeliveredEvent[] {
  return s.delivered.filter((d) => !d.answered && (d.expiresDay == null || s.values.day <= d.expiresDay));
}

/**
 * The last day an event can be answered before its `noReply` effects apply. Never before the day it
 * arrived, so an email held up overnight still gets its day.
 */
export function replyDeadline(ev: GameEvent, deliveredDay: number): number {
  return Math.max(ev.noReply?.byDay ?? deliveredDay, deliveredDay);
}

/**
 * End of day: every unanswered event with a `noReply` whose deadline is today lapses. Its effects
 * apply once and the thread closes.
 */
export function lapseUnanswered(s: GameState, content: Content): void {
  for (const d of s.delivered) {
    if (d.answered) continue;
    const ev = getEvent(content, d.eventId);
    if (!ev?.noReply || replyDeadline(ev, d.day) > s.values.day) continue;
    d.answered = true;
    d.outcomeId = 'no_reply';
    applyEffects(s, ev.noReply.effects, ev.job, ev.id);
    log(s, `No reply to ${ev.from ?? ev.id}: ${ev.subject ?? ev.id}.`, 'info');
  }
}

/** DOLR sent to `wallet` from `day` on, summed from the wallet's transactions. */
export function sentTo(s: GameState, wallet: string, day: number): number {
  const memo = `${WALLETS[wallet.toLowerCase()]?.name} · Sent`;
  return Math.round(s.tx.filter((x) => x.day >= day && x.memo === memo).reduce((sum, x) => sum - x.amount, 0) * 100) / 100;
}

/**
 * After a Coinbin send: every delivered event whose `payment` has now been met by its deadline counts
 * as paid, once. Its thread closes and the confirmation is queued `after` minutes out (past bedtime it
 * lands first thing next morning).
 */
export function settlePayments(s: GameState, content: Content): void {
  for (const ev of content.events) {
    const p = ev.payment;
    const paidFlag = `${ev.id}_paid`;
    if (!p || hasFlag(s, paidFlag) || s.values.day > p.byDay) continue;
    const d = s.delivered.find((x) => x.eventId === ev.id);
    if (!d) continue;
    const total = sentTo(s, p.wallet, d.day);
    if (total < p.amount) continue;
    addFlag(s, paidFlag);
    applyEffects(s, p.effects, ev.job, ev.id);
    if (!d.answered) { d.answered = true; d.outcomeId = 'paid'; }
    const confirm = getEvent(content, total > p.amount && p.confirmOver ? p.confirmOver : p.confirm);
    if (confirm && !underway(s, confirm)) (s.arriving ??= []).push({ eventId: confirm.id, day: s.values.day, at: s.clockMin + p.after });
    log(s, `Paid ${ev.from ?? ev.id}: ${total.toFixed(2)} DOLR.`, 'info');
  }
}
