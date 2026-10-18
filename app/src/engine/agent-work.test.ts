/*
 * Builds and fixes take game time: the prompt is billed and answered with an "I've started" line, and
 * the push and the agent's report land once the clock gets there. The agent stays promptable meanwhile.
 */
import { startGame, endDay } from './day';
import { promptAgent, workMinutes } from './actions';
import { advanceClock } from './core';
import { AGENT_WORK, CLOCK } from './config';
import { makeContent, fakeRouter } from './_fixtures';

const content = makeContent();
const catalog = fakeRouter({ features: (_p, ids) => ids.filter((i) => i.endsWith('::catalog::feature')) });
const shop = (s: ReturnType<typeof startGame>) => s.apps.find((a) => a.clientEventId === 'client_shop')!;

async function startBuild() {
  const s = startGame(content, 1);
  s.values.crypto = 100;
  const r = await promptAgent(s, content, catalog, 'build the product catalog for Rosa Shop');
  return { s, r };
}

describe('agent work takes game time', () => {
  it('a build is billed now, but nothing is pushed until its time comes', async () => {
    const { s, r } = await startBuild();
    expect(r.charged).toBe(true);
    expect(r.state.values.crypto).toBeLessThan(100);
    expect(shop(r.state).repoVersion).toBe(shop(s).repoVersion);
    expect(r.state.commits.length).toBe(s.commits.length);
    expect(r.state.chat.at(-1)).toMatchObject({ from: 'agent', src: 'working' });
    expect(r.state.chat.at(-1)!.text).toContain(shop(s).name);
    const w = r.state.agentWork!;
    expect(w.at - w.from).toBeGreaterThanOrEqual(Math.round(AGENT_WORK.build.base * (1 - AGENT_WORK.spread)));
  });

  it('lands once the clock reaches it, with the push and the report', async () => {
    const { r } = await startBuild();
    const s = r.state;
    const mins = s.agentWork!.at - s.agentWork!.from;
    advanceClock(s, mins - 1);
    expect(s.agentWork).toBeTruthy();
    advanceClock(s, 1);
    expect(s.agentWork).toBeNull();
    expect(shop(s).repo.some((f) => f.id === 'catalog')).toBe(true);
    expect(shop(s).repoVersion).toBe(1);
    expect(s.commits.at(-1)).toMatchObject({ repo: shop(s).id, kind: 'push' });
    expect(s.chat.at(-1)).toMatchObject({ from: 'agent', src: 'build' });
    expect(s.chat.at(-1)!.text).toMatch(/^Pushed to Forkyard/);
  });

  it('keeps a deploy made in the meantime', async () => {
    const { r } = await startBuild();
    const s = r.state;
    shop(s).deployed = true; shop(s).deployedVersion = 0;
    advanceClock(s, 200);
    expect(shop(s).deployed).toBe(true);
  });

  it('another build while busy gets told to wait, and is not billed', async () => {
    const { r } = await startBuild();
    const before = r.state.values.crypto;
    const again = await promptAgent(r.state, content, catalog, 'build the product catalog for Rosa Shop');
    expect(again.charged).toBe(false);
    expect(again.state.values.crypto).toBe(before);
    expect(again.state.chat.at(-1)!.src).toBe('busy');
    expect(again.state.agentWork).toEqual(r.state.agentWork);
  });

  it('the agent still answers ordinary prompts while it works', async () => {
    const { r } = await startBuild();
    const chat = await promptAgent(r.state, content, fakeRouter({ features: () => [] }), 'what can you help me with?');
    expect(chat.charged).toBe(true);
    expect(chat.state.chat.at(-1)!.src).not.toBe('busy');
    expect(chat.state.agentWork).toBeTruthy();
  });

  it('work still going at bedtime is pushed overnight and reported in the morning', async () => {
    const s = startGame(content, 1);
    s.values.crypto = 100;
    s.clockMin = CLOCK.sleep - 5;
    const r = await promptAgent(s, content, catalog, 'build the product catalog for Rosa Shop');
    expect(r.state.chat.at(-1)!.text).toContain('tomorrow morning');
    const next = endDay(r.state, content);
    expect(next.agentWork).toBeNull();
    expect(shop(next).repoVersion).toBe(1);
    expect(next.chat.some((m) => m.src === 'build' && m.day === next.values.day)).toBe(true);
  });

  it('bigger jobs take longer, up to a cap', () => {
    const s = startGame(content, 1);
    const one = Array.from({ length: 20 }, () => workMinutes(s, 'build', 1));
    const five = Array.from({ length: 20 }, () => workMinutes(s, 'build', 5));
    expect(Math.max(...one)).toBeLessThan(Math.min(...five));
    expect(Math.max(...Array.from({ length: 20 }, () => workMinutes(s, 'build', 50)))).toBeLessThanOrEqual(Math.round(AGENT_WORK.build.max * AGENT_WORK.speed[0] * (1 + AGENT_WORK.spread)));
    expect(Math.max(...Array.from({ length: 20 }, () => workMinutes(s, 'fix', 1)))).toBeLessThan(Math.min(...one));
  });

  it('better agent models build and fix faster', () => {
    const s = startGame(content, 1);
    const at = (level: number, kind: 'build' | 'fix') => {
      s.values.agentLevel = level;
      return Array.from({ length: 20 }, () => workMinutes(s, kind, 3));
    };
    for (const kind of ['build', 'fix'] as const) {
      expect(Math.max(...at(5, kind))).toBeLessThan(Math.min(...at(1, kind)));
      expect(Math.max(...at(5, kind))).toBeLessThanOrEqual(Math.round(Math.min(AGENT_WORK[kind].max, AGENT_WORK[kind].base + AGENT_WORK[kind].each * 3) * 0.4 * (1 + AGENT_WORK.spread)));
    }
  });
});
