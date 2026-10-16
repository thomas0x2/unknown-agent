import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { PULL_MS, pullLines, pullPct } from './pull';
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
