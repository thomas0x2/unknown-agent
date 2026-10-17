/* DoorDish is bookmarked after the first visit (ads, or the link in Gino's email); Gino's restaurant joins it once the DoorDish listing is deployed. */
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
  it('is bookmarked only after the first visit, like Sherwood', () => {
    const store = new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
    const ids = () => bookmarks(store.state).map((b) => b.id);
    expect(ids()).not.toContain('doordish');
    expect(ids()).not.toContain('sherwood');
    expect(page(store, route('doordish.com', store.state))).toContain('Golden Lotus');
    store.navigate('doordish.com');
    expect(ids()).toContain('doordish');
    expect(ids()).not.toContain('sherwood');
    store.navigate('sherwood.com');
    expect(ids()).toContain('sherwood');
  });

  it("Gino's email links DoorDish", () => {
    const ev = loadContent().events.find((e) => e.id === 'd4_restaurant_doordish')!;
    expect(ev.body).toContain('doordish.com');
  });

  it("deskjockey's job email links Sherwood", () => {
    const ev = loadContent().events.find((e) => e.id === 'trader_contact')!;
    expect(ev.body).toContain('sherwood.com');
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

describe('DoorDish AI-generated listings', () => {
  const at = (day: number, min: number) => {
    const store = new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
    store.state.values.day = day;
    store.state.clockMin = min;
    return (url: string) => page(store, route(url, store.state));
  };

  it('start showing on day 5, with the garage listing gone after DoorDish removes it on day 8', () => {
    expect(at(4, 900)('doordish.com')).not.toContain('Bright Smile Noodles');
    expect(at(4, 900)('doordish.com')).not.toContain('restaurants in your area');
    const d5 = at(5, 600)('doordish.com');
    expect(d5).toContain('Bright Smile Noodles');
    expect(d5).toContain('Alder Garage Kitchen');
    expect(d5).toContain('restaurants in your area');
    expect(at(8, 16 * 60)('doordish.com')).toContain('Alder Garage Kitchen');
    expect(at(8, 16 * 60 + 30)('doordish.com')).not.toContain('Alder Garage Kitchen');
    expect(at(9, 600)('doordish.com/alder-garage-kitchen')).toContain('no longer available');
    expect(at(5, 600)('doordish.com/alder-garage-kitchen')).toContain('Alder St Parking Garage');
  });

  it('get a line in the fine print once CityPulse runs the story', () => {
    expect(at(8, 15 * 60)('doordish.com')).not.toContain('generated automatically');
    expect(at(8, 15 * 60 + 20)('doordish.com')).toContain('generated automatically');
  });
});
