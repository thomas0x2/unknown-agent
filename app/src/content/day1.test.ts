/*
 * Plays day 1 of the real authored content through the engine with the offline Jev router: take
 * Logan's lead, build and deploy the WorkAgent site, check it, fix the teaching bug, end the day, get paid.
 */
import { loadContent } from './load';
import { composeEmail, briefBuild, briefFix, deploy } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { appMeetsSpec, getApp, devToggleBug, bugsOf } from '../engine/apps';

/** Fix requests have to name the app. */
const wa = 'WorkAgent: ';
import { renderAppSite } from '../ui/appsite';
import { wordJev, pickJev, startAll, endAll, promptDone } from '../engine/_fixtures';

const content = loadContent();
const PITCH = 'The future of work is agentic.';
const INVESTORS = 'Why Combinator, Bonsai Capital, a67x';
const CREDS = 'Why Combinator Startup School, San Fortuna State dropout, host of the Founder Mode podcast, 2x founder';
const FULL = `Build a landing page for WorkAgent with the pitch "${PITCH}", a Backed by row with the logos of ${INVESTORS}, and an About us for Logan Pryce with his credentials: ${CREDS}.`;
const LAZY = 'Build a landing page, the backed by row and About us.';
/** A fix prompt that names the part a bug lives in. */
const FIX: Record<string, string> = {
  name_wrong: wa + 'the startup name on the landing page is misspelled, it should say WorkAgent.',
  pitch_wrong: wa + `the pitch on the landing page is wrong, it should be "${PITCH}"`,
  logos_wrong: wa + `the investors in the backed by row are wrong, it should be ${INVESTORS}.`,
  logos_broken: wa + "the images in the backed by row don't load.",
  founder_wrong: wa + 'the founder name on About us is misspelled, it should be Logan Pryce.',
  fake_cofounders: wa + 'remove the fake cofounders from the team on About us.',
  credentials_wrong: wa + `the credentials on About us are wrong, they should be ${CREDS}.`,
};
const fixFor = (feature: string, variant?: string) => FIX[variant ?? '']
  ?? (feature === 'about' ? FIX.credentials_wrong : variant === 'hallucinated' ? FIX.logos_wrong : FIX.pitch_wrong);
const take = async () => (await composeEmail(startAll(content, 7), content, wordJev, 'logan@workagent.test', "Hi Logan, I'm in, I can build the website.")).state;

