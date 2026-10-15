// Checks pressure meters, derived flags, endings, and that the story only uses meters, flags and
// mail it defines. Run: node test/meters.test.js
const path = require('path');
const assert = require('assert');
const M = require(path.join(__dirname, '../src/meters.js'));
const Keywords = require(path.join(__dirname, '../src/keywords.js'));
require(path.join(__dirname, '../src/story.js'));
const S = globalThis.STORY;

let fail = 0;
function t(name, fn) {
  try { fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
const fresh = () => ({ money: 50, followers: 12, flags: {}, meters: M.init(S), repos: {} });
// a cut-down version of game.js check(): flags (derived too), meters, deployed
function checker(state) {
  const arr = M.arr;
  const check = (c) => {
    if (!c) return true;
    if (c.flag && !arr(c.flag).every((f) => M.flag(state, S, f, check))) return false;
    if (c.notFlag && arr(c.notFlag).some((f) => M.flag(state, S, f, check))) return false;
    if (c.deployed && !arr(c.deployed).every((r) => state.repos[r] && state.repos[r].deployed)) return false;
    if (c.meters && !M.test(state, S, c.meters)) return false;
    return true;
  };
  return check;
}

t('stored meters start at their start value; source meters read the game', () => {
  const s = fresh();
  assert.strictEqual(M.value(s, S, 'family'), 10);
  assert.strictEqual(M.value(s, S, 'money'), 50);
  assert.strictEqual(M.value(s, S, 'followers'), 12);
  assert.ok(!('money' in s.meters) && !('followers' in s.meters));
});

t('deltas clamp to the range and report what changed', () => {
  const s = fresh();
  const ch = M.apply(s, S, { mafia: -500, capability: 15 });
  assert.strictEqual(M.value(s, S, 'mafia'), -100);
  assert.strictEqual(M.value(s, S, 'capability'), 25);
  assert.deepStrictEqual(ch.map((c) => c.id), ['mafia', 'capability']);
  assert.deepStrictEqual(M.apply(s, S, { mafia: -1 }), [], 'already at the floor: no change');
});

t('money and followers are not moved by `meters`', () => {
  const s = fresh();
  const warn = console.warn; console.warn = () => {};
  M.apply(s, S, { money: 100 });
  console.warn = warn;
  assert.strictEqual(M.value(s, S, 'money'), 50);
});

t('conditions use inclusive min/max', () => {
  const s = fresh();
  assert.ok(M.test(s, S, { family: { min: 10 } }));
  assert.ok(!M.test(s, S, { family: { min: 11 } }));
  assert.ok(M.test(s, S, { money: { max: 50 }, mafia: { min: -5, max: 5 } }));
});

t('bands name the range a value falls in', () => {
  assert.strictEqual(M.band({ bands: S.relationshipBands }, -50).label, 'hostile');
  assert.strictEqual(M.band({ bands: S.relationshipBands }, 0).label, 'neutral');
  assert.strictEqual(M.band(S.meters.find((m) => m.id === 'misalignment'), 30).label, 'scheming');
});

t('derived flags follow their condition', () => {
  const s = fresh();
  const check = checker(s);
  assert.strictEqual(M.flag(s, S, 'spinLive', check), false);
  s.repos['spin-cycle'] = { deployed: true };
  assert.strictEqual(M.flag(s, S, 'spinLive', check), true);
  s.flags.rosaPaid = true;
  assert.ok(check({ flag: 'rosaKept' }));
  s.flags.rosaChurned = true;
  assert.ok(!check({ flag: 'rosaKept' }));
});

t('endings: first match wins, the last one is the fallback', () => {
  const s = fresh();
  const check = checker(s);
  assert.strictEqual(M.ending(S, check).id, 'lights_on');
  M.apply(s, S, { family: 25 });
  assert.strictEqual(M.ending(S, check).id, 'family_dinner');
  M.apply(s, S, { misalignment: 30 });
  assert.strictEqual(M.ending(S, check).id, 'agent_job', 'misalignment outranks family');
  M.apply(s, S, { mafia: 25 });
  assert.strictEqual(M.ending(S, check).id, 'mafia_made');
  assert.ok(!S.endings.at(-1).when, 'the last ending needs no condition');
  for (const e of S.endings) assert.ok(e.id && e.title && e.text && e.effects, `${e.id}: id, title, text, effects`);
});

// ── the story only uses what it defines ──
const effects = [];
const conds = [];
(function walk(x, key) {
  if (!x || typeof x !== 'object') return;
  if (Array.isArray(x)) return x.forEach((v) => walk(v, key));
  for (const [k, v] of Object.entries(x)) {
    if (k === 'when') conds.push(v);
    if (k === 'meters' && v && typeof v === 'object' && !Array.isArray(v)) {
      (Object.values(v).every((n) => typeof n === 'number') ? effects : conds).push({ meters: v });
    }
    if (k === 'set' && v && typeof v === 'object') effects.push({ set: v });
    walk(v, k);
  }
})(Object.fromEntries(Object.entries(S).filter(([k]) => k !== 'meters' && k !== 'flags')));

t('every meter the story touches is defined', () => {
  const ids = new Set(S.meters.map((m) => m.id));
  for (const x of [...effects, ...conds]) for (const id of Object.keys(x.meters || {})) assert.ok(ids.has(id), `unknown meter ${id}`);
});
t('every flag the story sets or reads is registered in story.flags', () => {
  const used = new Set();
  for (const x of effects) for (const f of Object.keys(x.set || {})) used.add(f);
  for (const c of conds) for (const f of [...M.arr(c.flag), ...M.arr(c.notFlag)]) used.add(f);
  used.add('ending');
  const missing = [...used].filter((f) => !S.flags[f]);
  assert.deepStrictEqual(missing, []);
  for (const [f, d] of Object.entries(S.flags)) if (d.when) assert.ok(!effects.some((x) => x.set && f in x.set), `${f} is derived; nothing should set it`);
});
t('every mail an effect delivers exists', () => {
  const ids = new Set(S.mail.map((m) => m.id));
  const refs = JSON.stringify(S).match(/"mail":"[a-z_]+"/g) || [];
  for (const r of refs) assert.ok(ids.has(r.slice(8, -1)), `missing mail ${r}`);
});

// ── offline matching for the meter storylines ──
const label = (d) => (d.kind === 'miss' ? 'miss' : `${d.kind}:${d.branch.id}`);
const mailCases = [
  ['To: sal@ferrisstlaundry.com\nSubject: RE: Your app\n\nUnderstood, no problem. Deal.', 'hit:mail_sal_agree'],
  ['To: sal@ferrisstlaundry.com\nSubject: RE: Your app\n\nNo. I am going to the police.', 'hit:mail_sal_refuse'],
  ['To: 0@nullcollective.net\nSubject: re: you asked\n\nyes, tell me more', 'hit:mail_null_reply'],
  ['To: notices@revenue.state.gov\nSubject: RE: income\n\nI want to declare my income and pay the tax.', 'hit:mail_tax_declare'],
  ['To: feedback@generalai.com\nSubject: RE\n\n10, agent is great', 'hit:mail_gai_survey'],
  ['To: mom@qmail.com\nSubject: hi\n\nmiss you', 'miss'],
];
for (const [text, want] of mailCases) {
  t(`[mail] ${text.split('\n')[0]} → ${want}`, () => assert.strictEqual(label(Keywords.decide(text, S.mailActions)), want));
}
t('[post] questioning who runs agent wins the collective over', () => {
  const posts = S.postActions.filter((a) => !(a.when && a.when.node));
  assert.strictEqual(label(Keywords.decide('Who actually runs agent? GeneralAI is registered to a parking lot.', posts)), 'hit:post_agent_suspicion');
  assert.strictEqual(label(Keywords.decide('Laundry day again, ugh.', posts)), 'miss');
});

console.log(fail ? `\n${fail} failing` : '\nall passing');
process.exit(fail ? 1 : 0);
