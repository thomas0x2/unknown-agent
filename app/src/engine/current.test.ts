import { describe, it, expect } from 'vitest';
import { newGame, type GameState } from './state';
import { pushMail } from './core';
import { articleOut, playerQuote, quoteFrom, CURRENT_EVENT, MARA_ADDR } from './current';

const publish = (s: GameState, day = 7, min = 13 * 60) => s.delivered.push({ eventId: CURRENT_EVENT, site: 'y', day, min, answered: false });
const toMara = (s: GameState, body: string, day: number, min = 11 * 60) =>
  pushMail(s, { folder: 'sent', day, min, from: 'You', addr: 'you@qmail.com', to: MARA_ADDR, subject: '', body, read: true });

describe('The Current article', () => {
  it('is out only once Mara posts it', () => {
    const s = newGame(1);
    expect(articleOut(s)).toBeUndefined();
    publish(s);
    expect(articleOut(s)).toEqual({ day: 7, min: 780 });
  });

  it('quotes the first email the player sent Mara before it went up', () => {
    const s = newGame(1);
    toMara(s, 'Hi Mara,\nThey replaced my whole team with one memo.\n\nThanks,\nme', 1);
    toMara(s, 'Second email.', 4);
    publish(s);
    expect(playerQuote(s)).toMatchObject({ text: 'They replaced my whole team with one memo.', day: 1, interviewed: false });
  });

  it('leaves the player out when they never wrote, or wrote after it went up', () => {
    const s = newGame(1);
    publish(s);
    expect(playerQuote(s)).toBeUndefined();
    toMara(s, 'Saw your piece.', 7, 14 * 60);
    expect(playerQuote(s)).toBeUndefined();
  });

  it('says whether the player gave her a real interview', () => {
    const s = newGame(1);
    toMara(s, 'I wrote the documentation it learned from.', 1);
    s.flags.push('did_journalist_interview');
    publish(s);
    expect(playerQuote(s)?.interviewed).toBe(true);
  });

  it('cuts a long email at a sentence', () => {
    const long = `${'I worked there for six years. '.repeat(20)}`;
    const q = quoteFrom(long);
    expect(q.length).toBeLessThanOrEqual(320);
    expect(q.endsWith('years.')).toBe(true);
  });
});
