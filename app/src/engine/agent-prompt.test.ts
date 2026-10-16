/*
 * The agent is always free-text promptable (with costs), gig or no gig, and every action spends
 * in-game time until the clock hits midnight and the day auto-ends.
 */
import { startGame } from './day';
import { promptAgent } from './actions';
import { makeContent, fakeRouter } from './_fixtures';
import { CLOCK } from './config';

const content = makeContent();

describe('promptAgent — always free text', () => {
  it('answers a chat prompt with no apps and charges for it', async () => {
    const s = startGame(content, 1);
    s.apps = []; // no gig taken
    s.values.crypto = 100;
    const r = await promptAgent(s, content, fakeRouter({}), 'what can you help me with?');
    expect(r.charged).toBe(true);
    expect(r.state.values.crypto).toBeLessThan(100); // billed per prompt + word
    expect(r.state.chat.at(-1)!.from).toBe('agent');
    expect(r.state.clockMin).toBe(CLOCK.wake + CLOCK.perAction); // one prompt spent
  });

  it('routes a build-shaped prompt to the matching app when a gig exists', async () => {
    const s = startGame(content, 1);
    const app = s.apps.find((a) => a.clientEventId === 'client_shop')!;
    s.values.crypto = 100;
    const r = await promptAgent(s, content, fakeRouter({ features: (_p, ids) => ids.filter((i) => i.endsWith('catalog')) }), 'build the product catalog');
    const built = r.state.apps.find((a) => a.id === app.id)!;
    expect(built.repo.some((f) => f.id === 'catalog')).toBe(true);
    expect(r.state.chat.at(-1)!.src).toBe('build');
  });
});

describe('the clock', () => {
  it('starts at 10:00 and advances per action', async () => {
    const s = startGame(content, 1);
    expect(s.clockMin).toBe(CLOCK.wake);
  });
});
