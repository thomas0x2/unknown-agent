import characters from '../../content/characters.json';
import contacts from '../../content/contacts.json';
import type { Character } from '../content/schema';
import { characterMessages, finishReply } from './characters';

const all = characters as Character[];
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

  it('sends the profile and rules, the examples, then what the player wrote', () => {
    const m = characterMessages(mom, 'How do I make money?');
    expect(m[0].content).toMatch(/^You are the player's mother/);
    expect(m[0].content).toMatch(/must not help them/);
    expect(m.length).toBe(1 + mom.examples.length * 2 + 1);
    expect(m.at(-1)).toEqual({ role: 'user', content: 'How do I make money?' });
  });
});

describe('finishReply', () => {
  it('keeps at most the character\'s sentence count', () => {
    expect(finishReply(agent, 'Your wallet just flinched. Anyway, here is a long story about the sea.')).toBe('Your wallet just flinched.');
    expect(finishReply(mom, 'Oh honey. Eat something. Call your father. And wear a coat.')).toBe('Oh honey. Eat something. Call your father.');
  });

  it('cleans chat tokens and markdown', () => {
    expect(finishReply(agent, '**Your wallet** just flinched.<end_of_turn>')).toBe('Your wallet just flinched.');
    expect(finishReply(agent, '   ')).toBeNull();
  });
});
