import { describe, it, expect } from 'vitest';
import { replyDelay } from './store';

describe('replyDelay', () => {
  it('takes longer for longer replies, within bounds', () => {
    const short = replyDelay('No.', () => 0);
    const long = replyDelay('x'.repeat(120), () => 0);
    expect(short).toBeGreaterThanOrEqual(1200);
    expect(long).toBeGreaterThan(short);
    expect(replyDelay('x'.repeat(5000), () => 1)).toBe(4500);
  });
});
