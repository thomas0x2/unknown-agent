/*
 * Dev: going back to an earlier day. Everything that arrived from that day on (emails, Y posts, the
 * story flags they and the player set) is taken back, so the day plays again as if fresh. Meters,
 * money, apps and jobs stay as they are.
 */
import { deliveryKey, getEvent } from './events';
import type { Content } from '../content/schema';
import type { GameState } from './state';

export function rewindArrivals(s: GameState, content: Content, from: number): void {
  const gone = s.delivered.filter((d) => d.day >= from);
  s.delivered = s.delivered.filter((d) => d.day < from);
  const keys = new Set<string>();
  for (const d of gone) {
    const ev = getEvent(content, d.eventId);
    keys.add(ev ? deliveryKey(ev, d.day) : d.eventId);
  }
  // a repeating event that also landed before `from` stays fired; the rest can fire again
  const kept = new Set(s.delivered.map((d) => d.eventId));
  const refire = new Set(gone.map((d) => d.eventId).filter((id) => !kept.has(id)));
  s.fired = s.fired.filter((id) => !refire.has(id));
  s.readEvents = s.readEvents.filter((k) => !keys.has(k));
  if (s.hacked) s.hacked = s.hacked.filter((id) => !refire.has(id));

  const mailGone = new Set(s.mail.filter((m) => m.day >= from).map((m) => m.id));
  s.mail = s.mail.filter((m) => m.day < from);
  const start = (from - 1) * 24 * 60;
  s.pendingMail = s.pendingMail.filter((p) => p.at < start);
  s.arriving = (s.arriving ?? []).filter((a) => a.day < from);
  const rowGone = (row: string) => (row.startsWith('m/') ? mailGone.has(row.slice(2)) : keys.has(row.slice(2)));
  if (s.mailBin) s.mailBin = s.mailBin.filter((r) => !rowGone(r));
  if (s.mailDeleted) s.mailDeleted = s.mailDeleted.filter((r) => !rowGone(r));

  s.yExtra = s.yExtra.filter((p) => p.day < from);
  s.userPosts = s.userPosts.filter((p) => p.day < from);
  s.reviews = s.reviews.filter((r) => r.day < from);
  s.log = s.log.filter((l) => l.day < from);

  const late = new Set(Object.entries(s.flagDays).filter(([, d]) => d >= from).map(([f]) => f));
  s.flags = s.flags.filter((f) => !late.has(f));
  for (const f of late) delete s.flagDays[f];
}
