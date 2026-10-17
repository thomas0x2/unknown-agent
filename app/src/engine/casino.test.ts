import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { sendCrypto } from './wallets';
import { CASINO_WALLET, casinoOf, recordDeposit, spinSlot, applyCasinoCode, withdrawCasino, withdrawable, payout, slotRtp, BETS } from './casino';
import { route } from '../sites/registry';

/** A Coinbin send to Stack, as the store does it. */
function deposit(s0: ReturnType<typeof newGame>, amount: number) {
  const r = sendCrypto(s0, CASINO_WALLET, amount);
  expect(r.error).toBeUndefined();
  recordDeposit(r.state, CASINO_WALLET, amount);
  return r.state;
}

describe('stack.com', () => {
  it('is always reachable', () => {
    expect(route('stack.com', newGame())).toMatchObject({ site: 'stack', reachable: true });
  });

  it('keeps a house edge of 10 to 15%', () => {
    expect(slotRtp()).toBeGreaterThan(0.85);
    expect(slotRtp()).toBeLessThan(0.9);
  });

  it('pays three of a kind and cherries from the left', () => {
    expect(payout(['seven', 'seven', 'seven'])).toBe(200);
    expect(payout(['cherry', 'cherry', 'bar'])).toBe(5);
    expect(payout(['cherry', 'bar', 'cherry'])).toBe(2);
    expect(payout(['bar', 'cherry', 'cherry'])).toBe(0);
  });

  it('credits a Coinbin send to the deposit address, and nothing else', () => {
    let s = newGame(1);
    s.values.crypto = 100;
    s = deposit(s, 30);
    expect(s.values.crypto).toBe(70);
    expect(casinoOf(s).balance).toBe(30);
    recordDeposit(s, '0x5e17a0c94b2d83f6e1a7c05b9d42e38f6a1c0d7b', 10);
    expect(casinoOf(s).balance).toBe(30);
  });

  it('spins only with balance, and moves the balance by the win minus the bet', () => {
    let s = newGame(2);
    expect(spinSlot(s, 1).error).toBe('Deposit DOLR to play.');
    s.values.crypto = 100;
    s = deposit(s, 50);
    for (let i = 0; i < 40; i++) {
      const before = casinoOf(s).balance;
      const r = spinSlot(s, 1);
      expect(r.error).toBeUndefined();
      s = r.state;
      const last = casinoOf(s).spins.at(-1)!;
      expect(last.win).toBe(payout(last.reels));
      expect(casinoOf(s).balance).toBeCloseTo(before - 1 + last.win, 2);
    }
    expect(casinoOf(s).spins.length).toBeLessThanOrEqual(12);
    expect(spinSlot(s, 3).error).toBe('Pick a bet.');
  });

  it('loses money over many spins', () => {
    let s = newGame(3);
    s.values.crypto = 100_000;
    s = deposit(s, 100_000);
    for (let i = 0; i < 4000; i++) s = spinSlot(s, BETS[0]).state;
    expect(casinoOf(s).won / casinoOf(s).bet).toBeLessThan(1);
  });

  it('matches the first deposit with a code and locks the match until it has been wagered', () => {
    let s = newGame(4);
    s.values.crypto = 200;
    expect(applyCasinoCode(s, 'nope').error).toBe('That code doesn\'t exist.');
    s = applyCasinoCode(s, 'stryker').state;
    s = deposit(s, 80);
    const c = casinoOf(s);
    expect(c.balance).toBe(130);
    expect(c.bonus).toBe(50);
    expect(c.wagerLeft).toBe(2000);
    expect(withdrawable(c)).toBe(80);
    expect(applyCasinoCode(s, 'STRYKER').error).toMatch(/before your first deposit/);
    // withdrawing forfeits the match
    const r = withdrawCasino(s, 30);
    expect(r.error).toBeUndefined();
    expect(r.state.values.crypto).toBe(150);
    expect(casinoOf(r.state)).toMatchObject({ balance: 50, bonus: 0, wagerLeft: 0, withdrawn: 30 });
  });

  it('refuses withdrawals under the minimum or over the balance', () => {
    let s = newGame(5);
    s.values.crypto = 100;
    s = deposit(s, 25);
    expect(withdrawCasino(s, 10).error).toMatch(/minimum/);
    expect(withdrawCasino(s, 40).error).toMatch(/balance is 25.00/);
    const r = withdrawCasino(s, 25);
    expect(r.state.tx.at(-1)).toMatchObject({ amount: 25, memo: 'Stack · Withdrawal' });
  });
});
