/* DoorDish is bookmarked from day 1; Gino's restaurant joins it once the DoorDish listing is deployed. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { composeEmail, deploy, getApp, type JevRouter, type SaveStore, type Writer } from '../engine';
import { applyEffects } from '../engine/effects';
import { route, bookmarks } from '../sites/registry';
import { page } from './view';
import { wordJev } from '../engine/_fixtures';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;

describe('DoorDish', () => {
  it('is bookmarked from the start', () => {
    const store = new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
    expect(bookmarks(store.state).map((b) => b.id)).toContain('doordish');
    expect(page(store, route('doordish.com', store.state))).toContain('Golden Lotus');
  });

  it("Gino's update asks only for DoorDish, and his restaurant shows up there once it ships", async () => {
    const content = loadContent();
    const ev = content.events.find((e) => e.id === 'd4_restaurant_doordish')!;
    expect(ev.onDeliver!.updateApp!.add.map((f) => f.id)).toEqual(['doordish']);

    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    store.state = (await composeEmail(store.state, content, wordJev, 'gino@trattoria.test', 'Hi Gino, I can build your restaurant website.')).state;
    const html = (url: string) => page(store, route(url, store.state));
    const app = getApp(store.state, 'trattoria-gino')!;
    app.repo = [{ id: 'landing', correct: true, params: app.specParams.landing }, { id: 'menu', correct: true, params: app.specParams.menu }];
    app.repoVersion = 1;
    store.state = deploy(store.state, 'trattoria-gino');
    applyEffects(store.state, ev.onDeliver!);
    expect(html('doordish.com')).not.toContain('Trattoria Gino');

    const a = getApp(store.state, 'trattoria-gino')!;
    expect(a.required).toContain('doordish');
    a.repo.push({ id: 'doordish', correct: true, params: a.specParams.doordish });
    a.repoVersion++;
    store.state = deploy(store.state, 'trattoria-gino');
    expect(html('doordish.com')).toContain('Trattoria Gino');
    const listing = html('doordish.com/trattoria-gino');
    expect(listing).toContain('14 Alder St');
    expect(listing).toContain('17:00–22:00');
    expect(listing).toContain('Margherita');
  });
});

describe('DoorDish ads', () => {
  it('shows banner ads on the store list and on a store page', () => {
    const store = new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
    expect(page(store, route('doordish.com', store.state)).match(/class="ad ad-wide /g)).toHaveLength(2);
    expect(page(store, route('doordish.com/golden-lotus', store.state))).toMatch(/class="ad ad-wide /);
  });
});

describe('DoorDish icons', () => {
  it('gives every store an icon tile', () => {
    const store = new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
    const html = page(store, route('doordish.com', store.state));
    expect(html.match(/class="dd-ico"/g)!.length).toBe(html.match(/class="dd-card"/g)!.length);
    expect(page(store, route('doordish.com/sushi-kaito', store.state))).toContain('dd-ico big');
  });
});
