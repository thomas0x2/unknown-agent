/*
 * Plays day 1 of the real authored content through the engine with the offline Jev router: take the
 * restaurant lead, build and deploy the site, check it, fix the teaching bug, end the day, get paid.
 */
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { composeEmail, briefBuild, briefFix, deploy, promptAgent } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { appMeetsSpec, getApp } from '../engine/apps';
import { offlineJev } from '../engine/jev';

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
    const c = await composeEmail(s, content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website with the menu and hours.');
    expect(c.sent).toBe(true);
    s = c.state;
    const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact');
    expect(app).toBeTruthy();
    const appId = app!.id;

    // brief the agent to build landing + menu, spelling out the dishes
    const b = await briefBuild(s, content, offlineJev, appId, `Build a landing page with the name and opening hours, and a menu page listing each dish with its price in DOLR: ${MENU}.`);
    s = b.state;
    expect(b.requested.sort()).toEqual(['landing', 'menu']);

    // first build always ships a teaching bug, on the menu -> not meeting spec yet
    const first = getApp(s, appId)!.repo.find((f) => !f.correct);
    expect(first?.id).toBe('menu');
    expect(['prices_missing', 'prices_curo', 'wrong_items']).toContain(first?.variant);

    // deploy, then fix whichever bug is there, naming it, until the live app meets spec
    s = deploy(s, appId);
    for (let i = 0; i < 6 && !appMeetsSpec(getApp(s, appId)!); i++) {
      const broken = getApp(s, appId)!.repo.find((f) => !f.correct)!;
      s = (await briefFix(s, content, offlineJev, appId, FIX[broken.variant ?? ''] ?? `Rebuild the menu with exactly these dishes: ${MENU}.`)).state;
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
    const s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact')!;
    expect(app.id).toBe('trattoria-gino');
    expect(app.url).toBe('trattoria-gino.forkyard.app');
  });

  it('a build prompt without the dishes gets an invented menu, and a fix without them invents another', async () => {
    let s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    s = (await briefBuild(s, content, offlineJev, 'trattoria-gino', 'Build a landing page with the name and opening hours, and a menu page with prices in DOLR.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'hallucinated' });
    const v = getApp(s, 'trattoria-gino')!.repoVersion;
    s = (await briefFix(s, content, offlineJev, 'trattoria-gino', 'The menu is wrong, fix it.')).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'hallucinated' });
    expect(getApp(s, 'trattoria-gino')!.repoVersion).toBe(v + 1);
    s = (await briefFix(s, content, offlineJev, 'trattoria-gino', `The menu should be exactly: ${MENU}.`)).state;
    expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).not.toBe('hallucinated');
  });

  it('in agent.chat, a fix prompt that names the bug fixes it; one that only says "menu" does not', async () => {
    let s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [
      { id: 'landing', correct: true, params: app.specParams.landing },
      { id: 'menu', correct: false, variant: 'prices_curo', params: app.specParams.menu, seed: 1 },
    ];
    app.repoVersion = 1;
    s.values.agentLevel = 5; // the fix roll succeeds
    const vague = (await promptAgent(s, content, offlineJev, 'Please fix the menu page.')).state;
    expect(getApp(vague, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).toBe('prices_curo');
    const named = (await promptAgent(s, content, offlineJev, 'The prices show CURO, they need to be DOLR.')).state;
    expect(getApp(named, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.correct).toBe(true);
  });

  it("Gino's menu change makes the built menu outdated until a prompt spells out the change", async () => {
    let s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [{ id: 'landing', correct: true }, { id: 'menu', correct: true, params: app.specParams.menu }];
    app.repoVersion = 1;
    s = deploy(s, 'trattoria-gino');
    applyEffects(s, content.events.find((e) => e.id === 'd2_restaurant_booking')!.onDeliver!);
    expect(getApp(s, 'trattoria-gino')!.features.find((f) => f.id === 'menu')).toMatchObject({ correct: false, variant: 'outdated' });
    s.values.agentLevel = 5;
    const vague = (await briefFix(s, content, offlineJev, 'trattoria-gino', 'Update the menu like Gino asked.')).state;
    expect(getApp(vague, 'trattoria-gino')!.repo.find((f) => f.id === 'menu')!.variant).toBe('outdated');
    const done = (await briefFix(s, content, offlineJev, 'trattoria-gino', 'Menu: swap Diavola for Quattro Formaggi at 15, Espresso is now 3.5.')).state;
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
      let s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
      const app = getApp(s, 'trattoria-gino')!;
      app.repo = app.required.map((id) => (id === fid ? { id, correct: false, variant: bug, params: app.specParams[id], seed: 2 } : { id, correct: true, params: app.specParams[id] }));
      app.repoVersion = 1;
      s.values.agentLevel = 5;
      s = (await promptAgent(s, content, offlineJev, ask)).state;
      expect(getApp(s, 'trattoria-gino')!.repo.find((f) => f.id === fid)!.correct, bug).toBe(true);
      expect(s.chat.at(-1)!.src, bug).toBe('build');
      expect(s.chat.at(-1)!.text).not.toMatch(/check/i);
    }
  });

  it('a missing landing page gets built from a request to show the restaurant name', async () => {
    let s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = [{ id: 'menu', correct: true, params: app.specParams.menu }];
    app.repoVersion = 1;
    s = (await promptAgent(s, content, offlineJev, "The website needs to show it's for trattoria gino")).state;
    expect(getApp(s, 'trattoria-gino')!.repo.some((f) => f.id === 'landing')).toBe(true);
  });

  it('a crashed page on the live site counts as a fix request, and the patch goes live on deploy', async () => {
    let s = (await composeEmail(startGame(content, 7), content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const app = getApp(s, 'trattoria-gino')!;
    app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
    app.repoVersion = 1;
    s = deploy(s, 'trattoria-gino');
    getApp(s, 'trattoria-gino')!.breaks.push({ featureId: 'menu', failure: 'failed_fetch', day: 1, seed: 0 });
    getApp(s, 'trattoria-gino')!.features.find((f) => f.id === 'menu')!.correct = false;
    s = (await promptAgent(s, content, offlineJev, 'The menu fails to load, it says failed to fetch')).state;
    expect(s.chat.at(-1)!.src).toBe('build');
    s = deploy(s, 'trattoria-gino');
    expect(appMeetsSpec(getApp(s, 'trattoria-gino')!)).toBe(true);
  });
});
