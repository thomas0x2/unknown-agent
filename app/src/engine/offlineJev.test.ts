/*
 * Offline mode's keyword matcher on the same cases real Jev is tested on (content/jev-tests.json,
 * content/query-tests.json), plus its own route cases (content/offline-route-tests.json): prints the
 * pass rate and every case it gets wrong, and fails if the rate drops below what it reaches now.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { runJevTest, describeOutcome, type JevTestCase } from './jevTests';
import { runQueryTest, type QueryTestCase } from './queryTests';
import { runRouteTest, type RouteTestCase } from './routeTests';
import { offlineJev } from './offlineJev';
import fixCases from '../../content/jev-tests.json';
import queryCases from '../../content/query-tests.json';
import routeCases from '../../content/offline-route-tests.json';

const content = loadContent();
const VERBOSE = !!process.env.OFFLINE_VERBOSE;

function report(name: string, fails: string[], total: number): number {
  const rate = (total - fails.length) / total;
  console.log(`${name}: ${total - fails.length}/${total} (${Math.round(rate * 100)}%)${VERBOSE && fails.length ? `\n  ${fails.join('\n  ')}` : ''}`);
  return rate;
}

describe('offline keyword matcher', () => {
  it('fix and build cases (jev-tests.json)', async () => {
    const fails: string[] = [];
    for (const c of fixCases as JevTestCase[]) {
      const r = await runJevTest(content, offlineJev, c);
      if (!r.pass) fails.push(`${c.prompt}  => want ${describeOutcome(c.expect)}, got ${describeOutcome(r.got)}${r.error ? ` (${r.error})` : ''}`);
    }
    expect(report('fix tests', fails, fixCases.length)).toBeGreaterThanOrEqual(MIN.fix);
  });

  it('query cases (query-tests.json)', async () => {
    const fails: string[] = [];
    for (const c of queryCases as QueryTestCase[]) {
      const r = await runQueryTest(content, offlineJev, c);
      if (!r.pass) fails.push(`d${c.day ?? 3} ${c.prompt}  => want ${c.expect.kind} ${[...(c.expect.pages ?? []), ...(c.expect.any ?? [])].join('/')}, got ${r.got.kind} ${r.got.pages.join(', ')}${r.error ? ` (${r.error})` : ''}`);
    }
    expect(report('query tests', fails, queryCases.length)).toBeGreaterThanOrEqual(MIN.query);
  });

  it('route cases (offline-route-tests.json)', async () => {
    const fails: string[] = [];
    for (const c of routeCases as RouteTestCase[]) {
      const r = await runRouteTest(content, offlineJev, c);
      if (!r.pass) fails.push(`${c.where} "${c.text}"  => want ${c.expect}, got ${r.got}${r.error ? ` (${r.error})` : ''}`);
    }
    expect(report('route tests', fails, routeCases.length)).toBeGreaterThanOrEqual(MIN.route);
  });
});

/** The pass rates the matcher reaches now: a change that lowers one fails here. */
const MIN = { fix: 1, query: 0.97, route: 1 };
