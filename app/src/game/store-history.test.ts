import { describe, it, expect } from 'vitest';
import { GameStore } from './store';
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
