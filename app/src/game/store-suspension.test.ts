import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { AGENT_POLICY, clone, suspendAccount, type JevRouter, type SaveStore, type Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('suspended for misuse', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('switches to the suspension email in Qmail a moment later, and the knock ends the run', () => {
    vi.useFakeTimers();
    const store = make();
    store.navigate('agent.chat');
    const s = clone(store.state);
    s.values.day = 7;
    suspendAccount(s);
    (store as unknown as { commitAndSettle(s: unknown): void }).commitAndSettle(s);
    expect(store.url).toBe('agent.chat');
    vi.advanceTimersByTime(AGENT_POLICY.mailAfterMs);
    expect(store.url).toBe(`qmail.com/${s.suspended!.mailId}`);
    store.passMinutes(AGENT_POLICY.knockAfter - 1);
    expect(store.state.ending).toBeNull();
    store.passMinutes(1);
    expect(store.state.ending).toBe('caught');
  });
});
