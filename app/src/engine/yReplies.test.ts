/*
 * The Y regulars replying to the player's posts, and the max_followers ceiling their chance is read against.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { postToY } from './actions';
import { fakeRouter } from './_fixtures';
import { maxFollowers, yReplyChance, deliverYReplies, Y_REPLIERS, Y_REPLY_DELAY } from './yReplies';
import { Y as YCFG, START, LAST_DAY } from './config';
import { scriptedWriter } from './writer';
import characters from '../../content/characters.json';

const content = loadContent();
const router = fakeRouter({ rating: () => ({ category: 'tip', quality: 0.5 }) });

describe('max_followers', () => {
  it('starts above the starting followers and only grows', () => {
    expect(maxFollowers(content, 1)).toBeGreaterThan(START.followers);
    for (let d = 2; d <= LAST_DAY; d++) expect(maxFollowers(content, d)).toBeGreaterThan(maxFollowers(content, d - 1));
  });

  it('day 1 is three best posts at the top of their jitter from 12 followers', () => {
    // a reaction's flat 14 beats any share at this size: 14*1.3 = 18, three times
    expect(maxFollowers(content, 1)).toBe(12 + 18 + 18 + 18);
  });

  it('counts the deepfake jump once, at the top of its spread', () => {
    const before = maxFollowers(content, 5);
    const day6 = maxFollowers(content, 6);
    // without the jump day 6 grows like the days before it (well under 3x); the 2800 jump lands first
    expect(day6 - before).toBeGreaterThan(2800);
    const ratio7 = maxFollowers(content, 7) / day6;
    const ratio8 = maxFollowers(content, 8) / maxFollowers(content, 7);
    expect(ratio7).toBeCloseTo(ratio8, 1); // no second jump on day 7
  });
});

describe('regular replies', () => {
  it('a new account still has the floor chance', () => {
    const s = startGame(content, 1);
    s.values.followers = 0;
    expect(yReplyChance(s, content)).toBe(YCFG.replyFloor);
  });

  it('the chance is where followers sit between 0 and max_followers', () => {
    const s = startGame(content, 1);
    s.values.day = 4;
    s.values.followers = Math.round(maxFollowers(content, 4) / 2);
    expect(yReplyChance(s, content)).toBeCloseTo(0.5, 2);
    s.values.followers = maxFollowers(content, 4) * 3;
    expect(yReplyChance(s, content)).toBe(1);
  });

  it('at the ceiling all three reply, a few minutes later, under the post', async () => {
    const s0 = startGame(content, 3);
    s0.values.followers = maxFollowers(content, 1);
    const { state: s } = await postToY(s0, router, 'is anyone hiring', [], content, scriptedWriter);
    expect(s.yReplies.map((r) => r.reply.handle).sort()).toEqual(Y_REPLIERS.map((r) => r.handle).sort());
    expect(s.yExtra).toHaveLength(0);
    expect(deliverYReplies(s)).toBe(false);
    s.clockMin += Y_REPLY_DELAY.max;
    expect(deliverYReplies(s)).toBe(true);
    expect(s.yExtra).toHaveLength(3);
    for (const r of s.yExtra) {
      expect(r.replyTo).toBe(s.userPosts[0].id);
      expect(r.text.length).toBeGreaterThan(0);
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
    for (const r of Y_REPLIERS) expect(characters.some((c) => c.id === r.character), r.character).toBe(true);
  });
});
