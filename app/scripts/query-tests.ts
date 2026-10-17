/*
 * Runs content/query-tests.json against real Jev through the proxy (npm run proxy, port 8787), then
 * replays the recorded confidences at other thresholds. Run: npx vite-node scripts/query-tests.ts
 * Options: --only <text> (cases whose prompt contains it), --rec <file> (keep Jev's answers between runs).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadContent } from '../src/content/load';
import { runQueryTest, QUERY_BARS_NOW, newRecording, type QueryTestCase, type QueryBars, type JevRecording, type JevRouter } from '../src/engine';

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

const content = loadContent();
const only = arg('--only');
const cases = (JSON.parse(readFileSync(new URL('../content/query-tests.json', import.meta.url), 'utf8')) as QueryTestCase[]).filter((c) => !only || c.prompt.includes(only));
const recFile = arg('--rec');
const rec: JevRecording = newRecording();
if (recFile && existsSync(recFile)) {
  const j = JSON.parse(readFileSync(recFile, 'utf8'));
  for (const [k, v] of j.scores) rec.scores.set(k, v);
  for (const [k, v] of j.routes) rec.routes.set(k, v);
}
const save = () => { if (recFile) writeFileSync(recFile, JSON.stringify({ scores: [...rec.scores], routes: [...rec.routes] })); };

async function run(bars: QueryBars, print: boolean) {
  let pass = 0;
  const fails: string[] = [];
  // a few at a time: each case is a handful of Jev calls
  const results = new Array(cases.length);
  let next = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (next < cases.length) {
      const i = next++;
      results[i] = await runQueryTest(content, jev, cases[i], bars, rec);
    }
  }));
  cases.forEach((c, i) => {
    const r = results[i];
    if (r.pass) pass++;
    else fails.push(`✗ [d${c.day ?? 3}] ${c.prompt}\n    want ${c.expect.kind} ${[...(c.expect.pages ?? []), ...(c.expect.any ?? []).map((p) => `any:${p}`)].join(', ')}\n    got  ${r.got.kind} ${r.got.pages.join(', ')}${r.error ? ` ERROR ${r.error}` : ''}\n    ${r.debug.split('\n').join(' | ')}`);
  });
  if (print) console.log(fails.join('\n'));
  return pass;
}

const passed = await run(QUERY_BARS_NOW, true);
save();
console.log(`\n${passed}/${cases.length} pass at topic ${QUERY_BARS_NOW.topic}, main ${QUERY_BARS_NOW.main}, section ${QUERY_BARS_NOW.section}`);
if (process.argv.includes('--sweep')) {
  const grid = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const out: string[] = [];
  for (const topic of grid) for (const main of grid) {
    const n = await run({ topic, main, section: QUERY_BARS_NOW.section }, false);
    out.push(`topic ${topic} main ${main}: ${n}`);
  }
  save();
  console.log(out.join('\n'));
}
