import { describe, it, expect } from 'vitest';
import { newGame, fillSave, type GameState } from './state';
import { REWIND } from './rewind';

describe('fillSave', () => {
  it('gives fields and meters missing from an old save their starting values, and leaves the rest', () => {
    const s = newGame(7) as unknown as Record<string, unknown>;
    delete s.stakes;
    delete s.interviewAnswers;
    delete (s.values as Record<string, number>).heritageStanding;
    (s.values as Record<string, number>).suspicion = 40;
    s.flags = ['kept'];
    fillSave(s as unknown as GameState);
    expect(s.stakes).toEqual([]);
    expect(s.interviewAnswers).toBe(newGame(7).interviewAnswers);
    expect((s.values as Record<string, number>).heritageStanding).toBe(0);
    expect((s.values as Record<string, number>).suspicion).toBe(40);
    expect(s.flags).toEqual(['kept']);
  });
});

describe('REWIND', () => {
  it('lists every field a new game has', () => {
    expect(Object.keys(newGame(1)).filter((k) => !(k in REWIND))).toEqual([]);
  });
});
