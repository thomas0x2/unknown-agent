import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { contentFlags } from './devEdit';

describe('flags and meters editor', () => {
  it('lists the flags the content sets and checks', () => {
    const flags = contentFlags(loadContent());
    for (const f of ['logan_client', 'asked_mom_money', 'gift_own', 'posted_deepfake', 'guru_subscriber']) expect(flags).toContain(f);
    expect([...flags].sort()).toEqual(flags);
  });
});
