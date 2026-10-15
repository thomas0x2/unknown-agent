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

console.log(fail ? `\n${fail} failing` : '\nall passing');
process.exit(fail ? 1 : 0);
