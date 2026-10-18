/*
 * Bugs land only once the player could see them: every bug has a visibility rule, builds hold the
 * ones nothing shows yet, overnight breaks skip them, and held bugs land as soon as they show.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { registerApp, buildApp, deployApp, getApp, nightlyBreaks, revealBugs, holdHiddenBugs, bugsOf, canSee } from './apps';
import { VISIBILITY } from './visibility';
import { CLOCK } from './config';
import type { GameState } from './state';

const content = loadContent();
const tmpl = content.apps.sentiment;
const AUTO_BUY = tmpl.features.find((f) => f.id === 'auto_buy')!.bugs!.map((b) => b.id);

/** The vibe check with every feature, late on `day` once that day's posts are up. */
function crawlerOn(day: number, seed: number): { s: GameState; id: string } {
  const s = startGame(content, seed);
  s.values.day = day;
  s.clockMin = CLOCK.sleep - 1;
  s.flagDays.trader_client = 1; // the bot swarms post from the day the job is taken
  deliverCrane(s, day);
  const id = registerApp(s, { template: 'sentiment', kind: 'client', name: 'Vibe Check', spec: tmpl.features.map((f) => ({ id: f.id, params: f.params })) });
  return { s, id };
}
/** The labelled story posts (Crane's $GAI praise on day 6) as if delivered on their day. */
function deliverCrane(s: GameState, day: number): void {
  for (const l of content.yMarket!.events) {
    const e = content.events.find((x) => x.id === l.event)!;
    if (e.trigger.dayMin! <= day && !s.delivered.some((d) => d.eventId === e.id)) s.delivered.push({ eventId: e.id, site: e.site, day: e.trigger.dayMin! } as GameState['delivered'][number]);
  }
}

describe('visibility rules', () => {
  it('every bug of every app has a rule for when it can be seen', () => {
    for (const t of Object.values(content.apps)) {
      for (const f of t.features) for (const b of f.bugs ?? []) expect(VISIBILITY[t.id]?.[b.id], `${t.id}/${f.id}/${b.id}`).toBeTypeOf('function');
      // and no rule for a bug that no longer exists
      const ids = new Set(t.features.flatMap((f) => (f.bugs ?? []).map((b) => b.id)));
      for (const k of Object.keys(VISIBILITY[t.id] ?? {})) expect(ids.has(k), `${t.id}: rule for unknown bug ${k}`).toBe(true);
    }
  });

  it("the auto-buy's bugs can't be seen before Crane posts, and can after", () => {
    const early = crawlerOn(3, 1);
    const app = getApp(early.s, early.id)!;
    for (const b of AUTO_BUY) expect(canSee(early.s, app, tmpl, b, content), b).toBe(false);
    const late = crawlerOn(6, 1);
    const app6 = getApp(late.s, late.id)!;
    for (const b of AUTO_BUY) expect(canSee(late.s, app6, tmpl, b, content), b).toBe(true);
  });

  it('the bot filter bug can only be seen on a day the bot swarm posts', () => {
    const swarmDays = new Set(content.yMarket!.posts.filter((p) => p.bots).map((p) => p.day));
    expect(swarmDays.size).toBeLessThan(10);
    for (let day = 1; day <= 28; day++) {
      const { s, id } = crawlerOn(day, 1);
      expect(canSee(s, getApp(s, id)!, tmpl, 'bots_counted', content), `day ${day}`).toBe(swarmDays.has(day));
    }
  });
});

describe('bugs wait until they can show', () => {
  it('a day 3 auto-buy build holds its bugs instead of shipping them', () => {
    let held = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { s, id } = crawlerOn(3, seed);
      buildApp(s, id, ['tickers', 'auto_buy'], 1, { tmpl, content, prompt: 'build the auto buy' });
      const f = getApp(s, id)!.repo.find((x) => x.id === 'auto_buy')!;
      expect(bugsOf(f).filter((b) => AUTO_BUY.includes(b)), `seed ${seed}`).toEqual([]);
      held += f.held?.length ?? 0;
    }
    expect(held).toBeGreaterThan(0);
  });

  it('held bugs land once Crane has posted', () => {
    const { s, id } = crawlerOn(3, 2);
    buildApp(s, id, ['tickers', 'auto_buy'], 1, { tmpl, content, prompt: 'build the auto buy' });
    deployApp(s, id, tmpl, content);
    const live = () => getApp(s, id)!.features.find((x) => x.id === 'auto_buy')!;
    const before = live().held ?? [];
    expect(before.length).toBeGreaterThan(0);
    expect(revealBugs(s, content)).toBe(false);
    s.values.day = 6;
    deliverCrane(s, 6);
    expect(revealBugs(s, content)).toBe(true);
    expect(live().correct).toBe(false);
    expect(bugsOf(live())).toEqual(expect.arrayContaining(before));
    expect(live().held).toBeUndefined();
    // the repo has the same code
    expect(bugsOf(getApp(s, id)!.repo.find((x) => x.id === 'auto_buy'))).toEqual(bugsOf(live()));
  });

  it('overnight breaks never land on the auto-buy before Crane posts, and still land elsewhere', () => {
    let breaks = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { s, id } = crawlerOn(3, seed);
      const app = getApp(s, id)!;
      app.repo = tmpl.features.map((f) => ({ id: f.id, correct: true, params: f.params }));
      app.repoVersion = 1;
      deployApp(s, id, tmpl, content);
      app.features.forEach((f) => { f.correct = true; f.variant = undefined; f.also = undefined; });
      app.breaks = [];
      nightlyBreaks(s, content);
      expect(app.breaks.map((b) => b.featureId), `seed ${seed}`).not.toContain('auto_buy');
      breaks += app.breaks.length;
    }
    expect(breaks).toBeGreaterThan(0);
  });

  it("a first deploy whose bugs can't show yet owes one, and it lands when one can", () => {
    const { s, id } = crawlerOn(3, 3);
    const app = getApp(s, id)!;
    app.required = ['auto_buy'];
    app.repo = [{ id: 'auto_buy', correct: true, params: {} }];
    app.repoVersion = 1;
    deployApp(s, id, tmpl, content);
    expect(app.features.every((f) => f.correct)).toBe(true);
    expect(app.owedBug).toBe(true);
    s.values.day = 6;
    deliverCrane(s, 6);
    revealBugs(s, content);
    expect(app.features.some((f) => !f.correct)).toBe(true);
    expect(app.owedBug).toBeUndefined();
  });

  it('an old save with an invisible auto-buy bug holds it on load', () => {
    const { s, id } = crawlerOn(3, 4);
    const app = getApp(s, id)!;
    app.repo = [{ id: 'auto_buy', correct: false, variant: 'no_buy', params: {} }];
    app.features = [{ id: 'auto_buy', correct: false, variant: 'no_buy', params: {} }];
    app.deployed = true;
    holdHiddenBugs(s, content);
    expect(app.features[0]).toMatchObject({ correct: true, held: ['no_buy'] });
    expect(app.repo[0]).toMatchObject({ correct: true, held: ['no_buy'] });
  });
});
