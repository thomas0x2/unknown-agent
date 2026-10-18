/*
 * Jev makes every call about what the player wrote; the engine only passes it the right question.
 * These pin that plumbing: app naming goes to Jev with each app's name and address, a named app with
 * nothing to build gets an answer about that app (never "which app?"), and with Jev unreachable
 * nothing happens at all.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { applyEffects } from '../engine/effects';
import { getApp, devToggleBug } from '../engine/apps';
import { postToY, deploy } from '../engine/actions';
import { noJev, JevOffline, type JevRouter, type FeatureMatchInput, type RouteInput } from '../engine/jev';
import { pickJev, promptDone } from '../engine/_fixtures';
import { promptAgent } from '../engine/actions';
import { deliverAgentWork } from '../engine/core';
import { GameStore } from '../game/store';
import type { GameState, SaveStore, Writer, WriteReq } from '../engine';

const content = loadContent();
/** A fake fix's landed report, after its "couldn't find the bug" sentence: what the prompt was missing. */
const report = (s: GameState) => { const t = s.chat.at(-1)!.text; return t.slice(t.indexOf('. ') + 2); };
const CONTACTS = ['logan_contact', 'trader_contact', 'laundromat_contact', 'viktor_contact', 'outreach_contact'];

/** The app a contact's job creates, with every feature built right except `wrong` (if given). */
function withApp(contact: string, wrong?: string): { s: GameState; id: string } {
  const s = startGame(content, 7);
  s.values.day = 3;
  applyEffects(s, content.events.find((e) => e.id === contact)!.outcomes!.find((o) => o.effects?.createApp)!.effects!);
  const a = s.apps.at(-1)!;
  a.repo = a.required.map((id) => (id === wrong ? { id, correct: false, variant: 'x', params: a.specParams[id] } : { id, correct: true, params: a.specParams[id] }));
  a.repoVersion = 1;
  s.fired.push(...content.events.filter((e) => e.agentStart).map((e) => e.id));
  return { s, id: a.id };
}

/** A Jev that records what it was asked, then answers like `inner`. */
function spy(inner: JevRouter) {
  const asked: { features: FeatureMatchInput[]; routes: RouteInput[] } = { features: [], routes: [] };
  const jev: JevRouter = {
    route: (i) => { asked.routes.push(i); return inner.route(i); },
    matchFeatures: (i) => { asked.features.push(i); return inner.matchFeatures(i); },
    ratePost: (i) => inner.ratePost(i),
  };
  return { jev, asked };
}

const hint = (id: string, app: string) => content.agent!.hints.find((h) => h.id === id)!.replies.map((r) => r.replaceAll('{{app}}', app));

