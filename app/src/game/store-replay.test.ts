import { describe, it, expect } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { gameMinutes, registerApp, scriptedWriter, type JevRouter, type SaveStore } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
// Jev reads the Y post only once the test lets it, like a slow answer
let answer: () => void = () => {};
const slowJev = {
  async route() { return { kind: 'nothing' }; },
  async matchFeatures() { return []; },
  async ratePost() { await new Promise<void>((r) => { answer = r; }); return { category: 'tip', quality: 0.5 }; },
} as unknown as JevRouter;
const make = () => new GameStore(loadContent(), slowJev, scriptedWriter, mem);

describe('actions taken while another waits on its answer', () => {
  it('a deploy during a pending reply is still live once the reply lands', async () => {
    const store = make();
    const s = store.state;
    const id = registerApp(s, { template: 'startup', kind: 'client', name: 'Test Startup', spec: [{ id: 'landing' }] });
    const app = s.apps.find((a) => a.id === id)!;
    // the agent's fix has landed in the repo; the live site still runs the old, buggy build
    app.repo = [{ id: 'landing', correct: true }];
    app.features = [{ id: 'landing', correct: false, variant: 'wrong_hours' }];
    app.repoVersion = 2; app.deployedVersion = 1; app.deployed = true;
    // a Y post is waiting on Jev when Redeploy is pressed
    const pending = store.post('my bistro is open', []);
    store.deploy(id);
    expect(store.state.apps.find((a) => a.id === id)!.deployedVersion).toBe(2);
    await new Promise((r) => setTimeout(r, 0));
    answer();
    await pending;
    const live = store.state.apps.find((a) => a.id === id)!;
    expect(store.state.userPosts.some((p) => p.text === 'my bistro is open')).toBe(true);
    expect(live.deployedVersion).toBe(2);
    expect(live.features.every((f) => f.correct)).toBe(true);
    expect(store.state.commits.filter((c) => c.kind === 'deploy')).toHaveLength(1);
  });

  it("a build that's due lands while a post waits on Jev, and its report keeps its place", async () => {
    const store = make();
    const s = store.state;
    const id = registerApp(s, { template: 'startup', kind: 'client', name: 'Test Startup', spec: [{ id: 'landing' }] });
    s.chat.push({ from: 'agent', text: 'Working on Test Startup.', day: s.values.day, src: 'working' });
    s.agentWork = { from: gameMinutes(s), at: gameMinutes(s) + 2, kind: 'build', appIds: [id], appNames: ['Test Startup'],
      apps: [{ id, repo: [{ id: 'landing', correct: true }], bumps: 1 }], commits: [{ repo: id, msg: 'Initial commit', kind: 'push' }],
      reply: { from: 'agent', text: 'Pushed to Forkyard for Test Startup.', src: 'build' } };
    const pending = store.post('my bistro is open', []);
    // its time comes while Jev is still reading the post: it lands now, not when the answer does
    store.passMinutes(3);
    expect(store.state.agentWork).toBeNull();
    expect(store.state.chat.at(-1)?.text).toBe('Pushed to Forkyard for Test Startup.');
    await new Promise((r) => setTimeout(r, 0));
    answer();
    await pending;
    const after = store.state;
    expect(after.agentWork).toBeNull();
    expect(after.apps.find((a) => a.id === id)!.repoVersion).toBe(1);
    expect(after.commits.filter((c) => c.repo === id)).toHaveLength(1);
    expect(after.chat.filter((m) => m.src === 'build')).toHaveLength(1);
  });
});
