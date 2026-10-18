/*
 * thirstr.com: a directory of creators with working subscriptions, Stryker Talent's creators going AI
 * over the weeks, and women from the client's Matchless deck joining a few days after he saw them.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { dayProfiles, standardsOf, passes } from './matchless';
import { CREATORS, creatorsNow, isAi, postCount, postsNow, subscribed, thirstrSubscribe, strykerAutomated } from './thirstr';
import { route } from '../sites/registry';

const content = loadContent();
const onDay = (day: number) => { const s = startGame(content, 3); s.values.day = day; return s; };
/** Matchless standards versions that can be in force on `day`: v1 from day 4, each later one from its email's day. */
const versionsOn = (day: number) => content.matchless!.versions.filter((v) => {
  const ev = content.events.find((e) => e.id.endsWith(`_matchless_rules_${v.id}`));
  return v.id === 1 || (ev?.trigger.dayMin ?? 99) <= day;
}).map((v) => v.id);

describe('the Matchless women', () => {
  const known = CREATORS.filter((c) => c.matchless);

  it('a few of them, each in the deck on her day and on Thirstr a few days later', () => {
    expect(known.length).toBeGreaterThanOrEqual(3);
    for (const c of known) {
      expect(c.matchless!).toBeGreaterThanOrEqual(4);
      expect((c.from ?? 1) - c.matchless!, c.name).toBeGreaterThanOrEqual(2);
      expect(creatorsNow(onDay(c.matchless!)).includes(c), c.name).toBe(false);
      expect(creatorsNow(onDay(c.from!)).includes(c), c.name).toBe(true);
    }
  });

  it('she is in his deck under any standards he can have that day, meets all of them, and looks the same as on Thirstr', () => {
    for (const c of known) for (const v of versionsOn(c.matchless!)) for (const wo of [false, true]) {
      const deck = dayProfiles(content, c.matchless!, v, wo);
      const p = deck.find((x) => x.name === c.name);
      expect(p, `${c.name} v${v}`).toBeDefined();
      expect(deck.filter((x) => x.name === c.name)).toHaveLength(1);
      expect(p!.gender).toBe('woman');
      expect(passes(standardsOf(content, v, wo), p!), `${c.name} v${v}`).toBe(true);
      expect([p!.look, p!.hair, p!.hairColor, p!.glasses, p!.earrings]).toEqual([c.look, c.hair, c.hairColor, c.glasses, c.earrings]);
    }
  });

  it('no other day has her', () => {
    for (const c of known) expect(dayProfiles(content, c.matchless! + 1, 1).some((p) => p.name === c.name)).toBe(false);
  });
});

describe('subscribing', () => {
  it('pays the price from Coinbin once, and shows the posts', () => {
    const s = onDay(3);
    s.values.crypto = 50;
    const c = CREATORS.find((x) => x.handle === 'rosieknits')!;
    const r = thirstrSubscribe(s, c.handle);
    expect(r.error).toBeUndefined();
    expect(r.state.values.crypto).toBe(50 - c.price);
    expect(subscribed(r.state, c)).toBe(true);
    expect(thirstrSubscribe(r.state, c.handle).state).toBe(r.state);
    expect(postsNow(r.state, c).map((p) => p.text)).toEqual(c.posts);
  });

  it("refuses without the money, and for a creator who hasn't joined yet", () => {
    const s = onDay(3);
    s.values.crypto = 1;
    expect(thirstrSubscribe(s, 'peachpitpia').error).toMatch(/doesn't have 20 DOLR/);
    s.values.crypto = 100;
    expect(thirstrSubscribe(s, 'kiranightly').state).toBe(s);
  });
});

describe('going AI', () => {
  it("only Stryker Talent's creators are replaced, a few days apart, and the agency's bio changes with the first", () => {
    const ai = CREATORS.filter((c) => c.ai);
    expect(ai.length).toBeGreaterThanOrEqual(2);
    for (const c of ai) expect(c.stryker, c.name).toBe(true);
    expect(new Set(ai.map((c) => c.ai!.from)).size).toBe(ai.length);
    const first = Math.min(...ai.map((c) => c.ai!.from));
    expect(strykerAutomated(first - 1)).toBe(false);
    expect(strykerAutomated(first)).toBe(true);
    for (const c of CREATORS.filter((x) => !x.stryker)) expect(isAi(c, 28)).toBe(false);
  });

  it('a replaced page posts every few minutes, round the clock', () => {
    const c = CREATORS.find((x) => x.ai)!;
    const before = onDay(c.ai!.from - 1);
    expect(postCount(before, c)).toBe(c.postCount);
    const s = onDay(c.ai!.from + 1);
    s.clockMin = 12 * 60;
    expect(postCount(s, c)).toBeGreaterThan(c.postCount + 300);
    expect(postsNow(s, c).length).toBeGreaterThan(c.posts.length);
  });
});

describe('finding it', () => {
  it("Max Stryker's post links his agency page, which is reachable", () => {
    const post = content.events.find((e) => e.id === 'd10_y_stryker_thirstr')!;
    expect(post.from).toBe('Max Stryker');
    expect(post.body).toContain('thirstr.com/strykertalent');
    const r = route('thirstr.com/strykertalent', onDay(10));
    expect(r.site).toBe('thirstr');
    expect(r.reachable).toBe(true);
  });
});
