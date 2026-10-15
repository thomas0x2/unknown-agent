import { memoryStore } from './save';
import { startGame, endDay } from './day';
import { makeContent } from './_fixtures';

describe('save', () => {
  it('round-trips state through the store', () => {
    const content = makeContent();
    let s = startGame(content, 42);
    s = endDay(s, content);
    const store = memoryStore();
    store.save(s);
    const loaded = store.load();
    expect(loaded).toEqual(s);
    expect(loaded).not.toBe(s); // a copy, not the same reference
  });

  it('clears', () => {
    const store = memoryStore();
    store.save(startGame(makeContent(), 1));
    store.clear();
    expect(store.load()).toBeNull();
  });
});
