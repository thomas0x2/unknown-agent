import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { sorrySay, sorryReply, sorryChat, sorryScripted, sorryTooLong, SORRY_TOO_LONG } from './sorry';
import { chargeChat, chatCost } from './chatFees';
import { MAX_INPUT_CHARS } from './config';
import { route } from '../sites/registry';

describe('sorrywriter.ai', () => {
  it('is its own site, not a landing page', () => {
    expect(route('sorrywriter.ai', newGame()).site).toBe('sorry');
  });
  it('keeps the conversation and falls back to scripted apologies', () => {
    let s = sorrySay(newGame(), 'I forgot my mum’s birthday');
    s = sorryReply(s, sorryScripted(s, false), 'scripted');
    expect(sorryChat(s).msgs.map((m) => m.from)).toEqual(['you', 'bot']);
    expect(sorryChat(s).msgs[1].text).toMatch(/sorry|apolog/i);
  });
  it('answers over-cap messages with a scripted line', () => {
    expect(sorryTooLong('x'.repeat(MAX_INPUT_CHARS + 1))).toBe(true);
    expect(SORRY_TOO_LONG).toContain(sorryScripted(newGame(), true));
  });
});

describe('paid ad-site chats', () => {
  it('bill per message and per word, and refuse what the wallet can’t cover', () => {
    const s = newGame();
    s.values.crypto = 10;
    expect(chatCost('sorry', 'one two three').total).toBe(2.09);
    expect(chargeChat(s, 'sorry', 'one two three')).toBeUndefined();
    expect(s.values.crypto).toBeCloseTo(7.91);
    expect(chatCost('lonely', 'hi there').total).toBe(1.04);
    s.values.crypto = 0.5;
    expect(chargeChat(s, 'lonely', 'hi')).toMatch(/costs 1\.02 DOLR/);
    expect(s.values.crypto).toBe(0.5);
  });
});
