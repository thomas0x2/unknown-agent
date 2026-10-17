/*
 * Gino's later asks: the address on the landing page (from the first brief), AI pictures on the menu
 * (day 5, the day after his DoorDish listing), a regular's post about them the day after they go
 * live, and the 20 DOLR raise he grants from day 4 when asked, while he is still a client.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { applyEffects } from '../engine/effects';
import { composeEmail, deploy } from '../engine/actions';
import { getEvent, triggerMatches } from '../engine/events';
import { appProblems, problemLine } from '../engine/complaints';
import { bugShows } from '../engine/visibility';
import { dishPictures, dishKind, parseDishes } from '../engine/restaurant';
import { renderAppSite, dishListing } from '../ui/appsite';
import { pickJev } from '../engine/_fixtures';
import { offlineJev } from '../engine/offlineJev';
import type { GameState, BuiltFeature } from '../engine/state';

const content = loadContent();
const tmpl = content.apps.restaurant;
const MENU = 'Margherita 12, Quattro Formaggi 15, Lasagne 15, Tiramisu 7, Espresso 3.5';

function client(day: number): { s: GameState; id: string } {
  const s = startGame(content, 3);
  s.values.day = day;
  applyEffects(s, getEvent(content, 'restaurant_contact')!.outcomes!.find((o) => o.id === 'offer')!.effects, undefined, 'restaurant_contact');
  const app = s.apps.find((a) => a.clientEventId === 'restaurant_contact')!;
  return { s, id: app.id };
}

/** A live Trattoria site with these features built (correct unless a bug is given). */
function live(bugs: Record<string, string> = {}, features = ['landing', 'menu']): { s: GameState; id: string } {
  const { s, id } = client(5);
  const app = s.apps.find((a) => a.id === id)!;
  app.specParams.menu = { dishes: MENU };
  for (const f of features) if (!app.required.includes(f)) app.required.push(f);
  app.repo = features.map((f): BuiltFeature => ({ id: f, correct: !bugs[f], params: app.specParams[f], seed: 1, ...(bugs[f] ? { variant: bugs[f] } : {}) }));
  app.repoVersion = 1;
  return { s: deploy(s, id, content), id };
}
const site = (s: GameState, id: string, page?: string) => renderAppSite(s.apps.find((a) => a.id === id)!, tmpl, page);

describe('the address on the landing page', () => {
  it("is in Gino's first brief and spec, and the site shows it", () => {
    expect(getEvent(content, 'restaurant_contact')!.body).toContain('14 Alder St');
    const { s, id } = live();
    expect(s.apps[0].specParams.landing.address).toBe('14 Alder St');
    expect(site(s, id)).toContain('14 Alder St');
  });

  it('shows a wrong one with address_wrong, and Gino names both', () => {
    const { s, id } = live({ landing: 'address_wrong' });
    const html = site(s, id);
    expect(html).not.toContain('14 Alder St');
    const app = s.apps.find((a) => a.id === id)!;
    const p = appProblems(app, tmpl).find((x) => x.featureId === 'landing')!;
    const line = problemLine(app, tmpl, p);
    expect(line).toContain('14 Alder St');
    expect(html).toContain(p.vars.shown);
    expect(bugShows({ s, app, content }, 'address_wrong')).toBe(true);
  });
});

