import { endAll } from './_fixtures';
import { loadContent } from '../content/load';
import { newGame, type GameState } from './state';
import { clone } from './core';
import { APPS } from './config';
import { registerApp, deployApp, breakFeature, getApp } from './apps';
import { appProblems, problemLine } from './complaints';
import { credentialsShown } from './startup';
import { renderAppSite } from '../ui/appsite';

const content = loadContent();

function logan(): { s: GameState; id: string } {
  const s = clone(newGame(3));
  s.phase = 'work';
  s.values.crypto = 1000;
  s.flags.push('first_break'); // the first-night break is taught already: only the bugs set here break it
  const id = registerApp(s, {
    template: 'startup', kind: 'client', name: 'WorkAgent', clientEventId: 'logan_contact', payPerDay: 40,
    spec: [
      { id: 'landing', params: { name: 'WorkAgent', pitch: 'The future of work is agentic.', investors: 'Why Combinator, Bonsai Capital, a67x' } },
      { id: 'about', params: { founder: 'Logan Pryce', credentials: 'Why Combinator Startup School, San Fortuna State dropout, host of the Founder Mode podcast, 2x founder' } },
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

const inbox = (s: GameState) => s.mail.filter((m) => m.folder === 'inbox' && m.addr === 'logan@workagent.test');

describe('complaints at payday', () => {
  it('a working client app pays and sends no complaint', () => {
    const { s } = logan();
    const next = endAll(s, content);
    expect(inbox(next)).toHaveLength(0);
    expect(next.apps[0].strikes).toBe(0);
  });

  it('a buggy client app gets a strike, no pay, and an email from the client naming the bug', () => {
    const { s, id } = logan();
    withBug(s, id, 'landing', 'logos_broken');
    const before = s.values.crypto;
    const next = endAll(s, content);
    expect(next.apps[0].strikes).toBe(1);
    expect(next.tx.some((t) => t.memo.includes('payout'))).toBe(false);
    expect(next.values.crypto).toBeLessThan(before);
    const mail = inbox(next);
    expect(mail).toHaveLength(1);
    expect(mail[0].from).toBe('Logan Pryce');
    expect(mail[0].day).toBe(next.values.day); // lands in the morning
    expect(mail[0].body).toContain('broken images');
    expect(mail[0].body).toContain('before tomorrow');
  });

  it('names exactly what the live site shows (misspelled name, honest pitch, changed credential)', () => {
    const { s, id } = logan();
    withBug(s, id, 'landing', 'pitch_wrong', 2);
    const app = getApp(s, id)!;
    const tmpl = content.apps.startup;
    const pitch = appProblems(app, tmpl)[0].vars.shown;
    expect(problemLine(app, tmpl, appProblems(app, tmpl)[0])).toContain(`"${pitch}"`);
    expect(renderAppSite(app, tmpl, undefined)).toContain(pitch);

    withBug(s, id, 'landing', 'name_wrong', 0);
    const name = appProblems(app, tmpl)[0].vars.shown;
    expect(name).not.toBe('WorkAgent');
    expect(problemLine(app, tmpl, appProblems(app, tmpl)[0])).toContain(`"${name}"`);
    expect(renderAppSite(app, tmpl, undefined)).toContain(name);

    // credentials_wrong: the line names the same credential the about page renders differently
    Object.assign(app.features[0], { correct: true, variant: undefined });
    for (let seed = 0; seed < 21; seed++) {
      withBug(s, id, 'about', 'credentials_wrong', seed);
      const line = problemLine(app, tmpl, appProblems(app, tmpl)[0]);
      const shown = credentialsShown({ variant: 'credentials_wrong', seed, params: app.specParams.about });
      const named = [...line.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      expect(named.length, line).toBeGreaterThan(0);
      if (line.includes('is missing')) expect(shown).not.toContain(named[0]);
      else expect(shown).toContain(named[0]);
      expect(renderAppSite(app, tmpl, 'about')).toContain(shown[0]);
    }
  });

  it('a live break is described by how it fails', () => {
    const { s, id } = logan();
    breakFeature(s, getApp(s, id)!, 'about', 'failed_fetch');
    const next = endAll(s, content);
    expect(inbox(next)[0].body).toContain('the about page shows an error');
  });

  it('the second strike is the firing email', () => {
    const { s, id } = logan();
    withBug(s, id, 'about', 'fake_cofounders');
    let next = endAll(s, content);
    next = endAll(next, content);
    expect(next.apps[0].churned).toBe(true);
    const mail = inbox(next);
    expect(mail).toHaveLength(2);
    expect(mail[1].body).toContain('solo founder');
    expect(mail[1].body).toContain("that's twice");
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
    const { s, id } = logan();
    getApp(s, id)!.deployed = false;
    const next = endAll(s, content);
    expect(inbox(next)[0].body).toContain('the site is down');
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

  it("Logan's update request waits until the site passes a payday; the complaint comes first", () => {
    const { s, id } = logan();
    s.flags.push('logan_client');
    s.flags.sort();
    withBug(s, id, 'about', 'founder_wrong');
    let next = endAll(s, content);
    const subjects = (st: GameState) => inbox(st).map((m) => m.subject);
    expect(subjects(next)).toEqual(['the site']);
    expect(next.delivered.some((d) => d.eventId === 'd2_logan_waitlist')).toBe(false);

    // fixed and redeployed: the next morning brings the update, not a complaint (and nothing breaks overnight)
    const app = next.apps[0];
    for (const list of [app.repo, app.features]) for (const f of list) Object.assign(f, { correct: true, variant: undefined });
    app.breaks = [];
    const odds = APPS.breakOdds;
    APPS.breakOdds = [];
    try { next = endAll(next, content); } finally { APPS.breakOdds = odds; }
    expect(next.delivered.some((d) => d.eventId === 'd2_logan_waitlist' && d.day === 3)).toBe(true);
    expect(subjects(next)).toEqual(['the site']);
    expect(content.events.find((e) => e.id === 'd2_logan_waitlist')!.body).not.toMatch(/agent|redeploy/i);
  });
});
