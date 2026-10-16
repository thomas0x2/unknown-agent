/*
 * Plays day 1 of the real authored content through the engine with the offline Jev router: take the
 * restaurant lead, build and deploy the site, check it, fix the teaching bug, end the day, get paid.
 */
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { composeEmail, briefBuild, briefFix, deploy, promptAgent } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { appMeetsSpec, getApp, devToggleBug } from '../engine/apps';

/** Fix requests have to name the app. */
const gino = 'Trattoria Gino: ';
import { renderAppSite } from '../ui/appsite';
import { wordJev, pickJev } from '../engine/_fixtures';

const content = loadContent();
const MENU = 'Margherita 12, Diavola 14, Lasagne 15, Tiramisu 7, Espresso 3';
const FIX: Record<string, string> = {
  prices_missing: 'The prices are missing from the menu.',
  prices_curo: 'The menu prices are in CURO, they should be DOLR.',
  hours_wrong: 'The opening hours on the landing page are wrong.',
  name_wrong: 'The restaurant name is misspelled.',
};

describe('day 1 playthrough', () => {
  it('opens with the termination email and the restaurant lead on Y', () => {
    const s = startGame(content, 7);
    const inbox = s.delivered.filter((d) => d.site === 'qmail').map((d) => d.eventId);
    expect(inbox).toContain('d1_hr_termination');
    expect(inbox).toContain('d1_mom');
    expect(s.delivered.some((d) => d.eventId === 'd1_y_restaurant')).toBe(true);
    // the latent lead is NOT in the inbox yet
    expect(inbox).not.toContain('restaurant_contact');
  });

  it('take the gig, build, deploy, fix the bug, and get paid at day end', async () => {
    let s = startGame(content, 7);

    // email Gino to take the job -> creates the client app + drops the spec in the inbox
    const c = await composeEmail(s, content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website with the menu and hours.');
    expect(c.sent).toBe(true);
    s = c.state;
    const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact');
    expect(app).toBeTruthy();
    const appId = app!.id;

    // brief the agent to build landing + menu, spelling out the dishes
    const b = await briefBuild(s, content, wordJev, appId, `Build a landing page for Trattoria Gino with opening hours 17:00-22:00, and a menu page listing each dish with its price in DOLR: ${MENU}.`);
    s = b.state;
    expect(b.requested.sort()).toEqual(['landing', 'menu']);

    // first build always ships a teaching bug, on the menu -> not meeting spec yet
    const first = getApp(s, appId)!.repo.find((f) => !f.correct);
    expect(first?.id).toBe('menu');
    expect(['prices_missing', 'prices_wrong', 'prices_curo', 'wrong_items']).toContain(first?.variant);

    // deploy, then fix whichever bug is there, naming it, until the live app meets spec
    s = deploy(s, appId);
    for (let i = 0; i < 6 && !appMeetsSpec(getApp(s, appId)!); i++) {
      const broken = getApp(s, appId)!.repo.find((f) => !f.correct)!;
      s = (await briefFix(s, content, wordJev, appId, FIX[broken.variant ?? ''] ?? `Rebuild the menu with exactly these dishes: ${MENU}.`)).state;
      s = deploy(s, appId);
    }
    expect(appMeetsSpec(getApp(s, appId)!)).toBe(true);

    // end the day: the working client app pays 40
    const before = s.values.crypto;
    s = endDay(s, content);
    expect(s.values.day).toBe(2);
    expect(s.values.crypto).toBeGreaterThan(before); // +40 pay, minus the level-1 subscription
  });

  it('names the repo after the client', async () => {
    const s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact')!;
    expect(app.id).toBe('trattoria-gino');
    expect(app.url).toBe('trattoria-gino.forkyard.app');
  });

  it('a build prompt without the dishes gets an invented menu, and a fix without them invents another', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', 'Build a landing page with the name and opening hours, and a menu page with prices in DOLR.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'hallucinated' });
    const v = getApp(s, 'trattoria-gino')!.repoVersion;
    s = (await briefFix(s, content, wordJev, 'trattoria-gino', 'The menu is wrong, fix it.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'hallucinated' });
    expect(getApp(s, 'trattoria-gino')!.repoVersion).toBe(v + 1);
    s = (await briefFix(s, content, wordJev, 'trattoria-gino', `The menu should be exactly: ${MENU}.`)).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).not.toBe('hallucinated');
  });

  it('in agent.chat, a fix prompt that names the bug fixes it; one that only says "menu" does not', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [
      { id: 'landing', correct: true, params: app.specParams.landing },
      { id: 'menu', correct: false, variant: 'prices_curo', params: app.specParams.menu, seed: 1 },
    ];
    app.repoVersion = 1;
    s.values.agentLevel = 5; // the fix roll succeeds
    const vague = (await promptAgent(s, content, pickJev({ features: ['::menu::feature'] }), gino + 'Please fix the menu page.')).state;
    expect(getApp(vague, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).toBe('prices_curo');
    const named = (await promptAgent(s, content, pickJev({ features: ['::menu::prices_curo'] }), gino + 'The prices show CURO, they need to be DOLR.')).state;
    expect(getApp(named, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
  });

  it("Gino's menu change makes the built menu outdated until a prompt spells out the change", async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [{ id: 'landing', correct: true }, { id: 'menu', correct: true, params: app.specParams.menu }];
    app.repoVersion = 1;
    s = deploy(s, 'trattoria-gino');
    applyEffects(s, content.events.find((e) => e.id === 'd2_restaurant_booking')!.onDeliver!);
    expect(getApp(s, 'trattoria-gino')!.features.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'outdated' });
    s.values.agentLevel = 5;
    const vague = (await briefFix(s, content, wordJev, 'trattoria-gino', 'Update the menu like Gino asked.')).state;
    expect(getApp(vague, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).toBe('outdated');
    const done = (await briefFix(s, content, wordJev, 'trattoria-gino', 'Menu: swap Diavola for Quattro Formaggi at 15, Espresso is now 3.5.')).state;
    expect(getApp(done, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
  });

  it('every site bug has a fix request Jev can match, and naming it fixes it', async () => {
    const asks: Record<string, [string, string]> = {
      name_wrong: ['landing', "The website needs to show it's for Trattoria Gino"],
      hours_wrong: ['landing', 'The opening hours should be 17:00-22:00'],
      prices_missing: ['menu', 'There are no prices next to the dishes'],
      prices_curo: ['menu', 'Prices should be in DOLR, not CURO'],
      wrong_items: ['menu', 'Lasagne is missing and there is an invented dish'],
    };
    for (const [bug, [fid, ask]] of Object.entries(asks)) {
      let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
      const app = getApp(s, 'trattoria-gino')!;
      app.repo = app.required.map((id) => (id === fid ? { id, correct: false, variant: bug, params: app.specParams[id], seed: 2 } : { id, correct: true, params: app.specParams[id] }));
      app.repoVersion = 1;
      s.values.agentLevel = 5;
      s = (await promptAgent(s, content, pickJev({ features: [`::${fid}::${bug}`] }), gino + ask)).state;
      expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === fid)!.correct, bug).toBe(true);
      expect(s.chat.at(-1)!.src, bug).toBe('build');
      expect(s.chat.at(-1)!.text).not.toMatch(/check/i);
    }
  });

  it('a missing landing page gets built from a request to show the restaurant name', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [{ id: 'menu', correct: true, params: app.specParams.menu }];
    app.repoVersion = 1;
    s = (await promptAgent(s, content, pickJev({ features: ['::landing::feature'] }), "The website needs to show it's for trattoria gino")).state;
    expect(getApp(s, 'trattoria-gino')!.repo.some((f) => f.id === 'landing')).toBe(true);
  });

  it('a crashed page on the live site counts as a fix request, and the patch goes live on deploy', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
    app.repoVersion = 1;
    s = deploy(s, 'trattoria-gino');
    getApp(s, 'trattoria-gino')!.breaks.push({ featureId: 'menu', failure: 'failed_fetch', day: 1, seed: 0 });
    getApp(s, 'trattoria-gino')!.features.find((f) => f.id === 'menu')!.correct = false;
    s = (await promptAgent(s, content, wordJev, gino + 'The menu fails to load, it says failed to fetch')).state;
    expect(s.chat.at(-1)!.src).toBe('build');
    s = deploy(s, 'trattoria-gino');
    expect(appMeetsSpec(getApp(s, 'trattoria-gino')!)).toBe(true);
  });

  it('a spec item the build prompt leaves out guarantees its mistake', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', `Landing page for Trattoria Gino with the opening hours, and a menu page: ${MENU}, prices in DOLR.`)).state;
    const landing = getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'landing')!;
    expect(landing).toMatchObject({ correct: false, variant: 'hours_wrong', checked: { name: true, hours: false } });
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.checked).toEqual({ dishes: true, prices: true, currency: true });
  });
  it('bugs stack: an invented menu still gets the wrong currency, and both missed landing items go wrong', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', 'Build a landing page and a menu page.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    const menu = app.repo.find((f) => f.id === 'menu')!;
    expect(menu).toMatchObject({ correct: false, variant: 'hallucinated', also: ['prices_curo'] });
    expect(app.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong', also: ['hours_wrong'] });
    s = deploy(s, 'trattoria-gino');
    const html = renderAppSite(getApp(s, 'trattoria-gino')!, content.apps.restaurant, 'menu');
    expect(html).toContain('CURO');
    expect(html).not.toContain('DOLR');
    expect(html).not.toContain('Margherita');
    expect(html).not.toContain('Trattoria Gino');
  });

  it('naming one of two stacked bugs fixes that one and leaves the other', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [
      { id: 'landing', correct: false, variant: 'name_wrong', also: ['hours_wrong'], params: app.specParams.landing, seed: 1 },
      { id: 'menu', correct: true, params: app.specParams.menu },
    ];
    app.repoVersion = 1;
    s.values.agentLevel = 5;
    s = (await promptAgent(s, content, pickJev({ features: ['::landing::hours_wrong'] }), gino + 'The opening hours on the homepage are wrong, they should be 17:00-22:00.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'landing')).toMatchObject({ correct: false, variant: 'name_wrong' });
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'landing')!.also).toBeUndefined();
    // the reply says what was fixed, and only that
    const hoursFixed = content.apps.restaurant.features[0].bugs!.find((b) => b.id === 'hours_wrong')!.fixed!.map((l) => l.replace('{{hours}}', '17:00-22:00'));
    const lines = s.chat.at(-1)!.text.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
    expect(lines).toHaveLength(1);
    expect(hoursFixed).toContain(lines[0]);
    s = (await promptAgent(s, content, pickJev({ features: ['::landing::name_wrong'] }), gino + 'The restaurant name is misspelled, it should say Trattoria Gino.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'landing')!.correct).toBe(true);
    expect(s.chat.at(-1)!.text).toContain('Trattoria Gino');
  });
  it('dev mode switches bugs and breaks on and off on demand', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', `Landing page for Trattoria Gino, open 17:00-22:00, and a menu page: ${MENU}, prices in DOLR.`)).state;
    const app = getApp(s, 'trattoria-gino')!;
    for (const f of app.repo) Object.assign(f, { correct: true, variant: undefined, also: undefined, params: app.specParams[f.id] });
    s = deploy(s, 'trattoria-gino');
    devToggleBug(s, 'trattoria-gino', 'menu', 'prices_curo');
    devToggleBug(s, 'trattoria-gino', 'menu', 'hallucinated');
    const a = getApp(s, 'trattoria-gino')!;
    for (const list of [a.repo, a.features]) expect(list.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'hallucinated', also: ['prices_curo'] });
    expect(renderAppSite(a, content.apps.restaurant, 'menu')).toContain('CURO');
    devToggleBug(s, 'trattoria-gino', 'menu', 'hallucinated');
    devToggleBug(s, 'trattoria-gino', 'menu', 'prices_curo');
    expect(a.features.find((f) => f.id === 'menu')).toMatchObject({ correct: true, variant: undefined });
    devToggleBug(s, 'trattoria-gino', 'landing', 'visible');
    expect(a.breaks).toMatchObject([{ featureId: 'landing', failure: 'visible' }]);
    expect(renderAppSite(a, content.apps.restaurant, undefined)).toContain('Application error');
    devToggleBug(s, 'trattoria-gino', 'landing', 'visible');
    expect(a.breaks).toEqual([]);
  });
  it('a fixed bug stays fixed: later prompts and rolls never bring it back', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    const lazy = 'Build a landing page and a menu page.';
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', lazy)).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'landing')).toMatchObject({ variant: 'name_wrong', also: ['hours_wrong'] });
    s = (await promptAgent(s, content, wordJev, gino + 'The restaurant name is misspelled, it should say Trattoria Gino. And the opening hours should be 17:00-22:00.')).state;
    s = (await promptAgent(s, content, wordJev, gino + `The menu is invented. It should be: ${MENU}, prices in DOLR.`)).state;
    const app = getApp(s, 'trattoria-gino')!;
    expect(app.repo.every((f) => f.correct)).toBe(true);
    expect(app.fixed).toMatchObject({ landing: expect.arrayContaining(['name_wrong', 'hours_wrong']), menu: expect.arrayContaining(['hallucinated', 'prices_curo']) });
    // the same lazy prompt again: no checklist mistakes, no invented menu
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', lazy)).state;
    expect(getApp(s, 'trattoria-gino')!.repo.every((f) => f.correct)).toBe(true);
    // a weak agent whose every possible mistake was already fixed gets it right
    const a = getApp(s, 'trattoria-gino')!;
    a.fixed!.menu = ['hallucinated', 'prices_missing', 'prices_wrong', 'prices_curo', 'wrong_items'];
    s.values.agentLevel = 0;
    for (let i = 0; i < 5; i++) s = (await briefBuild(s, content, wordJev, 'trattoria-gino', `Menu page: ${MENU}, prices in DOLR.`)).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
  });

  it('deploying does not move the clock', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', 'Build a landing page and a menu page.')).state;
    const t = s.clockMin;
    s = deploy(deploy(s, 'trattoria-gino'), 'trattoria-gino');
    expect(s.clockMin).toBe(t);
  });
  it('typos in dish names still count as the dishes', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', 'Build a landing page and a menu page.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).toBe('hallucinated');
    s = (await promptAgent(s, content, wordJev, gino + 'I need magherita for 12, diavola for 14, lasagna for 15, tiramisu for 7 and espresso for 3 in DOLR for the menu')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: true });
  });

  it('details from earlier messages to the agent count for the next prompt', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    s.chat.push({ from: 'you', text: `Gino sells ${MENU}, all in DOLR.`, day: s.values.day });
    s = (await promptAgent(s, content, wordJev, 'Build the menu page for Trattoria Gino.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: true });
  });
  it('dishes without prices get the right dishes at wrong prices, and the prices fix it', async () => {
    let s = (await composeEmail(startGame(content, 7), content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s.values.agentLevel = 5;
    s = (await briefBuild(s, content, wordJev, 'trattoria-gino', 'Landing page for Trattoria Gino, open 17:00-22:00. Menu page with Margherita, Diavola, Lasagne, Tiramisu and Espresso, prices in DOLR.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'prices_wrong', checked: { dishes: true, prices: false, currency: true } });
    s = deploy(s, 'trattoria-gino');
    const html = renderAppSite(getApp(s, 'trattoria-gino')!, content.apps.restaurant, 'menu');
    for (const d of ['Margherita', 'Diavola', 'Lasagne', 'Tiramisu', 'Espresso']) expect(html).toContain(d);
    expect(html).toMatch(/Margherita<\/span><i><\/i><b>\d+ DOLR/);
    expect(html).not.toContain('Margherita</span><i></i><b>12 DOLR');
    s = (await promptAgent(s, content, wordJev, gino + `The prices are wrong. It should be ${MENU}.`)).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
  });
});
