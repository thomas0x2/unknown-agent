import { describe, it, expect } from 'vitest';
import { GameStore, type Arrival } from './store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('arrivals over the day', () => {
  it('tells listeners when mail lands and posts go up as the clock moves', () => {
    const s = make();
    const heard: Arrival[] = [];
    s.onArrival((a) => heard.push(a));
    s.passMinutes(80); // 10:00 to 11:20: Mom writes, the restaurant lead goes up on Y
    expect(s.state.delivered.some((d) => d.eventId === 'd1_mom')).toBe(true);
    expect(heard.reduce((n, a) => n + a.mail, 0)).toBeGreaterThanOrEqual(2);
    expect(heard.reduce((n, a) => n + a.posts, 0)).toBeGreaterThanOrEqual(1);
  });
  it('stays quiet on minutes where nothing arrives', () => {
    const s = make();
    s.passMinutes(80);
    const heard: Arrival[] = [];
    s.onArrival((a) => heard.push(a));
    s.passMinutes(1); // 11:21
    expect(heard.every((a) => a.mail + a.posts > 0)).toBe(true);
  });
  it('counts new Y posts for the Y tab badge', () => {
    const s = make();
    const heard: Arrival[] = [];
    s.onArrival((a) => heard.push(a));
    s.passMinutes(80);
    expect(s.ui.yUnread).toBe(heard.reduce((n, a) => n + a.posts, 0));
    expect(s.ui.yUnread).toBeGreaterThanOrEqual(1);
  });
  it('names each bot post once, so they can land as a barrage', () => {
    const s = make();
    s.endDay(); // day 2: a 30-account bot swarm posts about $GAI
    const heard: Arrival[] = [];
    s.onArrival((a) => heard.push(a));
    for (let i = 0; i < 700; i++) s.passMinutes(1);
    const bots = heard.flatMap((a) => a.bots);
    expect(bots.length).toBeGreaterThanOrEqual(30);
    expect(new Set(bots).size).toBe(bots.length);
    expect(heard.every((a) => a.bots.length <= a.posts)).toBe(true);
  });
});
