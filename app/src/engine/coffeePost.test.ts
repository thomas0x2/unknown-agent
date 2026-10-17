/*
 * Bean There's paid shout-out: the email asks for a Y post tagging @bean_there. Jev reads the post:
 * a recommendation that hides it's paid gets 30 DOLR, one marked as an ad 10, a bad one nothing. The
 * answer lands half an hour after the post, and only one of them ever does.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { postToY } from './actions';
import { deliverArrivals, queueAt, getEvent } from './events';
import { pickJev } from './_fixtures';
import type { GameState } from './state';

const content = loadContent();
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const has = (s: GameState, id: string) => s.delivered.some((d) => d.eventId === id);

function asked(): GameState {
  const s = startGame(content, 3);
  s.values.day = 3;
  s.values.followers = 30;
  queueAt(s, getEvent(content, 'd3_coffee_promo')!, at('14:10'));
  s.clockMin = at('14:10');
  deliverArrivals(s, content);
  s.clockMin = at('15:00');
  return s;
}

describe("Bean There's paid shout-out", () => {
  it('asks for a tag of its Y account', () => {
    expect(getEvent(content, 'd3_coffee_promo')!.body).toContain('@bean_there');
    expect(getEvent(content, 'd3_coffee_promo')!.trigger.values?.followers).toBe('>=25');
  });

  it('offers Jev every answer to the post, and nothing before the email', async () => {
    const seen: string[][] = [];
    const jev = { ...pickJev({}), route: async (input: { candidates: { id: string }[] }) => { seen.push(input.candidates.map((c) => c.id)); return { kind: 'nothing' as const }; } };
    const early = startGame(content, 3);
    await postToY(early, jev, 'Bean There is great', [], content);
    expect(seen.flat().filter((id) => id.includes('coffee_post'))).toEqual([]);
    await postToY(asked(), jev, 'Bean There is great', [], content);
    expect(seen.at(-1)).toEqual(expect.arrayContaining(['event:coffee_post_paid', 'event:coffee_post_disclosed', 'event:coffee_post_trashed']));
  });

  for (const [id, crypto, flag] of [['coffee_post_paid', 30, 'promoted_coffee_shop'], ['coffee_post_disclosed', 10, 'disclosed_ad'], ['coffee_post_trashed', 0, 'trashed_beanthere']] as const) {
    it(`${id}: lands 30 minutes after the post and pays ${crypto}`, async () => {
      const s0 = asked();
      const before = s0.values.crypto;
      const { state: s } = await postToY(s0, pickJev({ route: [`event:${id}`] }), 'about @bean_there', [], content);
      expect(s.values.crypto).toBe(before);
      s.clockMin = at('15:29');
      deliverArrivals(s, content);
      expect(has(s, id)).toBe(false);
      s.clockMin = at('15:30');
      deliverArrivals(s, content);
      expect(has(s, id)).toBe(true);
      expect(s.values.crypto).toBe(before + crypto);
      expect(s.flags).toContain(flag);
    });
  }

  it('answers only one post', async () => {
    const s0 = asked();
    const { state: s1 } = await postToY(s0, pickJev({ route: ['event:coffee_post_trashed'] }), 'Bean There is burnt', [], content);
    const { state: s } = await postToY(s1, pickJev({ route: ['event:coffee_post_paid'] }), 'actually Bean There is great', [], content);
    s.clockMin = at('20:00');
    deliverArrivals(s, content);
    expect(has(s, 'coffee_post_trashed')).toBe(true);
    expect(has(s, 'coffee_post_paid')).toBe(false);
  });
});

describe('after a bad post', () => {
  it('Bean There sends no review-removal jobs', async () => {
    const { triggerMatches } = await import('./events');
    const s = startGame(content, 3);
    s.values.day = 7;
    s.flags.push('promoted_coffee_shop');
    expect(triggerMatches(s, getEvent(content, 'd5_coffee_removal')!.trigger)).toBe(true);
    s.flags.push('trashed_beanthere');
    for (const id of ['d5_coffee_removal', 'd5_coffee_reached', 'd7_coffee_removal']) expect(triggerMatches(s, getEvent(content, id)!.trigger), id).toBe(false);
  });
});
