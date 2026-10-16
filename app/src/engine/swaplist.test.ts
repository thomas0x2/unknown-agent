/*
 * Swaplist starts empty: no bugs from builds or overnight breaks until its first listing, two hours
 * of play after the first deploy. Then the held-back bugs roll, and a clean first build still gets one.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { getEvent } from './events';
import { buildApp, deployApp, getApp, nightlyBreaks, wakeApps, scriptedBreak } from './apps';
import { swapListings } from './swaplist';
import { playMinutes } from './core';
import type { GameState } from './state';

const content = loadContent();
const tmpl = content.apps.swaplist;
const FEATURES = ['listings', 'search', 'contact', 'mark_sold'];

function withSwaplist(seed: number): { s: GameState; id: string } {
  const s = startGame(content, seed);
  const build = getEvent(content, 'viktor_contact')!.outcomes!.find((o) => o.id === 'build')!;
  applyEffects(s, build.effects, undefined, 'viktor_contact');
  const id = s.apps.find((a) => a.template === 'swaplist')!.id;
  s.clockMin = 12 * 60;
  return { s, id };
}

const wrong = (s: GameState, id: string) => getApp(s, id)!.features.filter((f) => !f.correct).length;

describe('Swaplist before its first listing', () => {
  it('builds clean at agent-1 and the first deploy ships no bug', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { s, id } = withSwaplist(seed);
      buildApp(s, id, FEATURES, 1, { tmpl });
      deployApp(s, id, tmpl);
      expect(wrong(s, id)).toBe(0);
      expect(getApp(s, id)!.contentAt).toBe(playMinutes(s) + 120);
    }
  });

  it('gets no overnight or scripted breaks while empty', () => {
    const { s, id } = withSwaplist(4);
    buildApp(s, id, FEATURES, 1, { tmpl });
    deployApp(s, id, tmpl);
    for (let i = 0; i < 20; i++) { nightlyBreaks(s, content); scriptedBreak(s, id); }
    expect(getApp(s, id)!.breaks).toEqual([]);
  });

  it('lists nothing until two hours of play after the deploy, then Viktor\'s watch', () => {
    const { s, id } = withSwaplist(5);
    buildApp(s, id, FEATURES, 1, { tmpl });
    deployApp(s, id, tmpl);
    const at = getApp(s, id)!.contentAt!;
    expect(swapListings(at, at - 1)).toEqual([]);
    expect(swapListings(at, at).map((l) => l.seller)).toEqual(['viktor']);
    expect(swapListings(at, at + 600).length).toBeGreaterThan(5);
  });

  it('a deploy at 21:30 lists at 11:30 the next morning: the night does not count', () => {
    const { s, id } = withSwaplist(6);
    s.clockMin = 21 * 60 + 30;
    buildApp(s, id, FEATURES, 1, { tmpl });
    deployApp(s, id, tmpl);
    s.values.day += 1;
    s.clockMin = 11 * 60 + 29;
    expect(wakeApps(s, content)).toEqual([]);
    s.clockMin = 11 * 60 + 30;
    expect(wakeApps(s, content).map((a) => a.id)).toEqual([id]);
  });
});

describe('Swaplist when its first listing appears', () => {
  it('always shows at least one bug, and only then', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { s, id } = withSwaplist(seed);
      buildApp(s, id, FEATURES, 5, { tmpl });
      deployApp(s, id, tmpl);
      s.clockMin += 119;
      wakeApps(s, content);
      expect(wrong(s, id)).toBe(0);
      s.clockMin += 1;
      wakeApps(s, content);
      const app = getApp(s, id)!;
      expect(app.contentLive).toBe(true);
      expect(wrong(s, id)).toBeGreaterThan(0);
      // the repo has the same code, so it carries the bug too
      expect(app.repo.filter((f) => !f.correct).length).toBeGreaterThan(0);
      expect([...app.repo, ...app.features].some((f) => f.quietLevel != null)).toBe(false);
    }
  });

  it('builds after the first listing roll bugs as usual', () => {
    const { s, id } = withSwaplist(9);
    buildApp(s, id, FEATURES, 1, { tmpl });
    deployApp(s, id, tmpl);
    s.clockMin += 120;
    wakeApps(s, content);
    let bugs = 0;
    for (let i = 0; i < 10; i++) { buildApp(s, id, FEATURES, 1, { tmpl }); bugs += getApp(s, id)!.repo.filter((f) => !f.correct).length; }
    expect(bugs).toBeGreaterThan(0);
  });
});
