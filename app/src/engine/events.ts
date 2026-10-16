/*
 * The event engine. Events are data; this decides when each one is delivered (by trigger or by a
 * scheduled queue entry) and records it for the player to read and answer.
 */
import type { GameState, DeliveredEvent } from './state';
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
  return true;
}

export function getEvent(content: Content, id: string): GameEvent | undefined {
  return content.events.find((e) => e.id === id);
}

function deliver(s: GameState, ev: GameEvent): DeliveredEvent | null {
  if (!ev.repeat && s.fired.includes(ev.id)) return null;
  if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
  const d: DeliveredEvent = {
    eventId: ev.id,
    site: ev.site,
    day: s.values.day,
    seq: s.nextId++,
    answered: false,
    expiresDay: ev.expiresDay,
  };
  s.delivered.push(d);
  applyEffects(s, ev.onDeliver, ev.job, ev.id);
  log(s, `New on ${ev.site}: ${ev.subject ?? ev.from ?? ev.id}`, 'info');
  return d;
}

/**
 * Deliver everything due this morning: first the explicitly scheduled queue entries whose day has
 * come, then every content event whose trigger now matches. Returns what was delivered.
 */
export function deliverDue(s: GameState, content: Content): DeliveredEvent[] {
  const out: DeliveredEvent[] = [];
  // scheduled queue: deliver on its day regardless of trigger (it was queued on purpose)
  const due = s.scheduled.filter((q) => q.fireDay <= s.values.day);
  s.scheduled = s.scheduled.filter((q) => q.fireDay > s.values.day);
  for (const q of due) {
    const ev = getEvent(content, q.eventId);
    if (!ev) continue;
    const d = deliver(s, ev);
    if (d) out.push(d);
  }
  // trigger-driven events (latent ones are not auto-delivered — the player reaches them by email)
  for (const ev of content.events) {
    if (ev.latent) continue;
    if (!ev.repeat && s.fired.includes(ev.id)) continue;
    if (triggerMatches(s, ev.trigger)) {
      const d = deliver(s, ev);
      if (d) out.push(d);
    }
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
