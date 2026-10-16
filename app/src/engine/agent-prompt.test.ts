/*
 * The agent is always free-text promptable (with costs), gig or no gig. A chat prompt takes no game
 * time; builds and fixes run in the background (agent-work.test.ts).
 */
import { startGame } from './day';

import { promptCost } from './agent';
import { makeContent, fakeRouter, promptDone } from './_fixtures';
import { CLOCK } from './config';

const content = makeContent();

describe('promptAgent — always free text', () => {
  it('answers a chat prompt with no apps and charges for it', async () => {
    const s = startGame(content, 1);
    s.apps = []; // no gig taken
    s.values.crypto = 100;
    const r = await promptDone(s, content, fakeRouter({}), 'what can you help me with?');
    expect(r.charged).toBe(true);
    expect(r.state.values.crypto).toBeCloseTo(100 - promptCost(1, 'what can you help me with?').total, 2);
    expect(r.state.chat.at(-1)!.from).toBe('agent');
    expect(r.state.clockMin).toBe(CLOCK.wake); // the clock runs in real time, not per prompt
  });

  it('routes a build-shaped prompt to the matching app when a gig exists', async () => {
    const s = startGame(content, 1);
    const app = s.apps.find((a) => a.clientEventId === 'client_shop')!;
    s.values.crypto = 100;
    const r = await promptDone(s, content, fakeRouter({ features: (_p, ids) => ids.filter((i) => i.endsWith('::catalog::feature')) }), 'build the product catalog for Rosa Shop');
    const built = r.state.apps.find((a) => a.id === app.id)!;
    expect(built.repo.some((f) => f.id === 'catalog')).toBe(true);
    expect(r.state.chat.at(-1)!.src).toBe('build');
  });
});

describe('promptCost', () => {
  it('is the per-prompt fee plus the per-word fee on the prompt, known before sending', () => {
    expect(promptCost(1, 'what can you help me with?')).toEqual({ base: 0.5, perWord: 0.01, words: 6, wordFee: 0.06, total: 0.56 });
    expect(promptCost(3, '  ')).toMatchObject({ words: 0, wordFee: 0, total: 2 });
  });
});

describe('the clock', () => {
  it('starts at 10:00', async () => {
    const s = startGame(content, 1);
    expect(s.clockMin).toBe(CLOCK.wake);
  });
});