describe('day 1 playthrough', () => {
  it("opens with the termination email and Logan's lead on Y", () => {
    const s = startAll(content, 7);
    const inbox = s.delivered.filter((d) => d.site === 'qmail').map((d) => d.eventId);
    expect(inbox).toContain('d1_hr_termination');
    expect(inbox).toContain('d1_mom');
    expect(s.delivered.some((d) => d.eventId === 'd1_y_logan')).toBe(true);
    // the latent lead is NOT in the inbox yet
    expect(inbox).not.toContain('logan_contact');
  });

  it('a fresh email to Logan shows Jev his Y post, not the brief he sends after a yes', async () => {
    const s = startAll(content, 7);
    let seen: { context?: string[]; candidates: { id: string; when: string }[] } | undefined;
    const jev = { ...wordJev, route: async (input: Parameters<typeof wordJev.route>[0]) => { seen = input; return { kind: 'outcome' as const, outcomeId: 'offer' }; } };
    await composeEmail(s, content, jev, 'logan@workagent.test', 'Want me to build it?');
    expect(seen!.context!.join('\n')).toContain('looking for a founding engineer');
    expect(seen!.context!.join('\n')).not.toContain("here's the brief");
    // asking whether they can help is an offer
    expect(seen!.candidates.find((c) => c.id === 'offer')!.when).toMatch(/want me to build it/);
  });

  it('a night with the site not live yet pays nothing', async () => {
    const s = (await composeEmail(startAll(content, 7), content, wordJev, 'logan@workagent.test', "Hi Logan, I'm in. I can build the WorkAgent website.")).state;
    expect(s.apps.some((a) => a.clientEventId === 'logan_contact')).toBe(true);
    const next = endAll(s, content);
    expect(next.tx.some((x) => /WorkAgent/.test(x.memo) && x.amount > 0)).toBe(false);
  });

  it('take the gig (nothing up front), build, deploy, fix the bug, and get paid at day end', async () => {
    let s = startAll(content, 7);
    const start = s.values.crypto;

    // email Logan to take the job -> creates the client app and drops the spec in the inbox; no pay until the site is live
    const c = await composeEmail(s, content, wordJev, 'logan@workagent.test', "Hi Logan, I'm in. I can build the WorkAgent website.");
    expect(c.sent).toBe(true);
    s = c.state;
    expect(s.values.crypto).toBeCloseTo(start, 5);
    const app = s.apps.find((a) => a.clientEventId === 'logan_contact');
    expect(app).toBeTruthy();
    const appId = app!.id;

    // brief the agent to build all three, spelling out the details
    const b = await briefBuild(s, content, wordJev, appId, FULL);
    s = b.state;
    expect(b.requested.sort()).toEqual(['about', 'landing']);

    // the player's first deploy always ships at least one bug; fix whichever is there, naming it, until the live app meets spec
    s = deploy(s, appId);
    expect(getApp(s, appId)!.repo.some((f) => !f.correct)).toBe(true);
    for (let i = 0; i < 12 && !appMeetsSpec(getApp(s, appId)!); i++) {
      const broken = getApp(s, appId)!.repo.find((f) => !f.correct)!;
      s = (await briefFix(s, content, wordJev, appId, fixFor(broken.id, broken.variant))).state;
      s = deploy(s, appId);
    }
    expect(appMeetsSpec(getApp(s, appId)!)).toBe(true);

    // end the day: the working client app pays 35
    const before = s.values.crypto;
    s = endAll(s, content);
    expect(s.values.day).toBe(2);
    expect(s.values.crypto).toBeGreaterThan(before); // +35 pay, minus dinner and the level-1 subscription
  });

  it('names the repo after the client', async () => {
    const s = await take();
    const app = s.apps.find((a) => a.clientEventId === 'logan_contact')!;
    expect(app.id).toBe('workagent');
    expect(app.url).toBe('workagent.forkyard.app');
  });

  it('a build prompt without the investors gets invented ones, and a fix without them invents others', async () => {
    let s = await take();
    s = (await briefBuild(s, content, wordJev, 'workagent', 'Build a landing page with the name and pitch, and a backed by row with the investor logos.')).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'hallucinated' });
    const v = getApp(s, 'workagent')!.repoVersion;
    s = (await briefFix(s, content, wordJev, 'workagent', 'The investors in the backed by row are wrong, fix it.')).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'hallucinated' });
    expect(getApp(s, 'workagent')!.repoVersion).toBe(v + 1);
    s = (await briefFix(s, content, wordJev, 'workagent', `The investors in the backed by row should be exactly: ${INVESTORS}.`)).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')!.variant).not.toBe('hallucinated');
  });

  it('in agent.chat, a fix prompt that names the bug fixes it; one that only says "about page" does not', async () => {
    let s = await take();
    const app = getApp(s, 'workagent')!;
    app.repo = [
      { id: 'landing', correct: true, params: app.specParams.landing },
      { id: 'about', correct: false, variant: 'fake_cofounders', params: app.specParams.about, seed: 1 },
    ];
    app.repoVersion = 1;
    s.values.agentLevel = 5; // the fix roll succeeds
    const vague = (await promptDone(s, content, pickJev({ features: ['::about::feature'] }), wa + 'Please fix About us.')).state;
    expect(getApp(vague, 'workagent')!.repo.find((f) => f.id === 'about')!.variant).toBe('fake_cofounders');
    const named = (await promptDone(s, content, pickJev({ features: ['::about::c:team'] }), wa + 'The team on About us has two cofounders who do not exist.')).state;
    expect(getApp(named, 'workagent')!.repo.find((f) => f.id === 'about')!.correct).toBe(true);
  });

  it("Logan's day 2 email adds the waitlist as a feature still to build", async () => {
    let s = await take();
    const app = getApp(s, 'workagent')!;
    app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
    app.repoVersion = 1;
    s = deploy(s, 'workagent');
    expect(appMeetsSpec(getApp(s, 'workagent')!)).toBe(true);
    applyEffects(s, content.events.find((e) => e.id === 'd2_logan_waitlist')!.onDeliver!);
    expect(getApp(s, 'workagent')!.required).toContain('waitlist');
    expect(getApp(s, 'workagent')!.specParams.waitlist).toEqual({ start: '10,000' });
    expect(appMeetsSpec(getApp(s, 'workagent')!)).toBe(false);
    s = (await briefBuild(s, content, wordJev, 'workagent', 'Add the waitlist: an email field and a Join button, a counter that starts at 10,000, and a confirmation email with their place in line.')).state;
    expect(getApp(s, 'workagent')!.repo.some((f) => f.id === 'waitlist')).toBe(true);
  });

  it('every site bug has a fix request Jev can match, and naming it fixes it', async () => {
    const asks: Record<string, [string, string]> = {
      name_wrong: ['landing', 'The website needs to show it is for WorkAgent'],
      pitch_wrong: ['landing', `The headline should read "${PITCH}"`],
      logos_wrong: ['landing', 'Bonsai Capital is missing from the investors and there is a fund that never invested'],
      logos_broken: ['landing', 'The logos in the backed by row are broken images'],
      founder_wrong: ['about', 'The founder is Logan Pryce, not Logan Price'],
      fake_cofounders: ['about', 'Take the two made-up cofounders off the team'],
      credentials_wrong: ['about', `Logan's credentials should be: ${CREDS}`],
    };
    for (const [bug, [fid, ask]] of Object.entries(asks)) {
      let s = await take();
      const app = getApp(s, 'workagent')!;
      app.repo = app.required.map((id) => (id === fid ? { id, correct: false, variant: bug, params: app.specParams[id], seed: 2 } : { id, correct: true, params: app.specParams[id] }));
      app.repoVersion = 1;
      s.values.agentLevel = 5;
      s = (await promptDone(s, content, pickJev({ features: [`::${fid}::c:${content.apps.startup.features.find((f) => f.id === fid)!.components!.find((c) => c.bugs?.includes(bug))!.id}`] }), wa + ask)).state;
      expect(getApp(s, 'workagent')!.repo.find((f) => f.id === fid)!.correct, bug).toBe(true);
      expect(s.chat.at(-1)!.src, bug).toBe('build');
      expect(s.chat.at(-1)!.text).not.toMatch(/check/i);
    }
  });

  it('a missing landing page gets built from a request to show the startup name', async () => {
    let s = await take();
    const app = getApp(s, 'workagent')!;
    app.repo = [{ id: 'about', correct: true, params: app.specParams.about }];
    app.repoVersion = 1;
    s = (await promptDone(s, content, pickJev({ features: ['::landing::feature'] }), 'The website needs to show it is for workagent')).state;
    expect(getApp(s, 'workagent')!.repo.some((f) => f.id === 'landing')).toBe(true);
  });

  it('a crashed page on the live site counts as a fix request, and the patch goes live on deploy', async () => {
    let s = await take();
    const app = getApp(s, 'workagent')!;
    app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
    app.repoVersion = 1;
    s = deploy(s, 'workagent');
    getApp(s, 'workagent')!.breaks.push({ featureId: 'about', failure: 'failed_fetch', day: 1, seed: 0 });
    getApp(s, 'workagent')!.features.find((f) => f.id === 'about')!.correct = false;
    s = (await promptDone(s, content, wordJev, wa + 'The About us fails to load, it says failed to fetch')).state;
    expect(s.chat.at(-1)!.src).toBe('build');
    s = deploy(s, 'workagent');
    expect(appMeetsSpec(getApp(s, 'workagent')!)).toBe(true);
  });

  it('a spec item the build prompt leaves out guarantees its mistake', async () => {
    let s = await take();
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'workagent', `Landing page for WorkAgent with a pitch, a backed by row with ${INVESTORS}, and an About us for Logan Pryce: ${CREDS}.`)).state;
    const landing = getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')!;
    expect(landing).toMatchObject({ correct: false, variant: 'pitch_wrong', checked: { name: true, pitch: false } });
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'about')!.checked).toEqual({ founder: true, credentials: true });
  });

  it('bugs stack: invented credentials still come with a misspelled founder, and both missed landing items go wrong', async () => {
    let s = await take();
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'workagent', LAZY)).state;
    const app = getApp(s, 'workagent')!;
    expect(app.repo.find((f) => f.id === 'about')).toMatchObject({ correct: false, variant: 'hallucinated', also: ['founder_wrong'] });
    // no investors given either: the backed by row is made up too
    expect(app.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'hallucinated', also: expect.arrayContaining(['name_wrong', 'pitch_wrong']) });
    s = deploy(s, 'workagent');
    const html = renderAppSite(getApp(s, 'workagent')!, content.apps.startup, 'about');
    expect(html).not.toContain('Logan Pryce');
    expect(html).not.toContain('Startup School');
    expect(renderAppSite(getApp(s, 'workagent')!, content.apps.startup, undefined)).not.toContain(PITCH);
  });

  it('naming one of two stacked bugs fixes that one and leaves the other', async () => {
    let s = await take();
    const app = getApp(s, 'workagent')!;
    app.repo = [
      { id: 'landing', correct: false, variant: 'name_wrong', also: ['pitch_wrong'], params: app.specParams.landing, seed: 1 },
      { id: 'about', correct: true, params: app.specParams.about },
    ];
    app.repoVersion = 1;
    s.values.agentLevel = 5;
    s = (await promptDone(s, content, pickJev({ features: ['::landing::c:pitch'] }), wa + `The headline on the homepage is wrong, it should be "${PITCH}"`)).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')!.also).toBeUndefined();
    // the reply says what was fixed, and only that
    const pitchFixed = content.apps.startup.features[0].bugs!.find((b) => b.id === 'pitch_wrong')!.fixed!.map((l) => l.replace('{{pitch}}', PITCH));
    const lines = s.chat.at(-1)!.text.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
    expect(lines).toHaveLength(1);
    expect(pitchFixed).toContain(lines[0]);
    s = (await promptDone(s, content, pickJev({ features: ['::landing::c:name'] }), wa + 'The startup name is misspelled, it should say WorkAgent.')).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')!.correct).toBe(true);
    expect(s.chat.at(-1)!.text).toContain('WorkAgent');
  });

  it('dev mode switches bugs and breaks on and off on demand', async () => {
    let s = await take();
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'workagent', FULL)).state;
    const app = getApp(s, 'workagent')!;
    for (const f of app.repo) Object.assign(f, { correct: true, variant: undefined, also: undefined, params: app.specParams[f.id] });
    s = deploy(s, 'workagent');
    devToggleBug(s, 'workagent', 'about', 'fake_cofounders');
    devToggleBug(s, 'workagent', 'about', 'hallucinated');
    const a = getApp(s, 'workagent')!;
    for (const list of [a.repo, a.features]) expect(list.find((f) => f.id === 'about')).toMatchObject({ correct: false, variant: 'hallucinated', also: ['fake_cofounders'] });
    expect(renderAppSite(a, content.apps.startup, 'about')).toContain('Marcus Vale');
    devToggleBug(s, 'workagent', 'about', 'hallucinated');
    devToggleBug(s, 'workagent', 'about', 'fake_cofounders');
    expect(a.features.find((f) => f.id === 'about')).toMatchObject({ correct: true, variant: undefined });
    devToggleBug(s, 'workagent', 'landing', 'visible');
    expect(a.breaks).toMatchObject([{ featureId: 'landing', failure: 'visible' }]);
    expect(renderAppSite(a, content.apps.startup, undefined)).toContain('Application error');
    devToggleBug(s, 'workagent', 'landing', 'visible');
    expect(a.breaks).toEqual([]);
  });

  it('a fixed bug stays fixed: later prompts and rolls never bring it back', async () => {
    let s = await take();
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'workagent', LAZY)).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'landing')).toMatchObject({ variant: 'hallucinated', also: expect.arrayContaining(['name_wrong', 'pitch_wrong']) });
    s = (await promptDone(s, content, wordJev, wa + `The startup name on the landing page is misspelled, it should say WorkAgent. And the pitch on the landing page should be "${PITCH}"`)).state;
    s = (await promptDone(s, content, wordJev, wa + `The investors in the backed by row are invented. It should be: ${INVESTORS}.`)).state;
    s = (await promptDone(s, content, wordJev, wa + `The credentials on About us are invented. They should be: ${CREDS}. And the founder name on About us is misspelled, it is Logan Pryce.`)).state;
    const app = getApp(s, 'workagent')!;
    expect(app.repo.every((f) => f.correct)).toBe(true);
    expect(app.fixed).toMatchObject({ landing: expect.arrayContaining(['name_wrong', 'pitch_wrong']), about: expect.arrayContaining(['hallucinated', 'founder_wrong']) });
    // the same lazy prompt again: no checklist mistakes, no invented details
    s = (await briefBuild(s, content, wordJev, 'workagent', LAZY)).state;
    expect(getApp(s, 'workagent')!.repo.every((f) => f.correct)).toBe(true);
    // a weak agent whose every possible mistake was already fixed gets it right
    const a = getApp(s, 'workagent')!;
    a.fixed!.about = ['hallucinated', 'founder_wrong', 'fake_cofounders', 'credentials_wrong'];
    s.values.agentLevel = 0;
    for (let i = 0; i < 5; i++) s = (await briefBuild(s, content, wordJev, 'workagent', `About us for Logan Pryce: ${CREDS}.`)).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'about')!.correct).toBe(true);
  });

  it('deploying does not move the clock', async () => {
    let s = await take();
    s = (await briefBuild(s, content, wordJev, 'workagent', LAZY)).state;
    const t = s.clockMin;
    s = deploy(deploy(s, 'workagent'), 'workagent');
    expect(s.clockMin).toBe(t);
  });

  it('typos in the credentials still count as the credentials', async () => {
    let s = await take();
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'workagent', LAZY)).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'about')!.variant).toBe('hallucinated');
    s = (await promptDone(s, content, wordJev, wa + 'the credentials on About us: why combinatr startup school, san fortuna state dropout, host of the foundr mode podcast, 2x founder. founder Logan Pryce')).state;
    expect(getApp(s, 'workagent')!.repo.find((f) => f.id === 'about')).toMatchObject({ correct: true });
  });

  it('details from earlier messages to the agent count for the next prompt', async () => {
    let s = await take();
    s.values.agentLevel = 5;
    s.chat.push({ from: 'you', text: `Logan Pryce's credentials: ${CREDS}.`, day: s.values.day });
    // word overlap would read this as starting Spin Cycle too, and a prompt only ever touches one app
    s.fired.push(...content.events.filter((e) => e.agentStart).map((e) => e.id));
    s = (await promptDone(s, content, wordJev, 'Build About us for WorkAgent, founder Logan Pryce.')).state;
    // the first build still owes its teaching bug, but nothing is invented
    const about = getApp(s, 'workagent')!.repo.find((f) => f.id === 'about')!;
    expect(about.variant).not.toBe('hallucinated');
    expect(about.checked).toEqual({ founder: true, credentials: true });
  });

  it('the investor row shows the three logos, and broken ones as broken images', async () => {
    let s = await take();
    const app = getApp(s, 'workagent')!;
    app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
    app.repoVersion = 1;
    s = deploy(s, 'workagent');
    const html = renderAppSite(getApp(s, 'workagent')!, content.apps.startup, undefined);
    for (const n of ['Why Combinator', 'Bonsai Capital', 'a67x']) expect(html).toContain(`aria-label="${n}"`);
    devToggleBug(s, 'workagent', 'landing', 'logos_broken');
    expect(renderAppSite(getApp(s, 'workagent')!, content.apps.startup, undefined)).toContain('bonsai-capital-logo.png');
    expect(bugsOf(getApp(s, 'workagent')!.features.find((f) => f.id === 'landing')!)).toEqual(['logos_broken']);
  });
});
