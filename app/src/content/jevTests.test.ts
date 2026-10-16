/*
 * The dev menu's Jev tests: every case sets up the app it names with its parts broken, and the runner
 * reads the outcome right (what got fixed, which near-miss, or nothing). Jev itself is faked here.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { jevTestState, runJevTest, type JevTestCase } from '../engine/jevTests';
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
    expect(r.got).toEqual({ fix: c.expect.fix, near: undefined });
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

  it('reads which near-miss came back', async () => {
    const c = all.find((x) => x.expect.near === 'near_part')!;
    const r = await runJevTest(content, pickJev({ features: ['::booking::area'] }), c);
    expect(r.got.near).toBe('near_part');
    expect(r.pass).toBe(true);
  });
});
