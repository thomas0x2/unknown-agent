/*
 * A stand-in game at a chosen day, time and flags, for when there's no real playthrough: the
 * standalone wiki's "view as" and the query tests. What has reached the player by then (emails, Y
 * and Yowl posts) is estimated from each event's trigger.
 */
import type { Content } from '../content/schema';
import { newGame, type GameState } from './state';
import { triggerMatches, arrivalMin, shownMin } from './events';

export function estimatedState(content: Content, day: number, min: number, flags: string[] = []): GameState {
  const s = newGame(1);
  s.values.day = day;
  s.clockMin = min;
  s.flags = [...flags];
  for (const f of flags) s.flagDays[f] = 1;
  for (const ev of content.events) {
    if (ev.latent || ev.launch || ev.yPost || !['qmail', 'y', 'yowl'].includes(ev.site)) continue;
    for (let d = 1; d <= day; d++) {
      if (!triggerMatches({ ...s, values: { ...s.values, day: d } }, ev.trigger)) continue;
      if (d < day || arrivalMin(ev) <= min) s.delivered.push({ eventId: ev.id, site: ev.site, day: d, answered: false, min: shownMin(ev) });
      break;
    }
  }
  return s;
}
