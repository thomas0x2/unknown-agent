/* Bug and break rates: per component on a build, by agent level; per night across all live apps. */
import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { clone } from './core';
import { registerApp, buildApp, deployApp, getApp, bugsOf, nightlyBreaks, fixableComponents } from './apps';
import { loadContent } from '../content/load';

const content = loadContent();
const tmpl = content.apps.sentiment;
const comps = tmpl.features.reduce((n, f) => n + fixableComponents(f).length, 0);

function crawler(seed: number) {
  const s = clone(newGame(seed));
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
        getApp(s, id)!.repoVersion = 5; // past the first build's teaching bug
        buildApp(s, id, getApp(s, id)!.required, level, { tmpl });
        bugs += getApp(s, id)!.repo.reduce((n, f) => n + (f.correct ? 0 : bugsOf(f).length), 0);
      }
      expect(bugs / (runs * comps)).toBeGreaterThan(rate - 0.04);
      expect(bugs / (runs * comps)).toBeLessThan(rate + 0.04);
    });
  }
});

describe('overnight breaks', () => {
  it('break at least one, two and three components 85%, 30% and 10% of nights', () => {
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
    [0.85, 0.3, 0.1].forEach((p, k) => expect(Math.abs(atLeast[k] / runs - p), `at least ${k + 1}`).toBeLessThan(0.03));
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
