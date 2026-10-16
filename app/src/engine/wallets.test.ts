import { describe, it, expect, afterEach } from 'vitest';
import { startGame } from './day';
import { makeContent } from './_fixtures';
import { sendCrypto, isWalletAddress, WALLETS, PLAYER_WALLET } from './wallets';

const content = makeContent();
const OTHER = '0x' + 'ab'.repeat(20);

describe('sendCrypto', () => {
  afterEach(() => { delete WALLETS[OTHER]; });

  it('recognises addresses by shape', () => {
    expect(isWalletAddress(OTHER)).toBe(true);
    expect(isWalletAddress('0x123')).toBe(false);
    expect(isWalletAddress('gino@trattoria.test')).toBe(false);
  });

  it('rejects a malformed address without moving money', () => {
    const s = startGame(content, 1);
    const r = sendCrypto(s, 'not an address', 10);
    expect(r.error).toMatch(/valid wallet address/);
    expect(r.state).toBe(s);
  });

  it('rejects a well-formed address that belongs to no one', () => {
    const r = sendCrypto(startGame(content, 1), OTHER, 10);
    expect(r.error).toMatch(/No wallet exists/);
  });

  it('rejects the player\'s own wallet, bad amounts and overdrafts', () => {
    WALLETS[OTHER] = { name: 'Test' };
    const s = startGame(content, 1);
    expect(sendCrypto(s, PLAYER_WALLET, 5).error).toMatch(/own wallet/);
    expect(sendCrypto(s, OTHER, 0).error).toMatch(/above 0/);
    expect(sendCrypto(s, OTHER, s.values.crypto + 1).error).toMatch(/Insufficient/);
  });

  it('sends to a known wallet and records the transaction', () => {
    WALLETS[OTHER] = { name: 'Test' };
    const s = startGame(content, 1);
    const r = sendCrypto(s, OTHER.toUpperCase().replace('0X', '0x'), 12.5);
    expect(r.error).toBeUndefined();
    expect(r.state.values.crypto).toBeCloseTo(s.values.crypto - 12.5);
    expect(r.state.tx.at(-1)).toMatchObject({ amount: -12.5, memo: 'Test · Sent' });
  });
});

describe('wallet ledger', () => {
  it('starts with a history whose running balance ends on the opening balance', () => {
    const s = startGame(content, 1);
    const seeds = s.tx.filter((x) => x.day <= 0);
    expect(seeds.every((x) => x.bal != null)).toBe(true);
    expect(seeds.at(-1)!.bal).toBeCloseTo(100);
  });

  it('stamps every transaction with the time and the balance it left', () => {
    WALLETS[OTHER] = { name: 'Test' };
    const s = startGame(content, 1);
    const r = sendCrypto(s, OTHER, 30);
    expect(r.state.tx.at(-1)).toMatchObject({ bal: s.values.crypto - 30, min: r.state.clockMin });
    delete WALLETS[OTHER];
  });
});
