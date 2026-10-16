import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trackLoads, resetLoads, LOAD_MS } from './pageLoad';

const half = () => 0.5;
describe('page loads', () => {
  beforeEach(() => { resetLoads(); vi.useFakeTimers(); });

  it('loads a tab that moves to another site, then calls back when it is ready', () => {
    const done = vi.fn();
    expect(trackLoads([{ id: 1, url: 'qmail.com' }], done, 0, half).size).toBe(0);
    const loading = trackLoads([{ id: 1, url: 'y.com' }], done, 0, half);
    expect([...loading]).toEqual([1]);
    const ms = LOAD_MS.min + (LOAD_MS.max - LOAD_MS.min) / 2;
    expect(trackLoads([{ id: 1, url: 'y.com' }], done, ms - 1, half).has(1)).toBe(true);
    expect(trackLoads([{ id: 1, url: 'y.com' }], done, ms, half).size).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled(); // the last call found nothing loading, so no timer is left
  });

  it('fires the callback once the load time passes', () => {
    const done = vi.fn();
    trackLoads([{ id: 1, url: 'newtab' }], done, Date.now(), half);
    trackLoads([{ id: 1, url: 'qmail.com' }], done, Date.now(), half);
    vi.advanceTimersByTime(LOAD_MS.max);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('keeps tab switches, pages inside a site and new tab pages instant', () => {
    const done = vi.fn();
    trackLoads([{ id: 1, url: 'qmail.com' }, { id: 2, url: 'y.com' }], done, 0, half);
    expect(trackLoads([{ id: 1, url: 'qmail.com' }, { id: 2, url: 'y.com' }], done, 1, half).size).toBe(0);
    expect(trackLoads([{ id: 1, url: 'qmail.com/sent' }, { id: 2, url: 'y.com' }], done, 2, half).size).toBe(0);
    expect(trackLoads([{ id: 1, url: 'newtab' }, { id: 2, url: 'y.com' }], done, 3, half).size).toBe(0);
    expect(trackLoads([{ id: 1, url: 'newtab' }, { id: 2, url: 'y.com' }, { id: 3, url: 'newtab' }], done, 4, half).size).toBe(0);
  });

  it('loads a tab opened straight onto a site, but not the tabs restored at start', () => {
    const done = vi.fn();
    expect(trackLoads([{ id: 1, url: 'qmail.com' }], done, 0, half).size).toBe(0);
    expect([...trackLoads([{ id: 1, url: 'qmail.com' }, { id: 2, url: 'forkyard.com' }], done, 1, half)]).toEqual([2]);
  });
});
