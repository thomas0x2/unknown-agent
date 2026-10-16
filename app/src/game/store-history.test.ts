import { describe, it, expect } from 'vitest';
import { GameStore, MAX_TABS } from './store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('browser history', () => {
  it('goes back and forward through pages in a tab', () => {
    const s = make();
    expect(s.canBack).toBe(false);
    s.navigate('y.com'); s.navigate('yowl.com');
    expect(s.url).toBe('yowl.com');
    s.back(); expect(s.url).toBe('y.com');
    s.back(); expect(s.url).toBe('qmail.com');
    expect(s.canBack).toBe(false);
    s.forward(); expect(s.url).toBe('y.com');
    expect(s.canForward).toBe(true);
  });
  it('drops forward pages on a new navigation and ignores same-page reloads', () => {
    const s = make();
    s.navigate('y.com'); s.back(); s.navigate('yowl.com');
    expect(s.canForward).toBe(false);
    s.navigate('yowl.com');
    s.back(); expect(s.url).toBe('qmail.com');
  });
  it('keeps each tab its own history', () => {
    const s = make();
    s.navigate('y.com');
    s.switchTab(2);
    expect(s.canBack).toBe(false);
    s.switchTab(1); s.back();
    expect(s.url).toBe('qmail.com');
  });
});

describe('booking form', () => {
  it("a refusal's notice is cleared by the next attempt", () => {
    const s = make();
    s.state.bookingNotice = { appId: 'trattoria-gino', ok: false, text: 'That date is in the past.' };
    s.bookNext('You', 'you@qmail.com', s.state.values.day + 1);
    expect(s.state.bookingNotice).toBeUndefined();
    s.state.bookingNotice = { appId: 'trattoria-gino', ok: false, text: 'That date is in the past.' };
    s.bookBack();
    expect(s.state.bookingNotice).toBeUndefined();
  });
});

describe('a new day', () => {
  it('closes every tab but Qmail and agent and asks to start', () => {
    const s = make();
    s.navigate('y.com'); s.navigate('forkyard.dev', true);
    expect(s.tabs.length).toBe(3);
    s.endDay();
    expect(s.tabs.map((t) => t.url)).toEqual(['qmail.com', 'agent.chat']);
    expect(s.url).toBe('qmail.com');
    expect(s.canBack).toBe(false);
    expect(s.ui.dayStart).toBe(true);
    s.startDay();
    expect(s.ui.dayStart).toBe(false);
  });
});

describe('tab limit', () => {
  it('refuses a 13th tab with a low-memory warning', () => {
    const s = make();
    for (let i = s.tabs.length; i < MAX_TABS; i++) s.navigate('y.com', true);
    expect(s.tabs.length).toBe(MAX_TABS);
    s.navigate('yowl.com', true);
    expect(s.tabs.length).toBe(MAX_TABS);
    expect(s.url).toBe('y.com');
    expect(s.ui.memWarn).toBe(true);
    s.dismissMemWarn();
    expect(s.ui.memWarn).toBe(false);
    s.navigate('yowl.com');
    expect(s.url).toBe('yowl.com');
  });
});
