/* Bug and break rates: per component on a build, by agent level; per night across all live apps. */
import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { clone } from './core';
import { APPS } from './config';
import { registerApp, buildApp, deployApp, getApp, bugsOf, nightlyBreaks, fixableComponents } from './apps';
import { endAll } from './_fixtures';
import { loadContent } from '../content/load';

const content = loadContent();
const tmpl = content.apps.sentiment;
const comps = tmpl.features.reduce((n, f) => n + fixableComponents(f).length, 0);

function crawler(seed: number) {
  const s = clone(newGame(seed));
  s.flags.push('first_break'); // past the guaranteed first break: the odds alone decide
  const id = registerApp(s, { template: 'sentiment', kind: 'client', name: 'Crawler', payPerDay: 50, spec: tmpl.features.map((f) => ({ id: f.id })) });
  return { s, id };
}

describe('build bug rate', () => {
  for (const [level, rate] of [[1, 0.5], [2, 0.25]]) {
    it(`agent-${level} ships a bug in about ${rate * 100}% of components`, () => {
      let bugs = 0;
      const runs = 400;
      for (let i = 0; i < runs; i++) {
        const { s, id } = crawler(i + 1);
        buildApp(s, id, getApp(s, id)!.required, level, { tmpl });
        bugs += getApp(s, id)!.repo.reduce((n, f) => n + (f.correct ? 0 : bugsOf(f).length), 0);
      }
      expect(bugs / (runs * comps)).toBeGreaterThan(rate - 0.04);
      expect(bugs / (runs * comps)).toBeLessThan(rate + 0.04);
    });
  }
});

describe('overnight breaks', () => {
  it('break at least one, two and three components of an app 95%, 50% and 20% of nights', () => {
    const atLeast = [0, 0, 0];
    const runs = 3000;
    for (let i = 0; i < runs; i++) {
      const { s, id } = crawler(i + 1);
      const a = getApp(s, id)!;
      a.repo = a.required.map((f) => ({ id: f, correct: true }));
      a.repoVersion = 1;
      deployApp(s, id);
      nightlyBreaks(s, content);
      const n = getApp(s, id)!.breaks.length;
      for (let k = 0; k < 3; k++) if (n > k) atLeast[k]++;
    }
    [0.95, 0.5, 0.2].forEach((p, k) => expect(Math.abs(atLeast[k] / runs - p), `at least ${k + 1}`).toBeLessThan(0.03));
  });

  it('buggy builds still break most nights, never with a bug already live', () => {
    let nights = 0;
    for (let i = 0; i < 300; i++) {
      const { s, id } = crawler(i + 1);
      const a = getApp(s, id)!;
      a.repoVersion = 5;
      buildApp(s, id, a.required, 1, { tmpl }); // agent-1: about half the components ship wrong
      deployApp(s, id);
      const before = new Map(a.features.map((f) => [f.id, f.correct ? [] : bugsOf(f)]));
      nightlyBreaks(s, content);
      const breaks = getApp(s, id)!.breaks;
      if (breaks.length) nights++;
      for (const b of breaks) if (b.variant) expect(before.get(b.featureId)).not.toContain(b.variant);
    }
    expect(nights / 300).toBeGreaterThan(0.9);
  });

  it('rolls each live app on its own', () => {
    let both = 0;
    const runs = 1000;
    const laundry = content.apps.laundromat;
    for (let i = 0; i < runs; i++) {
      const { s, id } = crawler(i + 1);
      const id2 = registerApp(s, { template: 'laundromat', kind: 'client', name: 'Spin', payPerDay: 50, spec: laundry.features.map((f) => ({ id: f.id })) });
      for (const x of [id, id2]) {
        const a = getApp(s, x)!;
        a.repo = a.required.map((f) => ({ id: f, correct: true }));
        a.repoVersion = 1;
        deployApp(s, x);
      }
      nightlyBreaks(s, content);
      if (getApp(s, id)!.breaks.length && getApp(s, id2)!.breaks.length) both++;
    }
    expect(Math.abs(both / runs - 0.95 * 0.95)).toBeLessThan(0.04);
  });

  it('the first night anything can break, one live app is sure to; later nights only the odds decide', () => {
    const odds = APPS.breakOdds;
    APPS.breakOdds = [];
    try {
      for (let i = 0; i < 50; i++) {
        const { s, id } = crawler(i + 1);
        s.flags = [];
        nightlyBreaks(s, content); // nothing live yet: the guarantee waits
        expect(s.flags).not.toContain('first_break');
        const a = getApp(s, id)!;
        a.repo = a.required.map((f) => ({ id: f, correct: true }));
        a.repoVersion = 1;
        deployApp(s, id);
        nightlyBreaks(s, content);
        expect(getApp(s, id)!.breaks).toHaveLength(1);
        expect(s.flags).toContain('first_break');
        a.breaks = [];
        nightlyBreaks(s, content);
        expect(getApp(s, id)!.breaks).toHaveLength(0);
      }
    } finally { APPS.breakOdds = odds; }
  });

  it("Forkyard's mail about the first break comes the morning it shows", () => {
    const { s, id } = crawler(7);
    s.flags = [];
    s.phase = 'work';
    const a = getApp(s, id)!;
    a.repo = a.required.map((f) => ({ id: f, correct: true }));
    a.repoVersion = 1;
    deployApp(s, id);
    const next = endAll(s, content);
    expect(next.values.day).toBe(2);
    expect(getApp(next, id)!.breaks.length).toBeGreaterThan(0);
    expect(next.delivered.filter((d) => d.eventId === 'first_break').map((d) => d.day)).toEqual([2]);
    const later = endAll(next, content);
    expect(later.delivered.filter((d) => d.eventId === 'first_break')).toHaveLength(1);
    const ev = content.events.find((e) => e.id === 'first_break')!;
    expect(ev.trigger.flagsAll).toEqual(['first_break']);
    expect(ev.body).toMatch(/happens sometimes/i);
    expect(content.events.find((e) => e.id === 'd3_break')!.trigger.after).toEqual({ flag: 'first_break', delayDays: 1 });
  });

  it('a subtle break shows a bug from the component that broke', () => {
    for (let i = 0; i < 200; i++) {
      const { s, id } = crawler(i + 1);
      const a = getApp(s, id)!;
      a.repo = a.required.map((f) => ({ id: f, correct: true }));
      a.repoVersion = 1;
      deployApp(s, id);
      nightlyBreaks(s, content);
      for (const b of getApp(s, id)!.breaks) {
        const def = tmpl.features.find((f) => f.id === b.featureId)!;
        if (b.failure === 'subtle' || b.failure === 'deep') expect(def.bugs!.map((x) => x.id)).toContain(b.variant);
        else expect(b.variant).toBeUndefined();
      }
    }
  });
});

describe('component paths', () => {
  it('name every step from the feature down to the component', async () => {
    const { componentPath } = await import('./apps');
    expect(componentPath('booking', 'confirmation/date')).toBe('booking > confirmation > date');
    expect(componentPath('auto_buy', 'order/once')).toBe('auto buy > order > once');
  });
});
