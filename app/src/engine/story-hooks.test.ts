import { startGame, endDay } from './day';
import { clone } from './core';
import { composeEmail, briefBuild } from './actions';
import { scriptedBreak, getApp, deployApp, registerApp, appWorking } from './apps';
import { makeContent, fakeRouter } from './_fixtures';
import type { Content } from '../content/schema';

function withLead(): Content {
  return makeContent({
    events: [
      {
        id: 'owner_contact',
        site: 'qmail',
        from: 'Rosa',
        addr: 'rosa@trattoria.test',
        subject: 'Re: your offer',
        body: 'Great — here is the spec: menu with prices in DOLR.',
        trigger: { dayMin: 1 },
        latent: true,
        outcomes: [
          {
            id: 'offer',
            when: 'the player offers to build the website',
            effects: { createApp: { template: 'shop', kind: 'client', name: 'Trattoria', payPerDay: 40, spec: [{ id: 'price_chf' }] } },
            reply: 'Wonderful, thank you.',
          },
        ],
      },
    ],
  });
}

describe('latent lead + composeEmail', () => {
  it('is not in the inbox until emailed, then delivers and runs effects', async () => {
    const content = withLead();
    const s = startGame(content, 1);
    expect(s.delivered.some((d) => d.eventId === 'owner_contact')).toBe(false);
    const r = fakeRouter({ route: () => ({ kind: 'outcome', outcomeId: 'offer' }) });
    const out = await composeEmail(s, content, r, 'rosa@trattoria.test', 'I can build your site.');
    expect(out.sent).toBe(true);
    expect(out.reply).toBe('Wonderful, thank you.\n\nGreat — here is the spec: menu with prices in DOLR.');
    expect(out.state.apps.some((a) => a.name === 'Trattoria')).toBe(true);
    expect(out.state.delivered.some((d) => d.eventId === 'owner_contact')).toBe(true); // now in inbox
  });

  it('enforces one email per recipient per day', async () => {
    const content = withLead();
    const s = startGame(content, 1);
    const r = fakeRouter({ route: () => ({ kind: 'nothing' }) });
    const first = await composeEmail(s, content, r, 'rosa@trattoria.test', 'hm');
    expect(first.sent).toBe(true);
    const second = await composeEmail(first.state, content, r, 'rosa@trattoria.test', 'retry');
    expect(second.sent).toBe(false);
  });
});

describe('scripted break', () => {
  it('knocks a live app out so it stops meeting spec', () => {
    const s = clone(startGame(makeContent(), 1));
    const id = registerApp(s, { template: 'shop', kind: 'client', name: 'Shop', payPerDay: 40, spec: [{ id: 'price_chf' }, { id: 'catalog' }] });
    const app = getApp(s, id)!;
    app.repo = app.required.map((f) => ({ id: f, correct: true }));
    app.repoVersion = 1;
    deployApp(s, id);
    expect(appWorking(getApp(s, id)!)).toBe(true);
    scriptedBreak(s);
    expect(appWorking(getApp(s, id)!)).toBe(false);
    expect(getApp(s, id)!.breaks.length).toBe(1);
  });
});

describe('first build always teaches a bug', () => {
  it('ships at least one wrong feature on the first build even at high level', async () => {
    const content = makeContent();
    const s = startGame(content, 1);
    const appId = registerApp(s, { template: 'shop', kind: 'client', name: 'Shop', payPerDay: 40, spec: [{ id: 'price_chf' }, { id: 'catalog' }, { id: 'checkout_flow' }] });
    s.values.agentLevel = 5;
    s.values.crypto = 100;
    const r = fakeRouter({ features: (_p, ids) => ids });
    const out = await briefBuild(s, content, r, appId, 'build everything', 5);
    const app = getApp(out.state, appId)!;
    expect(app.repo.some((f) => !f.correct)).toBe(true);
  });
});

// keep the day loop honest with the new effects
describe('breakApp effect via the day loop', () => {
  it('a scheduled breakApp event breaks an app overnight', () => {
    const content = makeContent({
      events: [{ id: 'sabotage', site: 'qmail', trigger: { dayMin: 2 }, onDeliver: { breakApp: true } }],
    });
    let s = startGame(content, 1);
    const id = registerApp(s, { template: 'shop', kind: 'user', name: 'App', spec: [{ id: 'catalog' }] });
    const app = getApp(s, id)!;
    app.repo = [{ id: 'catalog', correct: true }];
    app.repoVersion = 1;
    deployApp(s, id);
    s.values.crypto = 100;
    s = endDay(s, content); // advance to day 2; morning delivers 'sabotage' -> breakApp
    expect(getApp(s, id)!.breaks.length).toBeGreaterThan(0);
  });
});
