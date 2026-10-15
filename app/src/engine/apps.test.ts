import { newGame, type GameState } from './state';
import { clone } from './core';
import {
  registerApp, buildApp, deployApp, fixApp, breakFeature,
  appMeetsSpec, appWorking, runPayday, getApp,
} from './apps';

function withShop(kind: 'client' | 'user' = 'client'): { s: GameState; id: string } {
  const s = clone(newGame(1));
  const id = registerApp(s, {
    template: 'shop',
    kind,
    name: 'Rosa Shop',
    payPerDay: 50,
    spec: [{ id: 'price_chf' }, { id: 'catalog' }, { id: 'checkout_flow' }],
  });
  return { s, id };
}

/** Force an app into a fully working, deployed state. */
function makeWorking(s: GameState, id: string): void {
  const app = getApp(s, id)!;
  app.repo = app.required.map((f) => ({ id: f, correct: true }));
  app.repoVersion = 1;
  deployApp(s, id);
}

describe('app lifecycle', () => {
  it('registers with required features from the spec and no deploy yet', () => {
    const { s, id } = withShop('user');
    const app = getApp(s, id)!;
    expect(app.required).toEqual(['price_chf', 'catalog', 'checkout_flow']);
    expect(app.deployed).toBe(false);
    expect(app.users).toBe(100);
  });

  it('builds only requested features; the rest stay missing', () => {
    const { s, id } = withShop();
    buildApp(s, id, ['price_chf', 'catalog'], 5);
    const app = getApp(s, id)!;
    expect(app.repo.map((f) => f.id).sort()).toEqual(['catalog', 'price_chf']);
    expect(app.repoVersion).toBe(1);
    expect(appMeetsSpec(app)).toBe(false); // checkout_flow missing
  });

  it('deploy makes the repo live and gates working on the deployed version', () => {
    const { s, id } = withShop();
    makeWorking(s, id);
    const app = getApp(s, id)!;
    expect(app.deployed).toBe(true);
    expect(appWorking(app)).toBe(true);
    // agent pushes a change the player hasn't deployed -> not working until redeploy
    app.repoVersion = 2;
    expect(appWorking(app)).toBe(false);
  });

  it('spec check fails on missing, wrong, or broken features', () => {
    const { s, id } = withShop();
    makeWorking(s, id);
    const app = getApp(s, id)!;
    expect(appMeetsSpec(app)).toBe(true);
    breakFeature(s, app, 'catalog', 'failed_fetch');
    expect(appMeetsSpec(app)).toBe(false);
  });

  it('fix only acts on a real problem and bumps the repo version', () => {
    const { s, id } = withShop();
    buildApp(s, id, ['price_chf', 'catalog', 'checkout_flow'], 1);
    const app = getApp(s, id)!;
    // pin a known state: price_chf correct, catalog broken
    app.repo = app.required.map((f) => ({ id: f, correct: f !== 'catalog' }));
    const vBefore = app.repoVersion;
    expect(fixApp(s, id, 'price_chf', 5)).toBe(false); // not a problem -> no-op
    expect(getApp(s, id)!.repoVersion).toBe(vBefore);
    // fixing the real problem always advances the repo version (success is probabilistic)
    fixApp(s, id, 'catalog', 5);
    expect(getApp(s, id)!.repoVersion).toBeGreaterThan(vBefore);
  });
});

describe('payday', () => {
  it('pays a working client app and resets strikes', () => {
    const { s, id } = withShop();
    makeWorking(s, id);
    s.values.crypto = 0;
    runPayday(s);
    expect(s.values.crypto).toBe(50);
    expect(getApp(s, id)!.strikes).toBe(0);
  });

  it('strikes a broken client app and churns on the second strike', () => {
    const { s, id } = withShop();
    makeWorking(s, id);
    const app = getApp(s, id)!;
    breakFeature(s, app, 'catalog', 'visible'); // now broken
    runPayday(s);
    expect(getApp(s, id)!.strikes).toBe(1);
    runPayday(s);
    expect(getApp(s, id)!.churned).toBe(true);
  });

  it('user app grows when working and bleeds users when broken', () => {
    const { s, id } = withShop('user');
    makeWorking(s, id);
    s.values.crypto = 0;
    runPayday(s); // 100 users * 0.3 = 30, then grows to 108
    expect(s.values.crypto).toBe(30);
    expect(getApp(s, id)!.users).toBe(108);
    // break it: first broken payday -40%
    breakFeature(s, getApp(s, id)!, 'catalog', 'visible');
    runPayday(s);
    expect(getApp(s, id)!.users).toBe(Math.round(108 * 0.6));
    // second broken payday -> 5%
    runPayday(s);
    expect(getApp(s, id)!.users).toBe(Math.round(Math.round(108 * 0.6) * 0.05));
  });
});
