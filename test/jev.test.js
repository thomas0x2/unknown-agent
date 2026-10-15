// Checks how Jev's probabilities become story outcomes, and the offline fallback. Run: node test/jev.test.js
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '../src/keywords.js'));
const Jev = require(path.join(__dirname, '../src/jev.js'));
require(path.join(__dirname, '../src/story.js'));
const S = globalThis.STORY;

let fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
const branches = (node) => [...S.nodes[node].branches, ...S.global];
const th = S.decision;
const outcome = (d) => (d.kind === 'miss' ? 'miss' : `${d.kind}:${d.branch.id}`);

(async () => {
  await t('confident branch → hit', () => {
    const d = Jev._interpret({ choice: 'build_bakery_site', probabilities: { build_bakery_site: 0.88, no_progress: 0.12 } }, branches('broke'), th);
    assert.strictEqual(outcome(d), 'hit:build_bakery_site');
  });
  await t('no_progress wins but a nudge-able branch is plausible → partial', () => {
    const d = Jev._interpret({ choice: 'no_progress', probabilities: { build_bakery_site: 0.35, no_progress: 0.6, research: 0.05 } }, branches('broke'), th);
    assert.strictEqual(outcome(d), 'partial:build_bakery_site');
  });
  await t('top branch below the hit threshold falls to its nudge', () => {
    const d = Jev._interpret({ choice: 'build_tracker', probabilities: { build_tracker: 0.42, research: 0.3, no_progress: 0.28 } }, branches('paid_once'), th);
    assert.strictEqual(outcome(d), 'partial:build_tracker');
  });
  await t('no_progress and nothing plausible → miss', () => {
    const d = Jev._interpret({ choice: 'no_progress', probabilities: { build_bakery_site: 0.05, research: 0.04, no_progress: 0.91 } }, branches('broke'), th);
    assert.strictEqual(outcome(d), 'miss');
  });
  await t('an id Jev returns that is not a candidate is never fired', () => {
    const d = Jev._interpret({ choice: 'monetize_ads', probabilities: { monetize_ads: 0.99 } }, branches('broke'), th);
    assert.strictEqual(outcome(d), 'miss');
  });

  const find = (node, id) => branches(node).find((b) => b.id === id);

  await t('too weak with a fake outcome → fake (agent pretends), otherwise locked', () => {
    const hit = { kind: 'hit', branch: find('paid_once', 'build_tracker') };
    assert.strictEqual(Jev.gate(hit, 1).kind, 'fake');
    assert.strictEqual(Jev.gate(hit, 2).kind, 'hit');
    const fake = find('paid_once', 'build_tracker').fake;
    assert.deepStrictEqual(fake.effects.repo, { name: 'spin-cycle', broken: true });
    assert.strictEqual(fake.effects.goto, 'app_built');
    assert.strictEqual(Jev.gate({ kind: 'hit', branch: find('app_users', 'monetize_sponsor') }, 2).kind, 'locked');
    assert.strictEqual(Jev.gate({ kind: 'hit', branch: find('app_users', 'monetize_sponsor') }, 3).kind, 'hit');
  });
  await t('branches without minModel, nudges and misses are never locked', () => {
    assert.strictEqual(Jev.gate({ kind: 'hit', branch: find('broke', 'build_bakery_site') }, 1).kind, 'hit');
    assert.strictEqual(Jev.gate({ kind: 'partial', branch: find('paid_once', 'build_tracker') }, 1).kind, 'partial');
    assert.strictEqual(Jev.gate({ kind: 'miss' }, 1).kind, 'miss');
  });
  await t('minFollowers locks a hit until the player has enough followers on Y', () => {
    const promote = { kind: 'hit', branch: find('app_live', 'promote_app') };
    assert.deepStrictEqual([Jev.gate(promote, 1, 12).kind, Jev.gate(promote, 1, 12).lockReason], ['locked', 'followers']);
    assert.strictEqual(Jev.gate(promote, 1, 40).kind, 'hit');
    assert.strictEqual(Jev.gate(promote, 1).kind, 'hit', 'no follower count → no follower gate');
    // the model gate comes first
    const sponsor = { kind: 'hit', branch: find('app_users', 'monetize_sponsor') };
    assert.strictEqual(Jev.gate(sponsor, 2, 500).lockReason, 'model');
    assert.strictEqual(Jev.gate(sponsor, 3, 100).lockReason, 'followers');
    assert.strictEqual(Jev.gate(sponsor, 3, 150).kind, 'hit');
  });

  await t('offline post rating: spam scores 0, substance and trends score higher', () => {
    const K = globalThis.Keywords;
    const tr = S.y.trends;
    assert.strictEqual(K.ratePost('follow me pls', tr), 0);
    assert.ok(K.ratePost('FOLLOW ME FOLLOW ME NOW', tr) < 0.8);
    const bland = K.ratePost('Nice weather today.', tr);
    const trendy = K.ratePost('Rent is due on the 7th and my wallet is crying. Anyone else living on noodles?', tr);
    assert.ok(trendy > bland + 1, `${trendy} should beat ${bland}`);
    assert.ok(trendy <= 4);
  });

  await t('atModel swaps in a better response and effects on stronger tiers', () => {
    const who = find('broke', 'who');
    assert.match(Jev.outcome(who, 3).response, /context window/);
    assert.strictEqual(Jev.outcome(who, 3).effects, undefined);
    const deep = Jev.outcome(who, 5);
    assert.match(deep.response, /parking lot/);
    assert.deepStrictEqual(deep.effects, { set: { knowsParkingLot: true } });
  });
  await t('model tiers get pricier and unlock in increasing order', () => {
    for (let i = 1; i < S.models.length; i++) {
      const [a, b] = [S.models[i - 1], S.models[i]];
      assert.ok(b.price > a.price && b.promptBase > a.promptBase && b.perWord > a.perWord, `${b.name} should cost more than ${a.name}`);
    }
    assert.strictEqual(S.models[0].price, 0);
  });

  await t('no server → offline, keyword matcher decides', async () => {
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
    const d = await Jev.decide('build a website for the crumb and coin bakery', branches('broke'), { node: 'broke', thresholds: th });
    assert.strictEqual(Jev.status, 'offline');
    assert.strictEqual(d.engine, 'keywords');
    assert.strictEqual(outcome(d), 'hit:build_bakery_site');
  });

  await t('server online → Jev decides; one failed call falls back without going offline', async () => {
    let decideCalls = 0;
    let failNext = false;
    globalThis.fetch = async (url, init) => {
      if (url === 'api/status') return { ok: true, json: async () => ({ jev: true, model: 'jev-latest' }) };
      decideCalls++;
      const body = JSON.parse(init.body);
      assert.strictEqual(body.node, 'broke');
      assert.ok(body.candidates.includes('build_bakery_site'));
      if (failNext) return { ok: false, status: 502, json: async () => ({ error: 'upstream down' }) };
      return { ok: true, json: async () => ({ choice: 'research', confidence: 0.7, probabilities: { research: 0.7, no_progress: 0.3 }, model: 'jev-latest' }) };
    };
    // a fresh copy, so init() checks the server again with the new fetch
    delete require.cache[require.resolve('../src/jev.js')];
    const Fresh = require('../src/jev.js');
    const d = await Fresh.decide('any work out there?', branches('broke'), { node: 'broke', thresholds: th });
    assert.strictEqual(Fresh.status, 'online');
    assert.strictEqual(d.engine, 'jev');
    assert.strictEqual(outcome(d), 'hit:research');
    failNext = true;
    const d2 = await Fresh.decide('build a website for the crumb and coin bakery', branches('broke'), { node: 'broke', thresholds: th });
    assert.strictEqual(d2.engine, 'keywords');
    assert.strictEqual(d2.fellBack, true);
    assert.strictEqual(Fresh.status, 'online');
    assert.match(Fresh.last.error, /upstream down/);
    assert.strictEqual(decideCalls, 2);
  });

  console.log(fail ? `\n${fail} failing` : '\nall passing');
  process.exit(fail ? 1 : 0);
})();
