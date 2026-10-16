/*
 * The event engine. Events are data; this decides when each one is delivered (by trigger or by a
 * scheduled queue entry) and records it for the player to read and answer.
 */
import type { GameState, DeliveredEvent } from './state';
import { CLOCK } from './config';
import type { Content, GameEvent, Trigger } from '../content/schema';
import { hasAll, hasNone, log } from './core';
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

/** Deliver it now if its time has come, otherwise queue it to land at its time. */
function deliverOrQueue(s: GameState, ev: GameEvent, now: boolean, out: DeliveredEvent[]): void {
  if (underway(s, ev)) return;
  const at = arrivalMin(ev);
  if (now || at <= s.clockMin) {
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
    if (ev) deliverOrQueue(s, ev, now, out);
  }
  // trigger-driven events (latent ones are not auto-delivered — the player reaches them by email)
  for (const ev of content.events) {
    if (ev.latent) continue;
    if (underway(s, ev)) continue;
    if (triggerMatches(s, ev.trigger)) deliverOrQueue(s, ev, now, out);
  }
  if (now) out.push(...deliverArrivals(s, content, true));
  return out;
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
