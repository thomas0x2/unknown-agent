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
import { getApp } from '../engine/apps';
import { promptAgent, postToY } from '../engine/actions';
import { noJev, JevOffline, type JevRouter, type FeatureMatchInput, type RouteInput } from '../engine/jev';
import { pickJev } from '../engine/_fixtures';
import { GameStore } from '../game/store';
import type { GameState, SaveStore, Writer } from '../engine';

const content = loadContent();
const CONTACTS = ['restaurant_contact', 'trader_contact', 'laundromat_contact', 'viktor_contact', 'outreach_contact'];

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
  it.each(CONTACTS)('%s: every fix item carries the app name and address, and Jev is told the app must be named', async (contact) => {
    const { s, id } = withApp(contact, undefined);
    const a = getApp(s, id)!;
    a.repo[0] = { ...a.repo[0], correct: false, variant: 'x' };
    const { jev, asked } = spy(pickJev({}));
    await promptAgent(s, content, jev, `On the ${a.name.toLowerCase()} app, ${a.required[0]} is wrong`);
    expect(asked.features[0].appNamed).toBe(true);
    expect(asked.features[0].features.length).toBeGreaterThan(0);
    for (const f of asked.features[0].features) expect(f.description).toContain(`(for ${a.name}, ${a.url})`);
  });

  it.each(CONTACTS)('%s: when Jev matches a feature, the agent builds it', async (contact) => {
    const { s, id } = withApp(contact, undefined);
    const a = getApp(s, id)!;
    const fid = a.required[0];
    a.repo[0] = { ...a.repo[0], correct: false, variant: 'x' };
    const out = (await promptAgent(s, content, pickJev({ features: [`${id}::${fid}::feature`] }), `${a.url}: fix the ${fid}`)).state;
    expect(out.chat.at(-1)!.src).toBe('build');
    expect(getApp(out, id)!.repoVersion).toBe(2);
  });

  it("a named app whose change is in the repo but not live: deploy it, not \"which app?\"", async () => {
    const { s, id } = withApp('restaurant_contact');
    const a = getApp(s, id)!;
    a.repoVersion = 2; a.deployed = true; a.deployedVersion = 1;
    const out = (await promptAgent(s, content, pickJev({ route: [`app:${id}`] }), "On the trattoria gino app, you didn't update the menu")).state;
    expect(hint('not_deployed', a.name)).toContain(out.chat.at(-1)!.text);
  });

  it('a named app with nothing off: says it matches the brief; with work left: asks what is wrong', async () => {
    const done = withApp('restaurant_contact');
    const a = getApp(done.s, done.id)!;
    a.deployed = true; a.deployedVersion = 1;
    const ok = (await promptAgent(done.s, content, pickJev({ route: [`app:${done.id}`] }), 'the gino site, update the menu')).state;
    expect(hint('nothing_to_fix', a.name)).toContain(ok.chat.at(-1)!.text);
    const left = withApp('restaurant_contact', 'menu');
    const ask = (await promptAgent(left.s, content, pickJev({ route: [`app:${left.id}`] }), 'fix the gino site')).state;
    expect(hint('fix_help', a.name)).toContain(ask.chat.at(-1)!.text);
    expect(getApp(ask, left.id)!.repoVersion).toBe(1);
  });
});

describe('when Jev is offline', () => {
  it('a prompt, a post and an email do nothing: JevOffline, state untouched', async () => {
    const { s } = withApp('restaurant_contact', 'menu');
    const before = JSON.stringify(s);
    await expect(promptAgent(s, content, noJev, 'Trattoria Gino: fix the menu')).rejects.toBeInstanceOf(JevOffline);
    await expect(postToY(s, noJev, 'hello', [])).rejects.toBeInstanceOf(JevOffline);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('the game says so and keeps the text to send again', async () => {
    const mem = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
    const store = new GameStore(content, { ...noJev, route: async () => { throw new JevOffline('The Jev proxy is not running (npm run proxy).'); } }, {} as Writer, mem);
    const before = store.state.clockMin;
    await store.prompt('Trattoria Gino: fix the menu');
    expect(store.ui.jevOffline).toMatchObject({ field: 'prompt-input', text: 'Trattoria Gino: fix the menu', reason: 'The Jev proxy is not running (npm run proxy).' });
    expect(store.state.clockMin).toBe(before);
    expect(store.state.chat.some((m) => m.text === 'Trattoria Gino: fix the menu')).toBe(false);
  });
});
