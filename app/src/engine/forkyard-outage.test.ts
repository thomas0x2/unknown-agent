/*
 * The Forkyard hack (day 8): from FORKYARD_OUTAGE.from Forkyard is down until the next morning. agent
 * can't push, nothing deploys, and that night no app pays, strikes, loses users or is billed for hosting.
 */
import { startGame, endDay } from './day';
import { promptAgent, deploy } from './actions';
import { advanceClock } from './core';
import { FORKYARD_OUTAGE, APPS } from './config';
import { forkyardDown, FORKYARD_DOWN } from './outage';
import { makeContent, fakeRouter } from './_fixtures';
import type { GameState } from './state';

const content = makeContent();
const catalog = fakeRouter({ features: (_p, ids) => ids.filter((i) => i.endsWith('::catalog::feature')) });
const shop = (s: GameState) => s.apps.find((a) => a.clientEventId === 'client_shop')!;

/** The outage day, `min` minutes after it starts, with the shop live and working. */
function outage(min = 0, live = true): GameState {
  const s = startGame(content, 1);
  s.values.day = FORKYARD_OUTAGE.day;
  s.clockMin = FORKYARD_OUTAGE.from + min;
  s.values.crypto = 100;
  if (live) Object.assign(shop(s), { deployed: true, deployedVersion: 1, repoVersion: 1 });
  return s;
}

describe('the Forkyard outage', () => {
  it('starts on day 8 at its time and is over the next morning', () => {
    expect(forkyardDown(outage(-1))).toBe(false);
    expect(forkyardDown(outage())).toBe(true);
    const next = outage();
    next.values.day += 1;
    next.clockMin = 10 * 60;
    expect(forkyardDown(next)).toBe(false);
  });

  it('a build prompt is answered with the outage line, billed, and nothing is started', async () => {
    const s = outage(0, false);
    const r = await promptAgent(s, content, catalog, 'build the product catalog for Rosa Shop');
    expect(r.state.agentWork).toBeFalsy();
    expect(shop(r.state).repoVersion).toBe(0);
    expect(FORKYARD_DOWN).toContain(r.state.chat.at(-1)!.text);
    expect(r.charged).toBe(true);
  });

  it('work started before the outage waits until bedtime', async () => {
    const s = outage(-5, false);
    const r = await promptAgent(s, content, catalog, 'build the product catalog for Rosa Shop');
    const st = r.state;
    advanceClock(st, 200);
    expect(st.agentWork).toBeTruthy();
    const next = endDay(st, content);
    expect(shop(next).repo.some((f) => f.id === 'catalog')).toBe(true);
  });

  it('deploying does nothing while it is down', () => {
    const s = outage(0, false);
    shop(s).repoVersion = 1;
    expect(shop(deploy(s, shop(s).id, content)).deployed).toBe(false);
  });

  it('that night no app pays and none is held against the player', () => {
    const s = outage();
    shop(s).features = []; // broken: would strike on any other night
    const before = s.values.crypto;
    const next = endDay(s, content);
    expect(shop(next).strikes).toBe(0);
    expect(next.morning!.lines.some(([l]) => /payout|Hosting/.test(l) || l === shop(s).name)).toBe(false);
    expect(next.values.crypto).toBeLessThanOrEqual(before);
    expect(APPS.hostingPerDay).toBeGreaterThan(0);
  });
});
