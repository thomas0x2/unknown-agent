import { endAll } from './_fixtures';
import { loadContent } from '../content/load';
import { newGame, type GameState } from './state';
import { clone } from './core';
import { APPS } from './config';
import { registerApp, deployApp, breakFeature, getApp } from './apps';
import { appProblems, problemLine } from './complaints';
import { menuDishes } from './restaurant';
import { renderAppSite } from '../ui/appsite';

const content = loadContent();

function gino(): { s: GameState; id: string } {
  const s = clone(newGame(3));
  s.phase = 'work';
  s.values.crypto = 1000;
  const id = registerApp(s, {
    template: 'restaurant', kind: 'client', name: 'Trattoria Gino', clientEventId: 'restaurant_contact', payPerDay: 40,
    spec: [
      { id: 'landing', params: { name: 'Trattoria Gino', hours: '17:00-22:00' } },
      { id: 'menu', params: { dishes: 'Margherita 12, Diavola 14, Lasagne 15, Tiramisu 7, Espresso 3' } },
    ],
  });
  const app = getApp(s, id)!;
  app.repo = app.required.map((f) => ({ id: f, correct: true, params: app.specParams[f] }));
  app.repoVersion = 1;
  deployApp(s, id);
  return { s, id };
}

function withBug(s: GameState, id: string, featureId: string, variant: string, seed = 5): void {
  const app = getApp(s, id)!;
  for (const list of [app.repo, app.features]) {
    const f = list.find((x) => x.id === featureId)!;
    Object.assign(f, { correct: false, variant, seed });
  }
}

const inbox = (s: GameState) => s.mail.filter((m) => m.folder === 'inbox' && m.addr === 'gino@trattoria.test');

