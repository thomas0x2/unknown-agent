/*
 * The agent.chat prompt set (content/chat-tests.json, plus the agent.chat prompts of jev-tests.json,
 * query-tests.json and offline-route-tests.json) through the whole route with the offline keyword
 * matcher. Every prompt must get a visible reply, without exception; the reply kinds are a pass rate
 * like offlineJev.test.ts: it prints every case it gets wrong (CHAT_VERBOSE=1) and fails if the rate
 * drops below what it reaches now.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { runChatTest, fromJevTest, fromQueryTest, fromRouteTest, type ChatTestCase } from './chatTests';
import type { JevTestCase } from './jevTests';
import type { QueryTestCase } from './queryTests';
import type { RouteTestCase } from './routeTests';
import { offlineJev } from './offlineJev';
import chatCases from '../../content/chat-tests.json';
import fixCases from '../../content/jev-tests.json';
import queryCases from '../../content/query-tests.json';
import routeCases from '../../content/offline-route-tests.json';

const content = loadContent();
const VERBOSE = !!process.env.CHAT_VERBOSE;

const SETS: [string, ChatTestCase[]][] = [
  ['chat-tests.json', chatCases as ChatTestCase[]],
  ['jev-tests.json', (fixCases as JevTestCase[]).map(fromJevTest)],
  ['query-tests.json', (queryCases as QueryTestCase[]).map(fromQueryTest)],
  ['offline-route-tests.json', (routeCases as RouteTestCase[]).map(fromRouteTest).filter((c): c is ChatTestCase => !!c)],
];

/** The pass rates the offline matcher reaches now, per set: a change that lowers one fails here. */
const MIN: Record<string, number> = { 'chat-tests.json': 0.97, 'jev-tests.json': 1, 'query-tests.json': 0.99, 'offline-route-tests.json': 1 };

describe('agent.chat prompt set, offline', () => {
  for (const [name, cases] of SETS) {
    it(`${name}: every prompt gets a visible reply, of the right kind`, async () => {
      const vanished: string[] = [];
      const wrong: string[] = [];
      for (const c of cases) {
        const r = await runChatTest(content, offlineJev, c);
        const where = `d${c.day ?? 3}${c.app ? ` ${c.app}` : ''} "${c.prompt.slice(0, 80)}"`;
        if (!r.visible) vanished.push(`${where}: ${r.error ?? `no reply (got ${r.got.kind})`}`);
        else if (!r.pass) wrong.push(`${where}  => want ${[c.expect.kind].flat().join('|')}${c.expect.id ? ` ${c.expect.id}` : ''}, got ${r.got.kind}${r.got.id ? ` ${r.got.id}` : ''}`);
      }
      const rate = (cases.length - wrong.length - vanished.length) / cases.length;
      console.log(`${name}: ${cases.length - wrong.length - vanished.length}/${cases.length} (${Math.round(rate * 100)}%)${VERBOSE && wrong.length ? `\n  ${wrong.join('\n  ')}` : ''}`);
      expect(vanished).toEqual([]);
      expect(rate).toBeGreaterThanOrEqual(MIN[name]);
    });
  }
});
