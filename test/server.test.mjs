// Checks server.mjs against a fake TypeSafe API, using the real SDK. Run: node test/server.test.mjs
import assert from 'node:assert';
import http from 'node:http';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { createHandler, buildRequest, buildRateRequest, loadStory, defectBranches, NO_PROGRESS } from '../server.mjs';

const story = loadStory();
let fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

// Fake TypeSafe API: records the request, answers with whatever `nextAnswer` holds.
let sent = null;
let nextAnswer = null;
let nextStatus = 200;
const fakeFetch = async (url, init) => {
  sent = { url, headers: init.headers, body: JSON.parse(init.body) };
  if (nextStatus !== 200) return new Response(JSON.stringify({ error: { message: 'boom' } }), { status: nextStatus, headers: { 'Content-Type': 'application/json' } });
  const key = Object.keys(sent.body.questions)[0];
  return new Response(JSON.stringify({ model: 'jev-latest', answers: { [key]: nextAnswer }, usage: { input_tokens: 412, output_tokens: 1 } }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
const client = new TypeSafeClient({ apiKey: 'test-key', fetch: fakeFetch, retry: { maxRetries: 0 } });

const server = http.createServer(createHandler({ client, story }));
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const post = (body) => fetch(`${base}/api/decide`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

await t('buildRequest asks one Choice over the candidates plus no_progress, with intents as criteria', () => {
  const req = buildRequest(story, { kind: 'prompt', node: 'broke', prompt: 'build rosa a site', candidates: ['research', 'build_bakery_site', 'greet'] });
  const q = req.questions.branch;
  assert.strictEqual(q.type, 'choice');
  assert.deepStrictEqual(Object.keys(q.criteria), ['research', 'build_bakery_site', 'greet', NO_PROGRESS]);
  assert.match(q.criteria.build_bakery_site, /Crumb & Coin/);
  assert.strictEqual(req.state.player_prompt, 'build rosa a site');
  assert.match(req.state.situation, /\$150/);
});

await t('upkeep issues are offered to Jev like defects', () => {
  const ids = defectBranches(story).map((b) => b.id);
  assert.ok(ids.includes('defect:crumb-and-coin:pumpkin') && ids.includes('defect:spin-cycle:spam_reports'));
  assert.strictEqual(new Set(ids).size, ids.length, 'defect and issue ids must not collide');
  const req = buildRequest(story, { kind: 'prompt', node: 'monetized', prompt: 'add W7 and W8', candidates: ['defect:spin-cycle:renumbered'] });
  assert.match(req.questions.branch.criteria['defect:spin-cycle:renumbered'], /W7 and W8/);
});

await t('Yowl reviews are judged against reviewActions', () => {
  const req = buildRequest(story, { kind: 'review', node: 'broke', prompt: 'Review of GeneralAI (1 star): a parking lot', candidates: ['review_generalai', 'mail_gary'] });
  assert.deepStrictEqual(Object.keys(req.questions.branch.criteria), ['review_generalai', NO_PROGRESS]);
  assert.ok(req.state.player_review);
});

await t('defect fix requests are offered to Jev with their intents', () => {
  const req = buildRequest(story, { kind: 'prompt', node: 'site_live', prompt: 'add prices', candidates: ['defect:crumb-and-coin:no_prices', 'defect:crumb-and-coin:made_up'] });
  assert.deepStrictEqual(Object.keys(req.questions.branch.criteria), ['defect:crumb-and-coin:no_prices', NO_PROGRESS]);
  assert.match(req.questions.branch.criteria['defect:crumb-and-coin:no_prices'], /prices/);
});

await t('buildRequest ignores ids that are not in the story (no open proxy)', () => {
  const req = buildRequest(story, { kind: 'prompt', node: 'broke', prompt: 'x', candidates: ['build_bakery_site', 'made_up', 'monetize_ads'] });
  assert.deepStrictEqual(Object.keys(req.questions.branch.criteria), ['build_bakery_site', NO_PROGRESS]);
  assert.strictEqual(buildRequest(story, { kind: 'prompt', node: 'broke', prompt: 'x', candidates: ['made_up'] }), null);
});

await t('status reports Jev online', async () => {
  const r = await (await fetch(`${base}/api/status`)).json();
  assert.deepStrictEqual(r, { jev: true, model: 'jev-latest' });
});

await t('decide calls POST /v1/systemone with the key and returns Jev\'s probabilities', async () => {
  nextAnswer = { type: 'choice', choice: 'build_bakery_site', confidence: 0.91, probabilities: { research: 0.03, build_bakery_site: 0.91, no_progress: 0.06 } };
  const res = await post({ kind: 'prompt', node: 'broke', prompt: 'make the bakery a website', candidates: ['research', 'build_bakery_site'] });
  const data = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(data.choice, 'build_bakery_site');
  assert.strictEqual(data.probabilities.build_bakery_site, 0.91);
  assert.strictEqual(data.model, 'jev-latest');
  assert.ok(sent.url.endsWith('/v1/systemone'));
  assert.strictEqual(sent.headers.Authorization, 'Bearer test-key');
  assert.strictEqual(sent.body.model, 'jev-latest');
  assert.strictEqual(sent.body.state.player_prompt, 'make the bakery a website');
});

await t('Y posts are judged against postActions intents', async () => {
  nextAnswer = { type: 'choice', choice: 'post_rosa', confidence: 0.8, probabilities: { post_rosa: 0.8, no_progress: 0.2 } };
  await post({ kind: 'post', node: 'site_live', prompt: '@crumbandcoin your site is up!', candidates: ['post_rosa'] });
  assert.strictEqual(sent.body.state.player_post, '@crumbandcoin your site is up!');
  assert.deepStrictEqual(Object.keys(sent.body.questions.branch.criteria), ['post_rosa', NO_PROGRESS]);
});

await t('Qmail emails are judged against mailActions intents', async () => {
  nextAnswer = { type: 'choice', choice: 'mail_gary', confidence: 0.9, probabilities: { mail_gary: 0.9, mail_mom_help: 0.02, no_progress: 0.08 } };
  const email = 'To: gary@pruittproperty.com\nSubject: Rent\n\nOne more week?';
  const res = await post({ kind: 'mail', node: 'broke', prompt: email, candidates: ['mail_gary', 'mail_mom_help', 'build_bakery_site'] });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(sent.body.state.player_email, email);
  // prompt branches can't be smuggled into a mail decision
  assert.deepStrictEqual(Object.keys(sent.body.questions.branch.criteria), ['mail_gary', 'mail_mom_help', NO_PROGRESS]);
  assert.match(sent.body.questions.branch.instructions, /Qmail/);
});

await t('Y posts are rated with a Score question over the story rubric', async () => {
  const req = buildRateRequest(story, 'rent is due and I am eating noodles');
  assert.strictEqual(req.questions.engagement.type, 'score');
  assert.deepStrictEqual(req.questions.engagement.criteria, story.y.rubric);
  assert.match(req.state.trending_topics, /laundromat/);
  nextAnswer = { type: 'score', score: 3.2, confidence: 0.6, legend: {}, probabilities: { 0: 0.02, 1: 0.05, 2: 0.13, 3: 0.4, 4: 0.4 } };
  const res = await fetch(`${base}/api/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'rent is due and I am eating noodles' }) });
  const data = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(data.score, 3.2);
  assert.strictEqual(sent.body.state.post, 'rent is due and I am eating noodles');
  assert.strictEqual((await fetch(`${base}/api/rate`, { method: 'POST', body: JSON.stringify({ text: '' }) })).status, 400);
});

await t('bad input is rejected before calling Jev', async () => {
  sent = null;
  const res = await post({ kind: 'prompt', node: 'broke', prompt: '', candidates: [] });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(sent, null);
});

await t('Jev API errors come back as 502', async () => {
  nextStatus = 500;
  const res = await post({ kind: 'prompt', node: 'broke', prompt: 'hello', candidates: ['greet'] });
  assert.strictEqual(res.status, 502);
  nextStatus = 200;
});

await t('static files are served, server code and .env are not', async () => {
  assert.strictEqual((await fetch(`${base}/`)).status, 200);
  assert.strictEqual((await fetch(`${base}/src/jev.js`)).status, 200);
  assert.strictEqual((await fetch(`${base}/server.mjs`)).status, 404);
  assert.strictEqual((await fetch(`${base}/.env`)).status, 404);
  assert.strictEqual((await fetch(`${base}/src/../server.mjs`)).status, 404);
});

await t('without a key the server says so', async () => {
  const s2 = http.createServer(createHandler({ client: null, story }));
  await new Promise((r) => s2.listen(0, r));
  const b2 = `http://localhost:${s2.address().port}`;
  assert.deepStrictEqual(await (await fetch(`${b2}/api/status`)).json(), { jev: false, model: null });
  assert.strictEqual((await fetch(`${b2}/api/decide`, { method: 'POST', body: '{}' })).status, 503);
  s2.close();
});

server.close();
console.log(fail ? `\n${fail} failing` : '\nall passing');
process.exit(fail ? 1 : 0);
