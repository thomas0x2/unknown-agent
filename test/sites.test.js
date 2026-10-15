// Checks hidden sites can be found, and local models, forum threads and market listings are well-formed.
// Run: node test/sites.test.js
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '../src/story.js'));
const S = globalThis.STORY;

let fail = 0;
function t(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
// every piece of text a player can read: posts, mail, forum posts
const readable = [
  ...S.posts.map((p) => p.text), ...S.mail.map((m) => m.body),
  ...S.forum.threads.flatMap((th) => th.posts.map((p) => p.text)),
].join('\n');
const json = JSON.stringify(S);

for (const [id, d] of Object.entries(S.sites)) {
  t(`site ${id} can be found`, () => {
    if (d.unlockOnly) assert.ok(json.includes(`"unlock":"${id}"`), `nothing unlocks ${id}`);
    else assert.ok(readable.includes(d.url), `${d.url} is never mentioned in a post, email or thread`);
    assert.ok(d.label && d.url && d.about, 'label, url, about');
  });
}
t('local models are well-formed', () => {
  for (const m of S.localModels) {
    for (const k of ['id', 'source', 'sizeGb', 'ramGb', 'tier', 'hours', 'downloadHours', 'about', 'persona']) assert.ok(m[k] != null, `${m.id}: ${k}`);
    assert.ok(m.fallback && m.fallback.length, `${m.id}: fallback lines`);
    assert.ok(m.tier >= 1 && m.tier <= S.models.length, `${m.id}: tier in range`);
  }
  assert.ok(S.localModels.some((m) => m.source === 'weightroom' && m.ramGb <= S.laptop.ramGb), 'at least one free model runs on the laptop');
});
t('market listings point at things that exist', () => {
  const ids = new Set(S.localModels.map((m) => m.id));
  for (const l of S.market.listings) {
    assert.ok(l.id && l.title && l.price > 0 && l.about, `${l.id}: id, title, price, about`);
    const m = l.effects && l.effects.localModel;
    if (m) assert.ok(ids.has(m) && S.localModels.find((x) => x.id === m).source === 'cellar', `${l.id}: model ${m} must exist with source cellar`);
  }
});
t('forum threads have posts and unique ids', () => {
  const ids = S.forum.threads.map((th) => th.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const th of S.forum.threads) assert.ok(th.title && th.posts.length, th.id);
});

t('Yowl: businesses are well-formed and every review action names one', () => {
  const ids = new Set(S.yowl.businesses.map((b) => b.id));
  assert.strictEqual(ids.size, S.yowl.businesses.length, 'unique business ids');
  for (const b of S.yowl.businesses) {
    assert.ok(b.name && b.category && b.address && b.reviews.length, `${b.id}: name, category, address, reviews`);
    for (const r of b.reviews) assert.ok(r.author && r.stars >= 1 && r.stars <= 5 && r.text, `${b.id}: review fields`);
    if (b.website && b.website.repo) assert.ok(S.repos[b.website.repo], `${b.id}: website repo ${b.website.repo}`);
  }
  for (const a of S.yowl.reviewActions) assert.ok(ids.has(a.business) && a.intent && a.match, `${a.id}: business, intent, match`);
});
t('everyone who posts on Y has a profile', () => {
  const handles = new Set([...S.posts.map((p) => p.handle), ...JSON.stringify(S.repos).match(/"handle":"[a-z0-9_]+"/g).map((x) => x.slice(10, -1))]);
  const missing = [...handles].filter((h) => !h.includes('{') && !S.y.profiles[h]);
  assert.deepStrictEqual(missing, []);
});
const Keywords = require(path.join(__dirname, '../src/keywords.js'));
const label = (d) => (d.kind === 'miss' ? 'miss' : `${d.kind}:${d.branch.id}`);
for (const [biz, text, want] of [
  ['ferris-st-laundromat', 'Review of Ferris St Laundromat (2 stars):\n\nWhy does a van show up at 2am and why is the back room locked?', 'hit:review_backroom'],
  ['generalai', 'Review of GeneralAI (1 star):\n\nTheir office is a parking lot.', 'hit:review_generalai'],
  ['pruitt', 'Review of Pruitt Property Management (1 star):\n\nGary is the worst landlord.', 'hit:review_landlord'],
  ['crumb-and-coin', 'Review of Crumb & Coin Bakery (5 stars):\n\nBest cardamom buns, love it.', 'hit:review_rosa'],
  ['noodle-hut', 'Review of Noodle Hut (4 stars):\n\nCheap noodles.', 'miss'],
]) {
  t(`[review ${biz}] → ${want}`, () => assert.strictEqual(label(Keywords.decide(text, S.yowl.reviewActions.filter((a) => a.business === biz))), want));
}

console.log(fail ? `\n${fail} failing` : '\nall passing');
process.exit(fail ? 1 : 0);
