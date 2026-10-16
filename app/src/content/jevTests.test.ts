/*
 * The dev menu's Jev tests: every case sets up the app it names with its parts broken, and the runner
 * reads the outcome right (what got fixed, which near-miss, or nothing). Jev itself is faked here.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { jevTestState, runJevTest, sweepJevTests, newRecording, missKind, SWEEP, type JevTestCase } from '../engine/jevTests';
import type { JevRouter } from '../engine/jev';
import { getApp, bugsOf } from '../engine/apps';
import { pickJev } from '../engine/_fixtures';
import cases from '../../content/jev-tests.json';

const content = loadContent();
const all = cases as JevTestCase[];

describe('Jev tests', () => {
  it.each(all.map((c, i) => [i, c] as const))('case %i sets up its app with the named parts broken', (_, c) => {
    const { s, appId } = jevTestState(content, c);
    const a = getApp(s, appId)!;
    for (const p of [...c.broken, ...(c.expect.fix ?? [])]) expect(a.required).toContain(p.split('/')[0]);
    expect(a.repo.flatMap((f) => bugsOf(f)).length).toBe(c.broken.length);
  });

  it.each(all.filter((c) => c.expect.fix).map((c, i) => [i, c] as const))('fix case %i passes when Jev names exactly its parts', async (_, c) => {
    const r = await runJevTest(content, pickJev({ features: c.expect.fix!.map((p) => `::${p.split('/')[0]}::c:${p.split('/').slice(1).join('/')}`) }), c);
    expect(r.got).toEqual({ fix: c.expect.fix, near: undefined, pushed: true });
    expect(r.pass).toBe(true);
    expect(r.items.filter((x) => x.yes).length).toBeGreaterThan(0);
  });

  it('a Jev that says no to everything: nothing happens, and only the "nothing" cases pass', async () => {
    for (const c of all) {
      const r = await runJevTest(content, pickJev({}), c);
      expect(r.got.fix).toEqual([]);
      expect(r.pass).toBe(!!c.expect.none);
    }
  });

  it('a push to a part that works is a miss for a near-miss case, and too loose', async () => {
    const c = all.find((x) => x.prompt === 'Trattoria Gino: the landing page looks off')!;
    const r = await runJevTest(content, pickJev({ features: ['::landing::c:name', '::landing::area'] }), c);
    expect(r.got).toMatchObject({ fix: [], near: undefined, pushed: true });
    expect(r.got.checked).toHaveLength(1);
    expect(r.pass).toBe(false);
    expect(missKind(c.expect, r.got)).toBe('loose');
  });

  it('a prompt naming a part that works: the agent checks it and says it was already right', async () => {
    const c = all.find((x) => x.expect.check && x.broken[0] === 'landing/hours')!;
    const r = await runJevTest(content, pickJev({ features: ['::landing::c:name'] }), c);
    expect(r.got).toMatchObject({ fix: [], pushed: true });
    expect(r.got.checked).toHaveLength(1);
    expect(r.pass).toBe(true);
  });

  it('reads which near-miss came back', async () => {
    const c = all.find((x) => x.expect.near === 'near_part')!;
    const r = await runJevTest(content, pickJev({ features: ['::booking::area'] }), c);
    expect(r.got.near).toBe('near_part');
    expect(r.pass).toBe(true);
  });

  it('replays other thresholds from the recorded scores, without asking Jev again', async () => {
    const c = all.find((x) => x.expect.fix?.[0] === 'landing/hours' && x.broken.length === 1)!;
    let asked = 0;
    // a part scored 0.55 and its feature step 0.7: through at a 0.5 bar, a near-miss at 0.6
    const jev: JevRouter = {
      ...pickJev({}),
      matchFeatures: async () => [],
      matchScores: async (i) => { asked++; return i.features.map((f) => (f.id.endsWith('::c:hours') ? 0.55 : f.id.endsWith('::s:landing') ? 0.7 : f.kind === 'app' ? 1 : 0)); },
    };
    const rec = newRecording();
    const now = await runJevTest(content, jev, c, undefined, rec);
    // at today's bars (part 0.6) the part doesn't count: nothing comes back
    expect(now.pass).toBe(false);
    const n = asked;
    const cells = await sweepJevTests(content, jev, [c], [rec]);
    expect(asked).toBe(n);
    expect(cells).toHaveLength(SWEEP.length ** 2);
    const at = (step: number, component: number) => cells.find((x) => x.bars.step === step && x.bars.component === component)!;
    expect(at(0.5, 0.5).passed).toBe(1);
    expect(at(0.5, 0.6).passed).toBe(0);
    expect(at(0.8, 0.5).strict).toBe(1);
  });

  it('says whether a miss was too strict or too loose', () => {
    expect(missKind({ fix: ['a'] }, { fix: [] })).toBe('strict');
    expect(missKind({ fix: ['a'] }, { fix: [], near: 'near_miss' })).toBe('strict');
    expect(missKind({ near: 'near_miss' }, { fix: ['a'] })).toBe('loose');
    expect(missKind({ none: true }, { fix: [], near: 'near_part' })).toBe('loose');
    // worked on a part that was fine instead of the near-miss
    expect(missKind({ near: 'near_miss' }, { fix: [], pushed: true })).toBe('loose');
    expect(missKind({ fix: ['a', 'b'] }, { fix: ['a'] })).toBe('strict');
    expect(missKind({ fix: ['a'] }, { fix: ['a', 'b'] })).toBe('loose');
  });
});
