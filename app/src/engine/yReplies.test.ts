/*
 * The Y regulars answering the player's posts: how often, and how the answers show up.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { postToY } from './actions';
import { fakeRouter } from './_fixtures';
import { yReplyChance, deliverYReplies, Y_REPLIERS, Y_REPLY_DELAY, PLAYER_HANDLE } from './yReplies';
import { Y as YCFG } from './config';
import { scriptedWriter } from './writer';

const content = loadContent();
const router = fakeRouter({ rating: () => ({ category: 'tip', quality: 0.5 }) });

describe('regular replies', () => {
  it('a small account almost never hears from them', () => {
    const s = startGame(content, 1);
    s.values.followers = 16;
    const p = yReplyChance(s);
    expect(p).toBe(YCFG.reply.floor);
    // two or more of the three answering
    expect(3 * p * p * (1 - p) + p ** 3).toBeLessThan(0.001);
  });

  it('the chance climbs per tenfold of followers and stops at the cap', () => {
    const s = startGame(content, 1);
    const at = (f: number) => { s.values.followers = f; return yReplyChance(s); };
    expect(at(1_000)).toBeGreaterThan(at(100));
    expect(at(10_000) - at(1_000)).toBeCloseTo(at(100_000) - at(10_000), 6);
    expect(at(YCFG.reply.capAt)).toBeCloseTo(YCFG.reply.cap, 6);
    expect(at(10 ** 9)).toBe(YCFG.reply.cap);
  });

  it('when all three answer, they post a few minutes later, tagging the player', async () => {
    // at the cap each answers 60% of the time: take the first seed where all three do
    let s = startGame(content, 1);
    for (let seed = 1; seed < 100; seed++) {
      const s0 = startGame(content, seed);
      s0.values.followers = 10 ** 9;
      s = (await postToY(s0, router, 'is anyone hiring', [], content, scriptedWriter)).state;
      if (s.yReplies.length === 3) break;
    }
    expect(s.yReplies.map((r) => r.reply.handle).sort()).toEqual(Y_REPLIERS.map((r) => r.handle).sort());
    expect(s.yExtra).toHaveLength(0);
    expect(deliverYReplies(s)).toBe(false);
    s.clockMin += Y_REPLY_DELAY.max;
    expect(deliverYReplies(s)).toBe(true);
    expect(s.yExtra).toHaveLength(3);
    for (const r of s.yExtra) {
      expect(r.replyTo).toBe(s.userPosts[0].id);
      expect(r.text.startsWith(`@${PLAYER_HANDLE} `)).toBe(true);
      expect(r.scripted).toBeTruthy(); // the test writer never asks Haiku
    }
    expect(s.yReplies).toHaveLength(0);
  });

  it('noodleposter never replies', async () => {
    const s0 = startGame(content, 5);
    s0.values.followers = 10 ** 9;
    const { state: s } = await postToY(s0, router, 'noodles', [], content, scriptedWriter);
    expect(s.yReplies.some((r) => r.reply.handle === 'noodleposter')).toBe(false);
  });

  it('every replier has a character for Haiku', () => {
    for (const r of Y_REPLIERS) expect((content.characters ?? []).some((c) => c.id === r.character), r.character).toBe(true);
  });
});
