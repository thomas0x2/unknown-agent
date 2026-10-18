import { describe, it, expect } from 'vitest';
import { GameStore, MAX_TABS } from './store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('browser history', () => {
  it('goes back and forward through pages in a tab', () => {
    const s = make();
    s.navigate('qdrive.com', true);
    expect(s.canBack).toBe(false);
    s.navigate('yowl.com'); s.navigate('weightroom.ai');
    expect(s.url).toBe('weightroom.ai');
    s.back(); expect(s.url).toBe('yowl.com');
    s.back(); expect(s.url).toBe('qdrive.com');
    expect(s.canBack).toBe(false);
    s.forward(); expect(s.url).toBe('yowl.com');
    expect(s.canForward).toBe(true);
  });
  it('drops forward pages on a new navigation and ignores same-page reloads', () => {
    const s = make();
    s.navigate('qdrive.com', true);
    s.navigate('weightroom.ai'); s.back(); s.navigate('yowl.com');
    expect(s.canForward).toBe(false);
    s.navigate('yowl.com');
    s.back(); expect(s.url).toBe('qdrive.com');
  });
  it('keeps each tab its own history', () => {
    const s = make();
    s.navigate('qmail.com/compose');
    s.switchTab(3);
    expect(s.canBack).toBe(false);
    s.switchTab(2); s.back();
    expect(s.url).toBe('qmail.com');
  });
});

describe('pinned tabs', () => {
  it('opens on Qmail with Coinbin, Qmail, Y, agent and Forkyard, which can\'t be closed', () => {
    const s = make();
    expect(s.url).toBe('qmail.com');
    expect(s.tabs.map((t) => t.url)).toEqual(['coinbin.com', 'qmail.com', 'y.com', 'agent.chat', 'forkyard.com']);
    s.closeTab(2);
    expect(s.tabs).toHaveLength(5);
  });
  it('keeps a pinned tab on its site: another pinned site switches tabs, anything else opens a new one', () => {
    const s = make();
    s.navigate('y.com/obanks');
    expect(s.active).toBe(3);
    expect(s.tabs[1].url).toBe('qmail.com');
    expect(s.url).toBe('y.com/obanks');
    s.navigate('yowl.com');
    expect(s.tabs).toHaveLength(6);
    expect(s.url).toBe('yowl.com');
    expect(s.tabs[2].url).toBe('y.com/obanks');
    s.closeTab(s.active);
    expect(s.tabs).toHaveLength(5);
  });
});

describe('a new day', () => {
  it('closes every tab but the pinned ones, back on their home pages', () => {
    const s = make();
    s.navigate('y.com/obanks'); s.navigate('forkyard.dev', true);
    expect(s.tabs.length).toBe(6);
    s.endDay();
    expect(s.tabs.map((t) => t.url)).toEqual(['coinbin.com', 'qmail.com', 'y.com', 'agent.chat', 'forkyard.com']);
    expect(s.url).toBe('qmail.com');
    expect(s.canBack).toBe(false);
    expect(s.state.morning).not.toBeNull();
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

describe('new game', () => {
  it('opens with the OS greeting', () => {
    const s = make();
    expect(s.ui.greet).toBe(true);
    s.dismissGreet();
    s.newGame();
    expect(s.ui.greet).toBe(true);
  });
});
