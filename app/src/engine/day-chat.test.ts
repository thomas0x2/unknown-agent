import { describe, it, expect } from 'vitest';
import { startGame, endDay } from '.';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer, GameState } from '.';

describe('agent.chat resets each day', () => {
  it('a new day starts a fresh session that opens with a morning roast', () => {
    const content = loadContent();
    const s = startGame(content);
    s.chat.push({ from: 'you', text: 'Gino sells pasta.', day: 1 });
    const next = endDay(s, content);
    expect(next.values.day).toBe(2);
    expect(next.chat).toHaveLength(1);
    expect(next.chat[0]).toMatchObject({ from: 'agent', day: 2 });
    expect(content.agent!.mornings).toContain(next.chat[0].text);
  });
  it("loading a save drops yesterday's chat", () => {
    const content = loadContent();
    const old = startGame(content);
    old.values.day = 3;
    old.chat.push({ from: 'you', text: 'old', day: 2 }, { from: 'you', text: 'today', day: 3 });
    const mem = { load: () => old as GameState, save: () => {}, clear: () => {} } as SaveStore;
    const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
    expect(store.state.chat.map((m) => m.from + ':' + m.day)).toEqual(['agent:3', 'you:3']);
  });
});