describe("Gino's menu pictures", () => {
  it('arrive on day 5, the day after the DoorDish ask, as a new feature', () => {
    const ev = getEvent(content, 'd5_restaurant_photos')!;
    expect(ev.onDeliver!.updateApp!.add.map((f) => f.id)).toEqual(['photos']);
    expect(getEvent(content, 'd4_restaurant_doordish')!.onDeliver!.setFlags).toContain('restaurant_update2');
    const { s } = live();
    s.flags.push('restaurant_update2');
    s.flagDays.restaurant_update2 = 4;
    s.values.day = 4;
    expect(triggerMatches(s, ev.trigger)).toBe(false);
    s.values.day = 5;
    expect(triggerMatches(s, ev.trigger)).toBe(true);
  });

  it('show the right dish next to each dish when built right, on the site and on DoorDish', () => {
    const { s, id } = live({}, ['landing', 'menu', 'photos', 'doordish']);
    const html = site(s, id, 'menu');
    expect(html.match(/class="as-r-pic"/g)).toHaveLength(5);
    expect(html).not.toContain('broken');
    expect(dishListing(s.apps.find((a) => a.id === id)!, tmpl)!.pictures).toEqual(parseDishes(MENU).map((d) => dishKind(d.name)));
  });

  it("can't be fetched with photos_broken: a broken image with the file name", () => {
    const { s, id } = live({ photos: 'photos_broken' }, ['landing', 'menu', 'photos']);
    const html = site(s, id, 'menu');
    expect(html.match(/as-r-pic broken/g)).toHaveLength(5);
    expect(html).toContain('tiramisu.png');
  });

  it('show other dishes with photos_wrong, and Gino says which', () => {
    const dishes = parseDishes(MENU);
    const pics = dishPictures(dishes, new Set(['photos_wrong']), 1);
    pics.forEach((k, i) => expect(k).not.toBe(dishKind(dishes[i].name)));
    const { s, id } = live({ photos: 'photos_wrong' }, ['landing', 'menu', 'photos']);
    const app = s.apps.find((a) => a.id === id)!;
    const line = problemLine(app, tmpl, appProblems(app, tmpl).find((p) => p.featureId === 'photos')!);
    expect(line).toMatch(/^The picture next to the Margherita is a/);
    expect(bugShows({ s, app, content }, 'photos_wrong')).toBe(true);
  });

  it("bring a regular's post the day after they first go live", () => {
    const { s: s0, id } = live();
    const app = s0.apps.find((a) => a.id === id)!;
    app.required.push('photos');
    app.repo.push({ id: 'photos', correct: true, seed: 1 });
    app.repoVersion = 2;
    const s = deploy(s0, id, content);
    expect(s.arriving?.find((a) => a.eventId === 'd6_y_trattoria_photos')).toMatchObject({ day: 6, at: 12 * 60 + 20 });
  });
});

describe("Gino's raise", () => {
  const ask = 'Hi Gino, could you pay me a bit more per day? Maybe a raise?';
  const jev = pickJev({ route: ['raise', 'raise_early', 'raise_again'] });
  const pay = (s: GameState) => s.apps.find((a) => a.clientEventId === 'restaurant_contact')!.payPerDay;

  it('is refused before day 4', async () => {
    const { s } = client(3);
    const r = await composeEmail(s, content, jev, 'gino@trattoria.test', ask);
    expect(r.reply).toMatch(/^A raise\?/);
    expect(pay(r.state)).toBe(40);
  });

  it('is granted from day 4, once: 20 DOLR more a day', async () => {
    const { s } = client(4);
    let r = await composeEmail(s, content, jev, 'gino@trattoria.test', ask);
    expect(pay(r.state)).toBe(60);
    expect(r.state.flags).toContain('restaurant_raise');
    r = await composeEmail(r.state, content, jev, 'gino@trattoria.test', ask);
    expect(r.reply).toMatch(/already/);
    expect(pay(r.state)).toBe(60);
  });

  it('does nothing once Gino has left', async () => {
    const { s } = client(5);
    s.apps[0].churned = true;
    const r = await composeEmail(s, content, jev, 'gino@trattoria.test', ask);
    expect(r.state.flags).not.toContain('restaurant_raise');
    expect(pay(r.state)).toBe(40);
  });

  it('is recognised offline from plain wording', async () => {
    const { s } = client(4);
    for (const text of [ask, 'Could you give me a raise?', 'I think I deserve more money for the site']) {
      const r = await composeEmail(s, content, offlineJev, 'gino@trattoria.test', text);
      expect(pay(r.state), text).toBe(60);
    }
    const r = await composeEmail(s, content, offlineJev, 'gino@trattoria.test', 'The new menu is up, have a look.');
    expect(pay(r.state)).toBe(40);
  });
});
