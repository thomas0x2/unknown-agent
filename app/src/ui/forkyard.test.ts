/* A repo shows up on Forkyard only once the agent has pushed to it, not when the job is taken. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { composeEmail, type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { wordJev } from '../engine/_fixtures';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;

describe('Forkyard repos', () => {
  it('a taken job has no repo until the agent builds it', async () => {
    const content = loadContent();
    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    store.state.values.day = 2;
    store.state = (await composeEmail(store.state, content, wordJev, 'trader@desk.test', 'Hi, I can build your sentiment bot.')).state;
    expect(store.state.apps.map((a) => a.id)).toEqual(['sentiment-crawler']);
    const html = (url: string) => page(store, route(url, store.state));
    expect(html('forkyard.com')).not.toContain('sentiment-crawler');
    expect(html('forkyard.com/sentiment-crawler')).toContain('404');
    // the agent pushes: now it's there
    store.state.apps[0].repoVersion = 1;
    store.state.apps[0].repo = [{ id: 'tickers', correct: true }];
    expect(html('forkyard.com')).toContain('sentiment-crawler');
    expect(html('forkyard.com/sentiment-crawler')).not.toContain('404');
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
    const root = html('forkyard.com/sentiment-crawler');
    expect(root).toContain('data-nav="forkyard.com/sentiment-crawler/auto_buy"');
    expect(root).toContain('data-nav="forkyard.com/sentiment-crawler/tickers"');
    expect(root).not.toContain('data-nav="forkyard.com/sentiment-crawler/portfolio"');
    const order = html('forkyard.com/sentiment-crawler/auto_buy/order');
    expect(order).toContain('data-nav="forkyard.com/sentiment-crawler/auto_buy/order/ticker.ts"');
    expect(order).toContain('data-nav="forkyard.com/sentiment-crawler/auto_buy"');
    const file = html('forkyard.com/sentiment-crawler/auto_buy/order/ticker.ts');
    expect(file).toContain('which ticker the order buys');
    // the tree never says which part is broken
    expect(file).not.toMatch(/wrong_ticker|bug/i);
    expect(html('forkyard.com/sentiment-crawler/nope')).toContain('404');
  });
});
