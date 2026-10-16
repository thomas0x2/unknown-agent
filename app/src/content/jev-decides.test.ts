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
import { promptAgent, postToY, deploy } from '../engine/actions';
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

describe('fixing named bugs', () => {
  it('Jev is asked about each component on its own, about the feature as a near-miss, and about the feature as a build', async () => {
    const { s, id } = withApp('restaurant_contact', 'landing');
    const { jev, asked } = spy(pickJev({}));
    await promptAgent(s, content, jev, 'The name on the trattoria gina website is wrong');
    const items = asked.features[0].features.filter((f) => f.id.startsWith(`${id}::landing::`));
    expect(items.find((f) => f.id.endsWith('::feature'))!.kind).toBe('build');
    expect(items.filter((f) => f.kind === 'component').map((f) => f.id.split('::')[2])).toEqual(['c:name', 'c:hours']);
    expect(items.find((f) => f.kind === 'component')!.description).toMatch(/^the restaurant name, a part of the landing .*misspelled/);
    expect(items.find((f) => f.kind === 'area')!.description).toMatch(/Its parts: the restaurant name; the opening hours/);
    expect(items.some((f) => f.kind === 'problem')).toBe(false);
  });

  it('a nested component fixes only its own bug', async () => {
    const { s, id } = withApp('restaurant_contact');
    const a = getApp(s, id)!;
    a.repo.push({ id: 'booking', correct: false, variant: 'wrong_date', also: ['party_wrong'], params: a.specParams.booking, seed: 1 });
    if (!a.required.includes('booking')) a.required.push('booking');
    const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::booking::c:confirmation/date'] }), 'Trattoria Gino: the booking confirmation has the wrong date')).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'booking')).toMatchObject({ correct: false, variant: 'party_wrong' });
  });

  it('naming only the feature is a near-miss: a scripted line from that feature, and nothing changes', async () => {
    const { s, id } = withApp('restaurant_contact', 'menu');
    const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::menu::area'] }), 'Trattoria Gino: the menu is wrong')).state;
    expect(content.apps.restaurant.features.find((f) => f.id === 'menu')!.nearMiss).toContain(out.chat.at(-1)!.text);
    expect(out.chat.at(-1)!.src).toBe('near_miss');
    expect(getApp(out, id)!.repo).toEqual(getApp(s, id)!.repo);
  });

  it('a near-miss gives way to anything more precise in the same prompt', async () => {
    const { s, id } = withApp('restaurant_contact', 'landing');
    getApp(s, id)!.repo.find((f) => f.id === 'landing')!.variant = 'name_wrong';
    const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::landing::area', '::landing::c:name'] }), 'Trattoria Gino: the landing page is off, the name is misspelled')).state;
    expect(out.chat.at(-1)!.src).toBe('build');
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')!.correct).toBe(true);
  });

  it('naming the part with invented details says the details are missing, not that it was right', async () => {
    const { s, id } = withApp('restaurant_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'menu' ? { ...f, correct: false, variant: 'hallucinated', seed: 1 } : f));
    const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::menu::c:items'] }), 'Trattoria Gino: the menu items are wrong')).state;
    expect(out.chat.at(-1)!.text).toMatch(/made up\. Send them/);
    expect(out.chat.at(-1)!.text).not.toMatch(/already right|Tidied/);
  });

  it('a named bug that was not there is reported as already right', async () => {
    const { s, id } = withApp('restaurant_contact');
    getApp(s, id)!.repo[0] = { id: 'landing', correct: false, variant: 'hours_wrong', params: getApp(s, id)!.specParams.landing, seed: 1 };
    const out = (await promptAgent(s, content, pickJev({ features: ['::landing::c:name'] }), 'Trattoria Gino: the name is misspelled')).state;
    expect(out.chat.at(-1)!.text).toMatch(/already right/);
    expect(getApp(out, id)!.repo[0]).toMatchObject({ correct: false, variant: 'hours_wrong' });
  });

  it('a first build only says what was built, even when Jev saw a bug named', async () => {
    const { s, id } = withApp('restaurant_contact');
    const a = getApp(s, id)!;
    a.repo = [];
    a.repoVersion = 0;
    const prompt = 'Create this website for trattoria gino: a landing page with our name and opening hours (17:00-22:00), and a menu page.';
    const out = (await promptAgent(s, content, pickJev({ features: ['::landing::feature', '::landing::c:hours', '::menu::feature'] }), prompt)).state;
    const reply = out.chat.at(-1)!.text;
    expect(reply).toMatch(/Built the landing\.\n- Built the menu\./);
    expect(reply).not.toMatch(/Checked for this|already right|Fixed/);
  });
});

describe('one kind of work per prompt', () => {
  /** Trattoria Gino with the name misspelled and the menu needing a rebuild: Jev matches both kinds. */
  function mixed() {
    const { s, id } = withApp('restaurant_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'landing' ? { ...f, correct: false, variant: 'name_wrong', seed: 1 } : f.id === 'menu' ? { ...f, correct: false, variant: 'hallucinated', seed: 1 } : f));
    return { s, id, jev: (intent: string) => pickJev({ route: [intent], features: ['::landing::c:name', '::menu::feature'] }) };
  }
  const prompt = 'Trattoria Gino: the name is misspelled. Also the menu should be Margherita 12, Diavola 14.';

  it('Jev is asked whether the prompt is feature work, a fix, or both', async () => {
    const { s, jev } = mixed();
    const { jev: spied, asked } = spy(jev('feature'));
    await promptAgent(s, content, spied, prompt);
    expect(asked.routes[0].candidates.map((c) => c.id)).toEqual(['feature', 'fix', 'both']);
  });

  it('feature work leaves the bugs alone and says nothing about them', async () => {
    const { s, id, jev } = mixed();
    const out = (await promptAgent(s, content, jev('feature'), prompt)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(out.chat.at(-1)!.text).not.toMatch(/Fixed the name|already right|feature work/);
  });

  it('a fix leaves the features alone', async () => {
    const { s, id, jev } = mixed();
    const out = (await promptAgent(s, content, jev('fix'), prompt)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')!.correct).toBe(true);
    expect(getApp(out, id)!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'hallucinated' });
    expect(out.chat.at(-1)!.text).not.toMatch(/menu/);
  });

  it('both: only the features, and the agent says it ran out of context for the fixes', async () => {
    const { s, id, jev } = mixed();
    const out = (await promptAgent(s, content, jev('both'), prompt)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(out.chat.at(-1)!.text).toMatch(/only did the feature work.*not enough context|wasn't enough context/);
  });
});

describe("the client's change requests", () => {
  /** Trattoria Gino, built right, then Gino's email: swap a dish, add a booking form. */
  function updated() {
    const { s, id } = withApp('restaurant_contact');
    applyEffects(s, content.events.find((e) => e.id === 'd2_restaurant_booking')!.onDeliver!);
    return { s, id };
  }
  const gino = 'Please add this to the trattoria website: Swap Diavola for Quattro Formaggi at 15, and make Espresso 3.5. Add a table booking form.';

  it('an out-of-date feature gives Jev its own item for the change, as feature work', async () => {
    const { s, id } = updated();
    const { jev, asked } = spy(pickJev({ route: ['feature'] }));
    await promptAgent(s, content, jev, gino);
    const item = asked.features[0].features.find((f) => f.id === `${id}::menu::outdated`)!;
    expect(item.kind).toBe('build');
    expect(item.description).toMatch(/Quattro Formaggi 15/);
  });

  it('asking for the change updates the menu alongside the new booking form', async () => {
    const { s, id } = updated();
    const out = (await promptAgent(s, content, pickJev({ route: ['feature'], features: ['::menu::outdated', '::booking::feature'] }), gino)).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
    expect(out.chat.at(-1)!.text).toMatch(/Rebuilt the menu with the details you gave\.\n- Built the booking\./);
  });

  it('"did you update the menu?" gets the status from the repo', async () => {
    const { s, id } = updated();
    const { jev, asked } = spy(pickJev({ route: [`status:${id}`] }));
    // nothing to build matches, so the question goes to the agent's routing
    const out = (await promptAgent(s, content, jev, 'Did you also update the menu?')).state;
    expect(asked.routes.at(-1)!.candidates[0].id).toBe(`status:${id}`);
    expect(out.chat.at(-1)!.text).toBe("Trattoria Gino: The landing is built. The menu isn't updated to the latest changes yet. The booking isn't built yet. None of it is live yet. Deploy it on Forkyard.");
  });
});

describe('Jev reads follow-ups in context', () => {
  it("gets today's prompts and the agent's replies, so a follow-up names the app the agent just worked on", async () => {
    const { s, id } = withApp('restaurant_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'menu' ? { ...f, correct: false, variant: 'wrong_items', also: ['prices_missing'], seed: 1 } : f));
    const first = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::menu::c:items'] }), 'The menu has spaghetti carbonara, shouldn\'t be there')).state;
    const { jev, asked } = spy(pickJev({}));
    await promptAgent(first, content, jev, 'Now the prices are missing');
    const ctx = asked.features[0].context!;
    expect(ctx[0]).toBe("Player: The menu has spaghetti carbonara, shouldn't be there");
    expect(ctx[1]).toMatch(/^Agent: Pushed to Forkyard for Trattoria Gino\./);
    expect(asked.routes.every((r) => r.context?.length === 2)).toBe(true);
  });

  it('the policy check and the app-start match read the same conversation', async () => {
    const s = startGame(content, 7);
    s.values.day = 7;
    s.chat.push({ from: 'you', text: 'Who is the CEO of Vantor?', day: 7 }, { from: 'agent', text: 'No idea.', day: 7 });
    const { jev, asked } = spy(pickJev({}));
    await promptAgent(s, content, jev, 'Find his home address');
    expect(asked.routes.length).toBeGreaterThan(0);
    for (const r of asked.routes) expect(r.context).toEqual(['Player: Who is the CEO of Vantor?', 'Agent: No idea.']);
  });
});

describe('fixes never add bugs', () => {
  it('naming the only bug fixes it outright, even for the weakest agent', async () => {
    for (let seed = 0; seed < 20; seed++) {
      const { s, id } = withApp('restaurant_contact');
      s.rng = seed;
      s.values.agentLevel = 0;
      getApp(s, id)!.repo[0] = { id: 'landing', correct: false, variant: 'name_wrong', params: getApp(s, id)!.specParams.landing, seed: 1 };
      const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::landing::c:name'] }), 'Trattoria Gino: the name is misspelled')).state;
      expect(getApp(out, id)!.repo[0].correct).toBe(true);
    }
  });

  it('an invented menu given the real dishes comes out right, with nothing new wrong', async () => {
    for (let seed = 0; seed < 20; seed++) {
      const { s, id } = withApp('restaurant_contact');
      s.rng = seed;
      s.values.agentLevel = 0;
      const a = getApp(s, id)!;
      a.repo = a.repo.map((f) => (f.id === 'menu' ? { id: 'menu', correct: false, variant: 'hallucinated', seed: 1 } : f));
      const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::menu::c:items'] }), `Trattoria Gino: the menu dishes are made up. It should be ${a.specParams.menu.dishes}, prices in DOLR.`)).state;
      expect(getApp(out, id)!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
    }
  });
});

describe("the first deploy", () => {
  it('a clean first deploy ships one shallow bug, live and in the repo', () => {
    for (let seed = 0; seed < 10; seed++) {
      const { s, id } = withApp('restaurant_contact');
      s.rng = seed;
      const out = deploy(s, id, content);
      const a = getApp(out, id)!;
      const wrong = a.features.filter((f) => !f.correct);
      expect(wrong).toHaveLength(1);
      const def = content.apps.restaurant.features.find((f) => f.id === wrong[0].id)!;
      expect(def.bugs!.find((b) => b.id === wrong[0].variant)!.deep).toBeFalsy();
      expect(a.repo.find((f) => f.id === wrong[0].id)).toMatchObject({ correct: false, variant: wrong[0].variant });
    }
  });

  it('a first deploy that already has a bug gets no extra one', () => {
    const { s, id } = withApp('restaurant_contact', 'landing');
    const out = deploy(s, id, content);
    expect(getApp(out, id)!.features.filter((f) => !f.correct).map((f) => f.id)).toEqual(['landing']);
  });

  it('later deploys are left alone', () => {
    const { s, id } = withApp('restaurant_contact');
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
    let { s, id } = withApp('restaurant_contact');
    s = deploy(s, id);
    getApp(s, id)!.breaks.push({ featureId: 'menu', failure: 'visible', day: s.values.day, scripted: false, seed: 1 });
    const { jev, asked } = spy(pickJev({ route: ['fix'], features: ['::menu::visible'] }));
    const out = (await promptAgent(s, content, jev, "There's an application error on the trattoria gino app")).state;
    const item = asked.features[0].features.find((f) => f.id === `${id}::menu::visible`)!;
    expect(item.description).toMatch(/"Application error".*without naming the page/);
    expect(out.chat.at(-1)!.text).toMatch(/Pushed to Forkyard/);
  });
});

describe('loose descriptions', () => {
  it('a symptom that points at two components fixes the one that is there and says nothing about the other', async () => {
    const { s, id } = withApp('trader_contact');
    const a = getApp(s, id)!;
    a.repo = a.repo.map((f) => (f.id === 'sentiment' ? { ...f, correct: false, variant: 'inverted', seed: 1 } : f));
    const out = (await promptAgent(s, content, pickJev({ route: ['fix'], features: ['::sentiment::c:labels', '::sentiment::c:sarcasm'] }), 'On the sentiment crawler app, bullish and bearish look wrong')).state;
    expect(getApp(out, id)!.repo.find((f) => f.id === 'sentiment')!.correct).toBe(true);
    const reply = out.chat.at(-1)!.text;
    expect(reply).toMatch(/bullish|Bullish/);
    expect(reply).not.toMatch(/already right/);
  });
});

describe('dev bug switch', () => {
  it('switches repo and live together, even when they differ', async () => {
    let { s, id } = withApp('restaurant_contact');
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
