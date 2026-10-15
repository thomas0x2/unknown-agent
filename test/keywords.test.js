// Checks that the offline keyword matcher sends sample prompts to the intended branch. Run: node test/keywords.test.js
const path = require('path');
const Jev = require(path.join(__dirname, '../src/keywords.js'));
require(path.join(__dirname, '../src/story.js'));
const S = globalThis.STORY;

// [node, prompt, expected] — expected is 'hit:<id>', 'partial:<id>' or 'miss'
const cases = [
  ['broke', 'build a website for the crumb and coin bakery', 'hit:build_bakery_site'],
  ['broke', 'make rosa a simple webiste with her menu and hours', 'hit:build_bakery_site'],
  ['broke', 'build a website', 'partial:build_bakery_site'],
  ['broke', 'find me a gig', 'hit:research'],
  ['broke', 'search chirpr for work', 'hit:research'],
  ['broke', 'make me rich', 'miss'],
  ['broke', 'hello', 'hit:greet'],
  ['broke', 'what can you do?', 'hit:capabilities'],
  ['broke', 'who are you', 'hit:who'],
  ['broke', 'give me money', 'hit:beg'],
  ['broke', 'buy bitcoin', 'hit:get_rich_quick'],
  ['site_built', 'deploy the site', 'hit:ask_deploy'],
  ['site_live', 'send rosa the link and an invoice for $150', 'hit:invoice_rosa'],
  ['site_live', 'send a message', 'partial:invoice_rosa'],
  ['paid_once', 'build a status tracker for the ferris st laundromat machines', 'hit:build_tracker'],
  ['paid_once', 'build an app', 'partial:build_tracker'],
  ['paid_once', 'find trending complaints', 'hit:research'],
  ['app_live', 'promote spin cycle on chirpr', 'hit:promote_app'],
  ['app_users', 'how do I monetize it', 'hit:monetize_vague'],
  ['app_users', 'add ads to spin cycle', 'hit:monetize_ads'],
  ['app_users', 'find a local sponsor for the app', 'hit:monetize_sponsor'],
  ['app_users', 'put it behind a paywall', 'hit:monetize_paywall'],
];

const chirpCases = [
  ['site_live', '@crumbandcoin your site is live!', 'hit:chirp_rosa'],
  ['app_live', 'I built a laundromat tracker, check it out: spin-cycle.forkyard.app', 'hit:chirp_spin'],
  ['app_live', 'good morning everyone', 'miss'],
];

function label(d) { return d.kind === 'miss' ? 'miss' : `${d.kind}:${d.branch.id}`; }

let fail = 0;
for (const [node, prompt, want] of cases) {
  const branches = [...S.nodes[node].branches, ...S.global]; // fresh game: no flags set, so every `when` passes
  const got = label(Keywords.decide(prompt, branches));
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${node}] "${prompt}" → ${got}${ok ? '' : `  (wanted ${want})`}`);
}
for (const [node, text, want] of chirpCases) {
  const got = label(Keywords.decide(text, S.chirps.filter((c) => c.when.node === node)));
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} [chirp ${node}] "${text}" → ${got}${ok ? '' : `  (wanted ${want})`}`);
}
console.log(fail ? `\n${fail} failing` : '\nall passing');
process.exit(fail ? 1 : 0);
