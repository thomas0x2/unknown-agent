import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { PULL_MS, pullLines, pullPct } from './pull';
import { bookmarks } from '../sites/registry';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

afterEach(() => { vi.useRealTimers(); });

describe('weightroom pull', () => {
  it('climbs to 99%, stalls there, then finishes', () => {
    expect(pullPct(0)).toBe(0);
    const mid = pullPct(3000);
    expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(99);
    expect(pullPct(5500)).toBe(99);
    expect(pullPct(PULL_MS)).toBe(100);
    const done = pullLines('deepsleep', PULL_MS).map((l) => l.text);
    expect(done[0]).toBe('$ weightroom pull deepsleep-0.5B');
    expect(done).toContain('success');
  });
});

describe('the Terminal app', () => {
  it('opens as its own window during a download, not a browser tab', () => {
    vi.useFakeTimers();
    const s = make();
    const tabs = s.tabs.length;
    s.download('deepsleep');
    expect(s.ui.termShown).toBe(true);
    expect(s.pull?.id).toBe('deepsleep');
    expect(s.state.localModels).not.toContain('deepsleep');
    vi.advanceTimersByTime(PULL_MS + 200);
    expect(s.pull).toBeNull();
    expect(s.state.localModels).toContain('deepsleep');
    expect(s.state.flags).toContain('has_terminal');
    expect(s.state.terminal.some((l) => l.text === 'success')).toBe(true);
    expect(s.tabs.length).toBe(tabs);
    expect(s.url).not.toBe('localhost');
  });
  it('minimizes from the taskbar, and localhost brings it back', () => {
    vi.useFakeTimers();
    const s = make();
    s.download('deepsleep'); vi.advanceTimersByTime(PULL_MS + 200);
    s.termTask(); expect(s.ui.termShown).toBe(false); expect(s.ui.termOpen).toBe(true);
    s.closeTerm(); expect(s.ui.termOpen).toBe(false);
    s.navigate('localhost');
    expect(s.ui.termShown).toBe(true);
    expect(s.url).toBe('qmail.com');
  });
});

describe('Weightroom bookmark', () => {
  it('appears only after the first visit, not when dev_null mentions it', () => {
    const s = make();
    s.state.flags.push('knows_weightroom');
    expect(bookmarks(s.state).map((b) => b.id)).not.toContain('weightroom');
    s.navigate('weightroom.ai');
    expect(bookmarks(s.state).map((b) => b.id)).toContain('weightroom');
  });
  it('is not added by visiting before the site is known', () => {
    const s = make();
    s.navigate('weightroom.ai');
    s.state.flags.push('knows_weightroom');
    expect(bookmarks(s.state).map((b) => b.id)).not.toContain('weightroom');
  });
});

describe('the Terminal from day 1', () => {
  it('opens on a fresh game, with no model and no Weightroom', async () => {
    const s = make();
    expect(s.termTabs()).toEqual(['shell']);
    s.navigate('localhost');
    expect(s.ui.termShown).toBe(true);
    await s.term('ls -la');
    expect(s.state.terminal.map((l) => l.text)).toEqual(['$ ls -la', 'ls: nothing to work with here yet']);
    await s.term('make coffee');
    expect(s.state.terminal.at(-1)?.text).toBe('make: command not found. Type help for a list of commands.');
    await s.term('rm notes.txt');
    expect(s.state.terminal.at(-1)).toEqual({ k: 'err', text: 'rm: permission denied on this machine' });
    await s.term('cp a b');
    expect(s.state.terminal.at(-1)).toEqual({ k: 'err', text: 'cp: permission denied on this machine' });
    expect(s.state.termPrompts ?? 0).toBe(0);
  });
});

describe('help', () => {
  it('lists the shell commands, with or without a model', async () => {
    vi.useFakeTimers();
    const s = make();
    const p = s.term('help'); await vi.runAllTimersAsync(); await p;
    const text = s.state.terminal.map((l) => l.text).join('\n');
    for (const c of ['cd', 'ls', 'grep', 'cp', 'rm', 'cat', 'host', 'ssh']) expect(text).toMatch(new RegExp(`^  ${c} `, 'm'));
    s.download('deepsleep'); vi.advanceTimersByTime(PULL_MS + 200);
    const n = s.state.terminal.length;
    const q = s.term('help'); await vi.runAllTimersAsync(); await q;
    expect(s.state.terminal.slice(n).some((l) => l.k === 'model')).toBe(false);
    expect(s.state.terminal[n].text).toBe('$ help');
  });
});
