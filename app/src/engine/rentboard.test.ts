import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { fileRentAppeal, rentAppeals, APPEAL_FEE } from './rentboard';
import { advanceClock, deliverPendingMail } from './core';

describe('rentboard.gov appeals', () => {
  it('charges 5 DOLR and emails that nothing could be done', () => {
    const s0 = newGame();
    s0.values.crypto = 20;
    const { state: s, error } = fileRentAppeal(s0);
    expect(error).toBeUndefined();
    expect(s.values.crypto).toBe(20 - APPEAL_FEE);
    expect(rentAppeals(s)).toBe(1);
    advanceClock(s, 10);
    deliverPendingMail(s);
    const mail = s.mail.find((m) => m.addr === 'appeals@rentboard.gov');
    expect(mail?.body).toContain('Nothing could be done');
  });
  it('can be filed again, and refuses without the fee', () => {
    const s0 = newGame();
    s0.values.crypto = 7;
    const s1 = fileRentAppeal(s0).state;
    const r = fileRentAppeal(s1);
    expect(r.error).toMatch(/5 DOLR/);
    expect(r.state).toBe(s1);
    s1.values.crypto = 10;
    expect(rentAppeals(fileRentAppeal(s1).state)).toBe(2);
  });
});
