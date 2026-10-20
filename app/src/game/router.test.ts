import { describe, it, expect } from 'vitest';
import { ROUTER } from './router';
import { JevOffline } from '../engine';

describe('ROUTER', () => {
  it('asks the real Jev for scores as a method, so a query matching several pages reaches the proxy', async () => {
    // no proxy here: the call gets as far as fetching, and says Jev is offline instead of a TypeError
    await expect(ROUTER.matchScores!({ prompt: 'who is Logan?', features: [{ id: 'a', description: 'Logan', kind: 'main' }] })).rejects.toBeInstanceOf(JevOffline);
  });
});