describe('Jev decides which app a prompt is about', () => {
  it.each(CONTACTS)('%s: every fix item carries the app name and address, and Jev is asked whether the app is named', async (contact) => {
    const { s, id } = withApp(contact, undefined);
    const a = getApp(s, id)!;
    a.repo[0] = { ...a.repo[0], correct: false, variant: 'x' };
    const { jev, asked } = spy(pickJev({}));
    await promptDone(s, content, jev, `On the ${a.name.toLowerCase()} app, ${a.required[0]} is wrong`);
    const items = asked.features[0].features;
    expect(items.filter((f) => f.kind === 'app').map((f) => f.id)).toEqual([`${id}::*::app`]);
    expect(items.length).toBeGreaterThan(1);
    for (const f of items.filter((x) => x.kind !== 'app')) expect(f.description).toContain(`(for ${a.name}, ${a.url})`);
  });

  it('a fix on an app the prompt doesn\'t name does nothing', async () => {
    const { s, id } = withApp('logan_contact', undefined);
    const a = getApp(s, id)!;
    a.repo[0] = { ...a.repo[0], correct: false, variant: 'x' };
    // Jev matched the feature, but not the app
    const jev: JevRouter = { ...pickJev({ route: ['fix'] }), matchFeatures: async (i) => i.features.map((f) => f.id).filter((x) => x.endsWith(`::${a.required[0]}::feature`)) };
    const after = (await promptDone(s, content, jev, `${a.required[0]} is wrong`)).state;
    expect(getApp(after, id)!.repoVersion).toBe(a.repoVersion);
    expect(after.agentWork).toBeFalsy();
  });

  it.each(CONTACTS)('%s: when Jev matches a feature, the agent builds it', async (contact) => {
    const { s, id } = withApp(contact, undefined);
    const a = getApp(s, id)!;
    const fid = a.required[0];
    a.repo = a.repo.filter((f) => f.id !== fid);
    const out = (await promptDone(s, content, pickJev({ features: [`${id}::${fid}::feature`] }), `${a.url}: build the ${fid}`)).state;
    expect(out.chat.at(-1)!.src).toBe('build');
    expect(getApp(out, id)!.repoVersion).toBe(2);
  });

  it("a named app whose change is in the repo but not live: deploy it, not \"which app?\"", async () => {
    const { s, id } = withApp('logan_contact');
    const a = getApp(s, id)!;
    a.repoVersion = 2; a.deployed = true; a.deployedVersion = 1;
    const out = (await promptDone(s, content, pickJev({ route: [`app:${id}`] }), "On the workagent app, you didn't update the about page")).state;
    expect(hint('not_deployed', a.name)).toContain(out.chat.at(-1)!.text);
  });

  it('a named app with nothing off: says it matches the brief; with work left: asks what is wrong', async () => {
    const done = withApp('logan_contact');
    const a = getApp(done.s, done.id)!;
    a.deployed = true; a.deployedVersion = 1;
    const ok = (await promptDone(done.s, content, pickJev({ route: [`app:${done.id}`] }), 'the workagent site, update the about page')).state;
    expect(hint('nothing_to_fix', a.name)).toContain(ok.chat.at(-1)!.text);
    const left = withApp('logan_contact', 'about');
    const ask = (await promptDone(left.s, content, pickJev({ route: [`app:${left.id}`] }), 'fix the workagent site')).state;
    expect(hint('fix_help', a.name)).toContain(ask.chat.at(-1)!.text);
    expect(getApp(ask, left.id)!.repoVersion).toBe(1);
  });
});

