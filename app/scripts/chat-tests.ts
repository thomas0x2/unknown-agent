/*
 * Runs the agent.chat prompt set (content/chat-tests.json) against real Jev through the proxy
 * (npm run proxy, port 8787): each prompt's reply kind, and whether it got a visible reply at all.
 * Run: npx vite-node scripts/chat-tests.ts
 * Options: --all (also the agent.chat prompts of jev-tests.json, query-tests.json and
 * offline-route-tests.json), --only <text> (cases whose prompt contains it).
 */
import { readFileSync } from 'node:fs';
import { loadContent } from '../src/content/load';
import { runChatTest, fromJevTest, fromQueryTest, fromRouteTest, type ChatTestCase, type ChatTestResult, type JevRouter } from '../src/engine';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const BASE = process.env.JEV_PROXY ?? 'http://localhost:8787';
const post = async (path: string, body: unknown) => {
  const r = await fetch(`${BASE}/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};
const jev: JevRouter = {
  route: (i) => post('route', i),
  ratePost: (i) => post('rate-post', i),
  matchFeatures: (i) => post('match-features', i),
  matchScores: (i) => post('match-features', { ...i, withScores: true }),
};

const read = (f: string) => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8'));
const content = loadContent();
const only = arg('--only');
let cases: ChatTestCase[] = read('chat-tests.json');
if (process.argv.includes('--all')) {
  cases = [...cases, ...read('jev-tests.json').map(fromJevTest), ...read('query-tests.json').map(fromQueryTest), ...read('offline-route-tests.json').map(fromRouteTest).filter(Boolean)];
}
cases = cases.filter((c) => !only || c.prompt.includes(only));

// a few at a time: each case is a handful of Jev calls
const results: ChatTestResult[] = new Array(cases.length);
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < cases.length) {
    const i = next++;
    results[i] = await runChatTest(content, jev, cases[i]);
  }
}));

let pass = 0;
let vanished = 0;
cases.forEach((c, i) => {
  const r = results[i];
  if (r.pass) { pass++; return; }
  if (!r.visible) vanished++;
  const want = `${[c.expect.kind].flat().join('|')}${c.expect.id ? ` ${c.expect.id}` : ''}`;
  console.log(`✗ [d${c.day ?? 3}${c.app ? ` ${c.app}` : ''}] ${c.prompt.slice(0, 120)}${c.note ? `  (${c.note})` : ''}
    want ${want}
    got  ${r.visible ? '' : 'NO VISIBLE REPLY '}${r.got.kind}${r.got.id ? ` ${r.got.id}` : ''}${r.error ? ` ERROR ${r.error}` : ''}
    ${r.reply ? `reply: ${r.reply.slice(0, 160).replaceAll('\n', ' ')}\n    ` : ''}${r.debug.split('\n').join(' | ')}`);
});
console.log(`\n${pass}/${cases.length} pass, ${vanished} without a visible reply`);
