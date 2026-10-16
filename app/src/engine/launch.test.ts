/*
 * Gino's ask for a Y post: it lands the day his site first goes live, at 16:00 or half an hour after
 * the deploy if that's later. A Y post about the site after he asked brings a short thank-you.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { deploy, postToY } from './actions';
import { deliverArrivals, getEvent } from './events';
import { pickJev } from './_fixtures';
import type { GameState } from './state';

const content = loadContent();
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const has = (s: GameState, id: string) => s.delivered.some((d) => d.eventId === id);
const queued = (s: GameState, id: string) => s.arriving?.find((a) => a.eventId === id);

function withSite(min: string): { s: GameState; appId: string } {
  const s = startGame(content, 3);
  const offer = getEvent(content, 'restaurant_contact')!.outcomes!.find((o) => o.id === 'offer')!;
  applyEffects(s, offer.effects, undefined, 'restaurant_contact');
  const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact')!;
  app.repoVersion = 1; // the agent has pushed a build
  s.clockMin = at(min);
  return { s, appId: app.id };
}

describe("Gino's Y post ask", () => {
  it('lands at 16:00 when the site went live earlier in the day', () => {
    const { s: s0, appId } = withSite('12:00');
    const s = deploy(s0, appId, content);
    expect(queued(s, 'restaurant_promo')).toMatchObject({ day: 1, at: at('16:00') });
    s.clockMin = at('16:00');
    deliverArrivals(s, content);
    expect(has(s, 'restaurant_promo')).toBe(true);
    expect(s.flags).toContain('restaurant_promo_asked');
  });

  it('lands half an hour after a launch after 15:30', () => {
    const { s: s0, appId } = withSite('15:50');
    const s = deploy(s0, appId, content);
    expect(queued(s, 'restaurant_promo')?.at).toBe(at('16:20'));
  });

  it('only the first deploy asks', () => {
    const { s: s0, appId } = withSite('12:00');
    let s = deploy(s0, appId, content);
    s.clockMin = at('16:00');
    deliverArrivals(s, content);
    s.apps[0].repoVersion = 2;
    s = deploy(s, appId, content);
    expect(queued(s, 'restaurant_promo')).toBeUndefined();
    expect(s.delivered.filter((d) => d.eventId === 'restaurant_promo')).toHaveLength(1);
  });

  it('is never delivered by its trigger alone', () => {
    const { s } = withSite('12:00');
    s.values.day = 2;
    expect(getEvent(content, 'restaurant_promo')!.launch).toBeTruthy();
    expect(has(s, 'restaurant_promo')).toBe(false);
  });

  it('a Y post about the site after he asked brings a thank-you half an hour later', async () => {
    const { s: s0, appId } = withSite('12:00');
    const s1 = deploy(s0, appId, content);
    const jev = pickJev({ route: ['event:restaurant_promo_thanks'] });
    // before he asked, a post about the site does nothing for him
    const early = await postToY(s1, jev, 'Trattoria Gino has a new website', [], content);
    expect(queued(early.state, 'restaurant_promo_thanks')).toBeUndefined();
    s1.clockMin = at('16:00');
    deliverArrivals(s1, content);
    s1.clockMin = at('17:00');
    const { state: s } = await postToY(s1, jev, 'Trattoria Gino has a new website', [], content);
    expect(queued(s, 'restaurant_promo_thanks')?.at).toBe(at('17:30'));
    s.clockMin = at('17:30');
    deliverArrivals(s, content);
    expect(has(s, 'restaurant_promo_thanks')).toBe(true);
  });
});
