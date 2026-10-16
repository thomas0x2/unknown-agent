/* A repo shows up on Forkyard only once the agent has pushed to it, not when the job is taken. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { composeEmail, type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { wordJev } from '../engine/_fixtures';
import { devBugPanel, devBugCount } from './appsite';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;

describe('Forkyard repos', () => {
  it('a taken job has no repo until the agent builds it', async () => {
    const content = loadContent();
    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    store.state.values.day = 2;
    store.state = (await composeEmail(store.state, content, wordJev, 'trader@desk.test', 'Hi, I can build your sentiment bot.')).state;
    expect(store.state.apps.map((a) => a.id)).toEqual(['vibe-check']);
    const html = (url: string) => page(store, route(url, store.state));
    expect(html('forkyard.com')).not.toContain('vibe-check');
    expect(html('forkyard.com/vibe-check')).toContain('404');
    // the agent pushes: now it's there
    store.state.apps[0].repoVersion = 1;
    store.state.apps[0].repo = [{ id: 'tickers', correct: true }];
    expect(html('forkyard.com')).toContain('vibe-check');
    expect(html('forkyard.com/vibe-check')).not.toContain('404');
  });

  it('a repo is a file tree: a folder per built feature, nested parts, a file per component', async () => {
    const content = loadContent();
    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    store.state.values.day = 2;
    store.state = (await composeEmail(store.state, content, wordJev, 'trader@desk.test', 'Hi, I can build your sentiment bot.')).state;
    const a = store.state.apps[0];
    a.repoVersion = 1;
    a.repo = [{ id: 'tickers', correct: true }, { id: 'auto_buy', correct: false, variant: 'wrong_ticker' }];
    const html = (url: string) => page(store, route(url, store.state));
    const root = html('forkyard.com/vibe-check');
    expect(root).toContain('data-nav="forkyard.com/vibe-check/auto_buy"');
    expect(root).toContain('data-nav="forkyard.com/vibe-check/tickers"');
    expect(root).not.toContain('data-nav="forkyard.com/vibe-check/portfolio"');
    const order = html('forkyard.com/vibe-check/auto_buy/order');
    expect(order).toContain('data-nav="forkyard.com/vibe-check/auto_buy/order/ticker.ts"');
    expect(order).toContain('data-nav="forkyard.com/vibe-check/auto_buy"');
    const file = html('forkyard.com/vibe-check/auto_buy/order/ticker.ts');
    expect(file).toContain('which ticker the order buys');
    // the tree never says which part is broken
    expect(file).not.toMatch(/wrong_ticker|bug/i);
    expect(html('forkyard.com/vibe-check/nope')).toContain('404');
  });

  it('the dev bug panel lists only pushed features, not ones the client asked for that nobody built', async () => {
    const content = loadContent();
    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    store.state.values.day = 2;
    store.state = (await composeEmail(store.state, content, wordJev, 'trader@desk.test', 'Hi, I can build your sentiment bot.')).state;
    const a = store.state.apps[0];
    // the client has since asked for auto-buy, which the agent hasn't built
    if (!a.required.includes('auto_buy')) a.required.push('auto_buy');
    a.repoVersion = 1;
    a.repo = [{ id: 'tickers', correct: true }];
    const tmpl = content.apps[a.template];
    const panel = devBugPanel(a, tmpl);
    expect(panel).toContain('<b>tickers</b>');
    expect(panel).not.toContain('<b>auto_buy</b>');
    expect(devBugCount(a, tmpl)).toBe(0);
    // once pushed it shows up
    a.repo.push({ id: 'auto_buy', correct: false, variant: 'wrong_ticker' });
    expect(devBugPanel(a, tmpl)).toContain('<b>auto_buy</b>');
    expect(devBugCount(a, tmpl)).toBe(1);
  });
});