describe('complaints at payday', () => {
  it("Gino's day 3 thank-you only comes if the site never broke", () => {
    const thanks = (next: GameState) => next.delivered.some((d) => d.eventId === 'd3_restaurant_thanks');
    const onDay2 = () => { const g = gino(); g.s.values.day = 2; g.s.flags.push('restaurant_client'); return g; };
    expect(thanks(endAll(onDay2().s, content))).toBe(true);
    const { s, id } = onDay2();
    withBug(s, id, 'menu', 'prices_curo');
    const next = endAll(s, content);
    expect(inbox(next).length).toBeGreaterThan(0); // the complaint
    expect(thanks(next)).toBe(false);
  });

  it('a working client app pays and sends no complaint', () => {
    const { s } = gino();
    const next = endAll(s, content);
    expect(inbox(next)).toHaveLength(0);
    expect(next.apps[0].strikes).toBe(0);
  });

  it('a buggy client app gets a strike, no pay, and an email from the client naming the bug', () => {
    const { s, id } = gino();
    withBug(s, id, 'menu', 'prices_curo');
    const before = s.values.crypto;
    const next = endAll(s, content);
    expect(next.apps[0].strikes).toBe(1);
    expect(next.tx.some((t) => t.memo.includes('payout'))).toBe(false);
    expect(next.values.crypto).toBeLessThan(before);
    const mail = inbox(next);
    expect(mail).toHaveLength(1);
    expect(mail[0].from).toBe('Gino (Trattoria)');
    expect(mail[0].day).toBe(next.values.day); // lands in the morning
    expect(mail[0].body).toContain('CURO');
    expect(mail[0].body).toContain('before tomorrow');
  });

  it('names exactly what the live site shows (misspelled name, wrong hours, changed dish)', () => {
    const { s, id } = gino();
    withBug(s, id, 'landing', 'hours_wrong', 2);
    const app = getApp(s, id)!;
    const tmpl = content.apps.restaurant;
    const hours = appProblems(app, tmpl)[0].vars.shown;
    expect(problemLine(app, tmpl, appProblems(app, tmpl)[0])).toContain(`open ${hours}.`);
    expect(renderAppSite(app, tmpl, undefined)).toContain(hours);

    withBug(s, id, 'landing', 'name_wrong', 0);
    const name = appProblems(app, tmpl)[0].vars.shown;
    expect(name).not.toBe('Trattoria Gino');
    expect(problemLine(app, tmpl, appProblems(app, tmpl)[0])).toContain(`"${name}"`);
    expect(renderAppSite(app, tmpl, undefined)).toContain(name);

    // wrong_items: the line names the same dish the menu page renders differently
    withBug(s, id, 'landing', 'hours_wrong', 2);
    Object.assign(app.features[0], { correct: true, variant: undefined });
    for (let seed = 0; seed < 21; seed++) {
      withBug(s, id, 'menu', 'wrong_items', seed);
      const line = problemLine(app, tmpl, appProblems(app, tmpl)[0]);
      const shown = menuDishes({ variant: 'wrong_items', seed, params: app.specParams.menu }).dishes.map((d) => d.name);
      const named = [...line.matchAll(/(?:"([^"]+)"|has ([^.]+?)\.|^(\S[^.]*?) is missing)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
      expect(named.length).toBeGreaterThan(0);
      if (line.includes('is missing')) expect(shown).not.toContain(named[0]);
      else expect(shown).toContain(named[0]);
    }
  });

  it('a live break is described by how it fails', () => {
    const { s, id } = gino();
    breakFeature(s, getApp(s, id)!, 'menu', 'failed_fetch');
    const next = endAll(s, content);
    expect(inbox(next)[0].body).toContain("menu page doesn't load");
  });

  it('the second strike is the firing email', () => {
    const { s, id } = gino();
    withBug(s, id, 'menu', 'prices_missing');
    let next = endAll(s, content);
    next = endAll(next, content);
    expect(next.apps[0].churned).toBe(true);
    const mail = inbox(next);
    expect(mail).toHaveLength(2);
    expect(mail[1].body).toContain('no prices');
    expect(mail[1].body).toContain('second time');
  });

  it('a broken user app gets a complaint on Y about the actual problem', () => {
    const s = clone(newGame(4));
    s.phase = 'work';
    s.values.crypto = 1000;
    const id = registerApp(s, {
      template: 'swaplist', kind: 'user', name: 'Swaplist', clientEventId: 'viktor_contact', startUsers: 20,
      spec: [{ id: 'listings' }, { id: 'search' }, { id: 'contact' }, { id: 'mark_sold' }],
    });
    const app = getApp(s, id)!;
    app.repo = app.required.filter((f) => f !== 'search').map((f) => ({ id: f, correct: true }));
    app.repoVersion = 1;
    deployApp(s, id);
    const next = endAll(s, content);
    expect(next.apps[0].users).toBeLessThan(20);
    expect(next.mail.some((m) => m.subject.includes('Swaplist'))).toBe(false);
    expect(next.yExtra).toHaveLength(1);
    expect(next.yExtra[0].text).toContain('No search on Swaplist');
    expect(next.yExtra[0].day).toBe(next.values.day);
  });

  it('an app taken offline is complained about as offline', () => {
    const { s, id } = gino();
    getApp(s, id)!.deployed = false;
    const next = endAll(s, content);
    expect(inbox(next)[0].body).toContain('The site is gone');
  });

  it('every app template has complaint copy for each feature', () => {
    for (const t of Object.values(content.apps)) {
      for (const f of t.features) {
        expect(f.complaints?.missing, `${t.id}.${f.id}`).toBeTruthy();
        expect(f.complaints?.wrong, `${t.id}.${f.id}`).toBeTruthy();
      }
      expect(t.complaints?.offline, t.id).toBeTruthy();
    }
  });

  it("Gino's update request waits until the site passes a payday; the complaint comes first", () => {
    const { s, id } = gino();
    s.flags.push('restaurant_client');
    s.flags.sort();
    withBug(s, id, 'menu', 'prices_curo');
    let next = endAll(s, content);
    const subjects = (st: GameState) => inbox(st).map((m) => m.subject);
    expect(subjects(next)).toEqual(['The website']);
    expect(next.delivered.some((d) => d.eventId === 'd2_restaurant_booking')).toBe(false);

    // fixed and redeployed: the next morning brings the update, not a complaint (and nothing breaks overnight)
    const app = next.apps[0];
    for (const list of [app.repo, app.features]) for (const f of list) Object.assign(f, { correct: true, variant: undefined });
    app.breaks = [];
    const odds = APPS.breakOdds;
    APPS.breakOdds = [];
    try { next = endAll(next, content); } finally { APPS.breakOdds = odds; }
    expect(next.delivered.some((d) => d.eventId === 'd2_restaurant_booking' && d.day === 3)).toBe(true);
    expect(subjects(next)).toEqual(['The website']);
    expect(content.events.find((e) => e.id === 'd2_restaurant_booking')!.body).not.toMatch(/agent|redeploy/i);
  });
});