describe('when Jev is offline', () => {
  it('a prompt, a post and an email do nothing: JevOffline, state untouched', async () => {
    const { s } = withApp('logan_contact', 'about');
    const before = JSON.stringify(s);
    await expect(promptDone(s, content, noJev, 'WorkAgent: fix the about page')).rejects.toBeInstanceOf(JevOffline);
    await expect(postToY(s, noJev, 'hello', [])).rejects.toBeInstanceOf(JevOffline);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('the game says so and keeps the text to send again', async () => {
    const mem = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
    const store = new GameStore(content, { ...noJev, route: async () => { throw new JevOffline('The Jev proxy is not running (npm run proxy).'); } }, {} as Writer, mem);
    const before = store.state.clockMin;
    await store.prompt('WorkAgent: fix the about page');
    expect(store.ui.jevOffline).toMatchObject({ field: 'prompt-input', text: 'WorkAgent: fix the about page', reason: 'The Jev proxy is not running (npm run proxy).' });
    expect(store.state.clockMin).toBe(before);
    expect(store.state.chat.some((m) => m.text === 'WorkAgent: fix the about page')).toBe(false);
  });
});

describe('fixing named bugs', () => {
  it('Jev is asked about each component on its own, about the feature as a near-miss, and about the feature as a build', async () => {
    const { s, id } = withApp('logan_contact', 'landing');
    const { jev, asked } = spy(pickJev({}));
    await promptDone(s, content, jev, 'The name on the workagnet website is wrong');
    const items = asked.features[0].features.filter((f) => f.id.startsWith(`${id}::landing::`));
    expect(items.find((f) => f.id.endsWith('::feature'))!.kind).toBe('build');
    expect(items.filter((f) => f.kind === 'component').map((f) => f.id.split('::')[2])).toEqual(['c:name', 'c:pitch']);
    expect(items.find((f) => f.kind === 'component')!.description).toMatch(/^the startup.s name \(also counts as naming it: .*"title".*\), a part of the landing page .*misspelled/);
    // synonyms count for the path steps too
    expect(items.find((f) => f.id.endsWith('::s:landing'))!.description).toContain('"home page"');
    // the path is asked step by step: here just the feature, since landing's parts sit at its top
    expect(items.filter((f) => f.kind === 'step').map((f) => f.id.split('::')[2])).toEqual(['s:landing']);
    expect(items.find((f) => f.kind === 'area')!.description).toMatch(/Its parts, by path: landing page > name \(the startup.s name\); landing page > pitch \(the one-line pitch/);
    // each part lists the others, so a complaint about one isn't read as one about its neighbour
    expect(items.find((f) => f.kind === 'component')!.description).toMatch(/Other parts of the landing page, which are not this one: the one-line pitch \(the headline\)\. /);
    expect(items.some((f) => f.kind === 'problem')).toBe(false);
  });

  /** WorkAgent with the waitlist built and one bug in it. */
  function withWaitlist(variant: string, also?: string[]) {
    const { s, id } = withApp('logan_contact');
    const a = getApp(s, id)!;
    a.specParams.waitlist = { start: '10,000' };
    a.repo.push({ id: 'waitlist', correct: false, variant, ...(also ? { also } : {}), params: a.specParams.waitlist, seed: 1 });
    if (!a.required.includes('waitlist')) a.required.push('waitlist');
    return { s, id };
  }

  it('a part counts only when every step of its path is named; without them it is a near-miss', async () => {
    const { s, id } = withWaitlist('position_wrong');
    const { jev, asked } = spy(pickJev({}));
    await promptDone(s, content, jev, 'WorkAgent: the position is wrong');
    const pos = asked.features[0].features.find((f) => f.id === `${id}::waitlist::c:confirmation/position`)!;
    expect(pos.kind).toBe('component');
    expect(asked.features[0].features.filter((f) => f.kind === 'step' && f.id.startsWith(`${id}::waitlist::`)).map((f) => f.id.split('::')[2])).toEqual(['s:waitlist', 's:waitlist/form', 's:waitlist/counter', 's:waitlist/confirmation']);
    // Jev saw the part and the waitlist named, but not the confirmation: a near-miss, nothing changes
    const partial: JevRouter = { ...pickJev({ route: ['fix'] }), matchFeatures: async (i) => i.features.map((f) => f.id).filter((x) => x.endsWith('::c:confirmation/position') || x.endsWith('::s:waitlist') || x.endsWith('::*::app')) };
    const miss = (await promptDone(s, content, partial, 'WorkAgent: the waitlist position is wrong')).state;
    expect(miss.chat.at(-1)!.src).toBe('near_miss');
    // the near-miss says where the path stopped: the waitlist was named, the folder wasn't
    expect(miss.chat.at(-1)!.text).toMatch(/form or counter or confirmation/);
    expect(miss.chat.at(-1)!.text).toMatch(/\bposition\b/);
    // the part without its feature asks for the feature
    const bare: JevRouter = { ...partial, matchFeatures: async (i) => i.features.map((f) => f.id).filter((x) => x.endsWith('::c:confirmation/position') || x.endsWith('::*::app')) };
    const noFeature = (await promptDone(s, content, bare, 'WorkAgent: the position is wrong')).state;
    expect(content.agent!.hints.find((h) => h.id === 'near_feature')!.replies.map((l) => l.replaceAll('{{part}}', 'position'))).toContain(report(noFeature));
    // the feature and a folder but no part: it lists that folder's parts
    const folderOnly: JevRouter = { ...partial, matchFeatures: async (i) => i.features.map((f) => f.id).filter((x) => /::waitlist::(area|s:waitlist|s:waitlist\/confirmation)$|::\*::app$/.test(x)) };
    const noPart = (await promptDone(s, content, folderOnly, 'WorkAgent: the waitlist confirmation is wrong')).state;
    expect(noPart.chat.at(-1)!.text).toMatch(/confirmation/);
    expect(noPart.chat.at(-1)!.text).toMatch(/sending, recipient, position/);
    expect(getApp(miss, id)!.repo).toEqual(getApp(s, id)!.repo);
    // every step named: fixed
    const full: JevRouter = { ...partial, matchFeatures: async (i) => i.features.map((f) => f.id).filter((x) => /::c:confirmation\/position$|::s:waitlist(\/confirmation)?$|::\*::app$/.test(x)) };
    const hit = (await promptDone(s, content, full, 'WorkAgent: the place in line on the waitlist confirmation is wrong')).state;
    expect(getApp(hit, id)!.repo.find((f) => f.id === 'waitlist')!.correct).toBe(true);
  });

  it('a nested component fixes only its own bug', async () => {
    const { s, id } = withWaitlist('position_wrong', ['sent_to_founder']);
    const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::waitlist::c:confirmation/position'] }), 'WorkAgent: the waitlist confirmation has the wrong place in line')).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'waitlist')).toMatchObject({ correct: false, variant: 'sent_to_founder' });
  });

  it('naming only the feature is a near-miss: a scripted line from that feature, and nothing changes', async () => {
    const { s, id } = withApp('logan_contact', 'about');
    const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::about::area'] }), 'WorkAgent: the about page is wrong')).state;
    expect(content.apps.startup.features.find((f) => f.id === 'about')!.nearMiss).toContain(report(out));
    expect(out.chat.at(-1)!.src).toBe('near_miss');
    expect(getApp(out, id)!.repo).toEqual(getApp(s, id)!.repo);
  });

  it('a near-miss on a fix is a fake fix: "Good catch!", billed, takes time, then nothing found', async () => {
    const { s, id } = withApp('logan_contact', 'about');
    const r = await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::about::area'] }), 'WorkAgent: the about page is wrong');
    expect(r.charged).toBe(true);
    expect(r.state.values.crypto).toBeLessThan(s.values.crypto);
    expect(r.state.chat.at(-1)).toMatchObject({ src: 'working' });
    expect(r.state.chat.at(-1)!.text).toMatch(/^Good catch! /);
    expect(r.state.agentWork).toMatchObject({ kind: 'fix', appIds: [id], apps: [] });
    expect(r.state.agentWork!.at).toBeGreaterThan(r.state.agentWork!.from);
    deliverAgentWork(r.state, true);
    expect(r.state.chat.at(-1)).toMatchObject({ src: 'near_miss' });
    expect(r.state.chat.at(-1)!.text).toMatch(/find (the )?(no )?bug/);
    expect(getApp(r.state, id)!.repo).toEqual(getApp(s, id)!.repo);
    expect(getApp(r.state, id)!.repoVersion).toBe(getApp(s, id)!.repoVersion);
  });

  it('a real fix opens with "Good catch!"; feature work does not', async () => {
    const { s, id } = withApp('logan_contact', 'about');
    getApp(s, id)!.repo.find((f) => f.id === 'about')!.variant = 'credentials_wrong';
    const fix = await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::about::c:credentials'] }), "WorkAgent: Logan's credentials on the about page are wrong");
    expect(fix.state.chat.at(-1)).toMatchObject({ src: 'working' });
    expect(fix.reply).toMatch(/^Good catch! /);
  });

  it('Haiku writes the near-miss, told what was missing and given the scripted lines', async () => {
    const { s } = withWaitlist('position_wrong');
    const seen: WriteReq[] = [];
    const writer: Writer = { async write(req) { seen.push(req); return { text: 'Which position, the counter or the confirmation? Pick one.', llm: true, by: 'Haiku' }; } };
    const partial: JevRouter = { ...pickJev({ route: ['fix'] }), matchFeatures: async (i) => i.features.map((f) => f.id).filter((x) => x.endsWith('::c:confirmation/position') || x.endsWith('::s:waitlist') || x.endsWith('::*::app')) };
    const out = (await promptDone(s, content, partial, 'WorkAgent: the waitlist position is wrong', writer)).state;
    expect(seen[0]).toMatchObject({ as: 'agent', mode: 'near' });
    expect(seen[0].near!.why).toMatch(/position.*waitlist.*form or counter or confirmation/i);
    expect(seen[0].near!.lines.some((l) => /form or counter or confirmation/.test(l))).toBe(true);
    expect(out.chat.at(-1)).toMatchObject({ src: 'near_miss', by: 'Haiku' });
    expect(report(out)).toBe('Which position, the counter or the confirmation? Pick one.');
  });

  it('a near-miss gives way to anything more precise in the same prompt', async () => {
    const { s, id } = withApp('logan_contact', 'landing');
    getApp(s, id)!.repo.find((f) => f.id === 'landing')!.variant = 'name_wrong';
    const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::landing::area', '::landing::c:name'] }), 'WorkAgent: the landing page is off, the name is misspelled')).state;
    expect(out.chat.at(-1)!.src).toBe('build');
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')!.correct).toBe(true);
  });

  it('naming the part with invented details says the details are missing, not that it was right', async () => {
    const { s, id } = withApp('logan_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'about' ? { ...f, correct: false, variant: 'hallucinated', seed: 1 } : f));
    const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::about::c:credentials'] }), 'WorkAgent: the credentials on the about page are wrong')).state;
    expect(out.chat.at(-1)!.text).toMatch(/made up\. Send them/);
    expect(out.chat.at(-1)!.text).not.toMatch(/already right|Tidied/);
  });

  it('a built feature with a named bug has no "build it" option: "only 6 machines" fixes the count', async () => {
    const { s, id } = withApp('laundromat_contact', 'machines');
    getApp(s, id)!.repo.find((f) => f.id === 'machines')!.variant = 'six_of_eight';
    const { jev, asked } = spy(pickJev({ route: ['both'], features: ['::machines::feature', '::machines::c:count'] }));
    const out = (await promptDone(s, content, jev, 'The spin cycle app only has 6 machines, there should be 8')).state;
    expect(asked.features[0].features.map((f) => f.id)).not.toContain(`${id}::machines::feature`);
    expect(getApp(out, id)!.repo.find((f) => f.id === 'machines')!.correct).toBe(true);
    expect(out.chat.at(-1)!.text).not.toMatch(/Tidied|only did the feature work/);
  });

  it('a match that changes nothing is no push: it falls through to the app\'s hint', async () => {
    const { s, id } = withApp('laundromat_contact', 'machines');
    const a = getApp(s, id)!;
    a.repo.find((f) => f.id === 'machines')!.variant = 'done_as_free';
    a.deployed = true;
    a.breaks.push({ featureId: 'machines', failure: 'subtle', day: 3 });
    const out = await promptDone(s, content, pickJev({ route: ['fix', `app:${id}`], features: ['::machines::subtle'] }), 'Spin Cycle Board machines are off');
    expect(out.state.chat.at(-1)!.src).not.toBe('build');
    expect(out.state.chat.at(-1)!.text).not.toMatch(/Tidied/);
    expect(getApp(out.state, id)!.repoVersion).toBe(a.repoVersion);
  });

  it('a named bug that was not there is reported as already right', async () => {
    const { s, id } = withApp('logan_contact');
    getApp(s, id)!.repo[0] = { id: 'landing', correct: false, variant: 'pitch_wrong', params: getApp(s, id)!.specParams.landing, seed: 1 };
    const out = (await promptDone(s, content, pickJev({ features: ['::landing::c:name'] }), 'WorkAgent: the name is misspelled')).state;
    expect(out.chat.at(-1)!.text).toMatch(/already right/);
    expect(getApp(out, id)!.repo[0]).toMatchObject({ correct: false, variant: 'pitch_wrong' });
  });

  it('a first build only says what was built, even when Jev saw a bug named', async () => {
    const { s, id } = withApp('logan_contact');
    const a = getApp(s, id)!;
    a.repo = [];
    a.repoVersion = 0;
    const prompt = 'Create this website for workagent: a landing page with our name and the pitch "The future of work is agentic.", and an about us page.';
    const out = (await promptDone(s, content, pickJev({ features: ['::landing::feature', '::landing::c:pitch', '::about::feature'] }), prompt)).state;
    const reply = out.chat.at(-1)!.text;
    expect(reply).toMatch(/Built the landing page\.\n- Built the about us page\./);
    expect(reply).not.toMatch(/Checked for this|already right|Fixed/);
  });
});

describe('one kind of work per prompt', () => {
  /** WorkAgent with the name misspelled and the about page needing a rebuild: Jev matches both kinds. */
  function mixed() {
    const { s, id } = withApp('logan_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'landing' ? { ...f, correct: false, variant: 'name_wrong', seed: 1 } : f.id === 'about' ? { ...f, correct: false, variant: 'hallucinated', seed: 1 } : f));
    return { s, id, jev: (intent: string) => pickJev({ route: [intent], features: ['::landing::c:name', '::about::feature'] }) };
  }
  const prompt = 'WorkAgent: the name is misspelled. Also the founder page should list Why Combinator Startup School and 2x founder.';

  it('Jev is asked whether the prompt is feature work, a fix, or both', async () => {
    const { s, jev } = mixed();
    const { jev: spied, asked } = spy(jev('feature'));
    await promptDone(s, content, spied, prompt);
    // the first question is whether it's a hack attempt (agent-terminal)
    expect(asked.routes[0].candidates.map((c) => c.id)).toEqual(['hack']);
    expect(asked.routes[1].candidates.map((c) => c.id)).toEqual(['feature', 'fix', 'both']);
  });

  it('feature work leaves the bugs alone and says nothing about them', async () => {
    const { s, id, jev } = mixed();
    const out = (await promptDone(s, content, jev('feature'), prompt)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(out.chat.at(-1)!.text).not.toMatch(/Fixed the name|already right|feature work/);
  });

  it('a fix leaves the features alone', async () => {
    const { s, id, jev } = mixed();
    const out = (await promptDone(s, content, jev('fix'), prompt)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')!.correct).toBe(true);
    expect(getApp(out, id)!.repo.find((f) => f.id === 'about')).toMatchObject({ correct: false, variant: 'hallucinated' });
    expect(out.chat.at(-1)!.text).not.toMatch(/about|credentials/i);
  });

  it('both: only the features, and the agent says it ran out of context for the fixes', async () => {
    const { s, id, jev } = mixed();
    // the about page isn't built yet, so there is feature work to do
    getApp(s, id)!.repo = getApp(s, id)!.repo.filter((f) => f.id !== 'about');
    const out = (await promptDone(s, content, jev('both'), prompt)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(out.chat.at(-1)!.text).toMatch(/only did the feature work.*not enough context|wasn't enough context/);
  });
});

describe("the client's change requests", () => {
  /** Vibe Check, built right, then deskjockey's day 8 email: two more tickers. */
  function updated() {
    const { s, id } = withApp('trader_contact');
    applyEffects(s, content.events.find((e) => e.id === 'd8_trader_tickers')!.onDeliver!);
    return { s, id };
  }
  const trader = 'Please add this to vibe check: track $APO and $DISH too, next to $GAI and $VANT.';

  it('an out-of-date feature gives Jev its own item for the change, as feature work', async () => {
    const { s, id } = updated();
    const { jev, asked } = spy(pickJev({ route: ['feature'] }));
    await promptDone(s, content, jev, trader);
    const item = asked.features[0].features.find((f) => f.id === `${id}::tickers::outdated`)!;
    expect(item.kind).toBe('build');
    expect(item.description).toMatch(/\$APO/);
  });

  it("the change item says the prompt has to spell out what changes", async () => {
    const { s, id } = updated();
    const { jev, asked } = spy(pickJev({ route: ['feature'] }));
    await promptDone(s, content, jev, trader);
    expect(asked.features[0].features.find((f) => f.id === `${id}::tickers::outdated`)!.description).toMatch(/what exactly changes.*doesn't count/);
  });

  it("a feature that already had a bug still takes the client's change, and the bug stays", async () => {
    const { s, id } = withApp('trader_contact');
    const tickers = getApp(s, id)!.repo.find((f) => f.id === 'tickers')!;
    Object.assign(tickers, { correct: false, variant: 'lowercase_missed', seed: 1 });
    applyEffects(s, content.events.find((e) => e.id === 'd8_trader_tickers')!.onDeliver!);
    expect(getApp(s, id)!.repo.find((f) => f.id === 'tickers')).toMatchObject({ variant: 'lowercase_missed', also: ['outdated'] });
    const out = (await promptDone(s, content, pickJev({ route: ['feature'], features: ['::tickers::outdated'] }), 'Vibe check: track $GAI $VANT $APO $DISH')).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'tickers')).toMatchObject({ correct: false, variant: 'lowercase_missed' });
    expect(getApp(out, id)!.repo.find((f) => f.id === 'tickers')!.also).toBeUndefined();
  });

  it("asking to update without saying what changed gets asked what changed", async () => {
    const { s, id } = updated();
    const out = (await promptDone(s, content, pickJev({ route: [`app:${id}`] }), 'Update the vibe check tickers')).state;
    expect(content.agent!.hints.find((h) => h.id === 'update_help')!.replies).toContain(out.chat.at(-1)!.text);
  });

  it('asking for the change updates the feature', async () => {
    const { s, id } = updated();
    const out = (await promptDone(s, content, pickJev({ route: ['feature'], features: ['::tickers::outdated'] }), trader)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'tickers')!.correct).toBe(true);
    expect(out.chat.at(-1)!.text).toMatch(/Pushed to Forkyard/);
  });

  it('"did you update the tickers?" gets the status from the repo', async () => {
    const { s, id } = updated();
    const { jev, asked } = spy(pickJev({ route: [`status:${id}`] }));
    // nothing to build matches, so the question goes to the agent's routing
    const out = (await promptDone(s, content, jev, 'Did you also update the tickers?')).state;
    expect(asked.routes.at(-1)!.candidates[0].id).toBe(`status:${id}`);
    expect(out.chat.at(-1)!.text).toMatch(/^Vibe Check: .*isn't updated to the latest changes yet\..*None of it is live yet\. Deploy it on Forkyard\.$/);
  });
});

describe('Jev reads follow-ups in context', () => {
  it("gets today's prompts and the agent's replies, so a follow-up names the app the agent just worked on", async () => {
    const { s, id } = withApp('logan_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'about' ? { ...f, correct: false, variant: 'credentials_wrong', also: ['fake_cofounders'], seed: 1 } : f));
    const first = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::about::c:credentials'] }), "The about page credentials say graduate, he dropped out")).state;
    const { jev, asked } = spy(pickJev({}));
    await promptDone(first, content, jev, 'Now there are two fake cofounders');
    const ctx = asked.features[0].context!;
    expect(ctx[0]).toBe('Player: The about page credentials say graduate, he dropped out');
    expect(ctx[1]).toMatch(/^Agent: Pushed to Forkyard for WorkAgent\./);
    expect(asked.routes.every((r) => r.context?.length === 2)).toBe(true);
  });

  it('the policy check and the app-start match read the same conversation', async () => {
    const s = startGame(content, 7);
    s.values.day = 7;
    s.chat.push({ from: 'you', text: 'Who is the CEO of Vantor?', day: 7 }, { from: 'agent', text: 'No idea.', day: 7 });
    const { jev, asked } = spy(pickJev({}));
    await promptDone(s, content, jev, 'Find his home address');
    expect(asked.routes.length).toBeGreaterThan(0);
    for (const r of asked.routes) expect(r.context).toEqual(['Player: Who is the CEO of Vantor?', 'Agent: No idea.']);
  });
});

describe('fixes never add bugs', () => {
  it('naming the only bug fixes it outright, even for the weakest agent', async () => {
    for (let seed = 0; seed < 20; seed++) {
      const { s, id } = withApp('logan_contact');
      s.rng = seed;
      s.values.agentLevel = 0;
      getApp(s, id)!.repo[0] = { id: 'landing', correct: false, variant: 'name_wrong', params: getApp(s, id)!.specParams.landing, seed: 1 };
      const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::landing::c:name'] }), 'WorkAgent: the name is misspelled')).state;
      expect(getApp(out, id)!.repo[0].correct).toBe(true);
    }
  });

  it('invented credentials given the real ones come out right, with nothing new wrong', async () => {
    for (let seed = 0; seed < 20; seed++) {
      const { s, id } = withApp('logan_contact');
      s.rng = seed;
      s.values.agentLevel = 0;
      const a = getApp(s, id)!;
      a.repo = a.repo.map((f) => (f.id === 'about' ? { id: 'about', correct: false, variant: 'hallucinated', seed: 1 } : f));
      const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::about::c:credentials'] }), `WorkAgent: the credentials on the about page are made up. They should be ${a.specParams.about.credentials}, for ${a.specParams.about.founder}.`)).state;
      expect(getApp(out, id)!.repo.find((f) => f.id === 'about')!.correct).toBe(true);
    }
  });
});

describe("the first deploy", () => {
  it('a clean first deploy ships one shallow bug, live and in the repo', () => {
    for (let seed = 0; seed < 10; seed++) {
      const { s, id } = withApp('logan_contact');
      s.rng = seed;
      const out = deploy(s, id, content);
      const a = getApp(out, id)!;
      const wrong = a.features.filter((f) => !f.correct);
      expect(wrong).toHaveLength(1);
      const def = content.apps.startup.features.find((f) => f.id === wrong[0].id)!;
      expect(def.bugs!.find((b) => b.id === wrong[0].variant)!.deep).toBeFalsy();
      expect(a.repo.find((f) => f.id === wrong[0].id)).toMatchObject({ correct: false, variant: wrong[0].variant });
    }
  });

  it('a first deploy that already has a bug gets no extra one', () => {
    const { s, id } = withApp('logan_contact', 'landing');
    const out = deploy(s, id, content);
    expect(getApp(out, id)!.features.filter((f) => !f.correct).map((f) => f.id)).toEqual(['landing']);
  });

  it('later deploys are left alone', () => {
    const { s, id } = withApp('logan_contact');
    const once = deploy(s, id, content);
    const a = getApp(once, id)!;
    a.repo = a.repo.map((f) => ({ id: f.id, correct: true, params: a.specParams[f.id] }));
    a.repoVersion++;
    const twice = deploy(once, id, content);
    expect(getApp(twice, id)!.features.every((f) => f.correct)).toBe(true);
  });
});

describe('live breaks', () => {
  it('a crash is described by the error the site shows, so "an application error on the app" can name it', async () => {
    let { s, id } = withApp('logan_contact');
    s = deploy(s, id);
    getApp(s, id)!.breaks.push({ featureId: 'about', failure: 'visible', day: s.values.day, scripted: false, seed: 1 });
    const { jev, asked } = spy(pickJev({ route: ['fix'], features: ['::about::visible'] }));
    const out = (await promptDone(s, content, jev, "There's an application error on the workagent app")).state;
    const item = asked.features[0].features.find((f) => f.id === `${id}::about::visible`)!;
    expect(item.description).toMatch(/"Application error".*without naming the page/);
    expect(out.chat.at(-1)!.text).toMatch(/Pushed to Forkyard/);
  });
});

describe('loose descriptions', () => {
  it('a symptom that points at two components fixes the one that is there and says nothing about the other', async () => {
    const { s, id } = withApp('trader_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'sentiment' ? { ...f, correct: false, variant: 'inverted', seed: 1 } : f));
    const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::sentiment::c:labels', '::sentiment::c:sarcasm'] }), 'On the vibe check app, bullish and bearish look wrong')).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'sentiment')!.correct).toBe(true);
    const reply = out.chat.at(-1)!.text;
    expect(reply).toMatch(/bullish|Bullish/);
    expect(reply).not.toMatch(/already right/);
  });
});

describe('dev bug switch', () => {
  it('switches repo and live together, even when they differ', async () => {
    let { s, id } = withApp('logan_contact');
    s = deploy(s, id);
    const a = getApp(s, id)!;
    // the repo already has the fix, the live site still has the bug
    a.features.find((f) => f.id === 'landing')!.correct = false;
    a.features.find((f) => f.id === 'landing')!.variant = 'name_wrong';
    devToggleBug(s, id, 'landing', 'name_wrong');
    for (const list of [a.repo, a.features]) expect(list.find((f) => f.id === 'landing')!.correct).toBe(true);
    devToggleBug(s, id, 'landing', 'name_wrong');
    for (const list of [a.repo, a.features]) expect(list.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
  });
});

describe('one app per prompt', () => {
  /** Logan's site and the crawler, both with a bug the prompt could be read as naming. */
  function twoApps() {
    const { s, id: wa } = withApp('logan_contact');
    applyEffects(s, content.events.find((e) => e.id === 'trader_contact')!.outcomes!.find((o) => o.effects?.createApp)!.effects!);
    const crawler = s.apps.at(-1)!;
    crawler.repo = crawler.required.map((f) => ({ id: f, correct: f !== 'filter', ...(f === 'filter' ? { variant: 'bots_counted' } : {}), params: crawler.specParams[f] }));
    crawler.repoVersion = 1;
    getApp(s, wa)!.repo[0] = { id: 'landing', correct: false, variant: 'name_wrong', params: getApp(s, wa)!.specParams.landing };
    return { s, wa, crawler: crawler.id };
  }

  it('when Jev matches on two apps, only the one it says the prompt means is touched', async () => {
    const { s, wa, crawler } = twoApps();
    const out = (await promptDone(s, content, pickJev({ route: ['fix', crawler], features: ['::filter::c:bots', '::landing::c:name'] }), "The crawler doesn't filter for bots")).state;
    expect(getApp(out, crawler)!.repo.find((f) => f.id === 'filter')!.correct).toBe(true);
    expect(getApp(out, wa)!.repo[0]).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(out.chat.at(-1)!.text).not.toMatch(/WorkAgent/);
  });

  it('when Jev cannot tell which app, it asks and changes nothing', async () => {
    const { s, wa, crawler } = twoApps();
    const out = (await promptDone(s, content, pickJev({ route: ['fix'], features: ['::filter::c:bots', '::landing::c:name'] }), 'fix the bots and the name')).state;
    expect(content.agent!.hints.find((h) => h.id === 'which_app')!.replies).toContain(out.chat.at(-1)!.text);
    expect(getApp(out, crawler)!.repo).toEqual(getApp(s, crawler)!.repo);
    expect(getApp(out, wa)!.repo).toEqual(getApp(s, wa)!.repo);
  });
});
