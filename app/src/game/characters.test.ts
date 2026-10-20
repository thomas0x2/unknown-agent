import { loadContent } from '../content/load';
import { finishReply } from './characters';

const { characters: all = [], contacts } = loadContent();
const agent = all.find((c) => c.id === 'agent')!;
const mom = all.find((c) => c.id === 'mom')!;

describe('character library', () => {
  it('every contact points at a character', () => {
    for (const c of contacts) expect(all.some((ch) => ch.id === c.character), c.key).toBe(true);
  });

  it('every character has a profile and same-shape examples that fit its sentence limit', () => {
    for (const ch of all) {
      expect(ch.profile).toMatch(/^You are/);
      expect(ch.examples.length).toBeGreaterThanOrEqual(3);
      for (const [, a] of ch.examples) expect(finishReply(ch, a), `${ch.id}: ${a}`).toBe(a);
    }
  });
});

describe('finishReply', () => {
  it('keeps at most the character\'s sentence count', () => {
    expect(finishReply(agent, 'Your wallet just flinched. It does that. Anyway, here is a long story about the sea.')).toBe('Your wallet just flinched. It does that.');
    expect(finishReply(mom, 'Oh honey. Eat something. Call your father. And wear a coat.')).toBe('Oh honey. Eat something. Call your father.');
  });

  it('cleans chat tokens and markdown', () => {
    expect(finishReply(agent, '**Your wallet** just flinched.<end_of_turn>')).toBe('Your wallet just flinched.');
    expect(finishReply(agent, '   ')).toBeNull();
  });
});
