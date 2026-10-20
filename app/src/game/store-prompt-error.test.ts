import { describe, it, expect, vi } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;

describe('a prompt that fails', () => {
  it('stays in the chat with the error under it, unbilled, instead of vanishing', async () => {
    const broken = { route: async () => { throw new TypeError('x is undefined'); }, matchFeatures: async () => { throw new TypeError('x is undefined'); } } as unknown as JevRouter;
    const store = new GameStore(loadContent(), broken, {} as Writer, mem);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wallet = store.state.values.crypto;
    await store.prompt('what do you think about logan?');
    expect(store.state.chat.at(-2)).toMatchObject({ from: 'you', text: 'what do you think about logan?' });
    expect(store.state.chat.at(-1)).toMatchObject({ from: 'system' });
    expect(store.state.chat.at(-1)!.text).toContain('x is undefined');
    expect(store.state.values.crypto).toBe(wallet);
    expect(store.pendingPrompt).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
