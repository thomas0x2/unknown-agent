import { describe, it, expect } from 'vitest';
import { replyDelay, withholdCharge } from './store';
import { newGame } from '../engine/state';
import { chargeAgent, money } from '../engine';

describe('replyDelay', () => {
  it('takes longer for longer replies, within bounds', () => {
    const short = replyDelay('No.', () => 0);
    const long = replyDelay('x'.repeat(120), () => 0);
    expect(short).toBeGreaterThanOrEqual(1200);
    expect(long).toBeGreaterThan(short);
    expect(replyDelay('x'.repeat(5000), () => 1)).toBe(4500);
  });
});

describe('withholdCharge', () => {
  it("takes the prompt's charge back out so it can land after the reply", () => {
    const s = newGame(1);
    money(s, 50, 'Dev · grant');
    const before = s.values.crypto, from = s.tx.length;
    expect(chargeAgent(s, 'build me a website please')).toBe(true);
    money(s, 3, 'Someone · tip');
    const charged = before - s.values.crypto + 3;
    const due = withholdCharge(s, from);
    expect(due).toBeCloseTo(charged, 2);
    expect(s.values.crypto).toBeCloseTo(before + 3, 2);
    expect(s.tx.slice(from).map((t) => t.memo)).toEqual(['Someone · tip']);
    expect(s.tx[s.tx.length - 1].bal).toBeCloseTo(before + 3, 2);
  });
  it('returns 0 and changes nothing when nothing was charged', () => {
    const s = newGame(1);
    const tx = s.tx.length, c = s.values.crypto;
    expect(withholdCharge(s, tx)).toBe(0);
    expect(s.values.crypto).toBe(c);
  });
});
