import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { COINS, COIN_SCRIPT, EXCHANGE_FEE, coinHeld, coinRate, exchangeCoins } from './exchange';

describe('Coinbin Exchange', () => {
  it('starts with the MOONCAT bag worth 0.42 DOLR', () => {
    const s = newGame(1);
    expect(coinHeld(s, 'MOONCAT')).toBe(4_200_000);
    expect(coinHeld(s, 'MOONCAT') * coinRate('MOONCAT', 0)).toBeCloseTo(0.42, 6);
  });

  it('scripts a move for every coin on every day', () => {
    for (const moves of Object.values(COIN_SCRIPT)) expect(moves).toHaveLength(21);
    // rates are the same every run and stay positive
    for (const c of COINS.filter((x) => x.id !== 'COPE')) for (let d = 0; d <= 21; d++) expect(coinRate(c.id, d)).toBeGreaterThan(0);
  });

  it('buys a coin with DOLR at today\'s rate, less the fee, and logs it', () => {
    const s0 = newGame(1);
    const { state: s, error } = exchangeCoins(s0, 'DOLR', 'EURI', 50);
    expect(error).toBeUndefined();
    expect(s.values.crypto).toBeCloseTo(s0.values.crypto - 50, 2);
    expect(coinHeld(s, 'EURI')).toBeCloseTo((50 * (1 - EXCHANGE_FEE)) / coinRate('EURI', s.values.day), 1);
    expect(s.tx.at(-1)!.memo).toMatch(/^Coinbin Exchange · 50\.00 DOLR → [\d.]+ EURI$/);
  });

  it('sells back to DOLR and swaps between two coins without touching DOLR', () => {
    let s = exchangeCoins(newGame(1), 'DOLR', 'NONERO', 60).state;
    const dolr = s.values.crypto;
    s = exchangeCoins(s, 'NONERO', 'MOONCAT', coinHeld(s, 'NONERO')).state;
    expect(coinHeld(s, 'NONERO')).toBe(0);
    expect(s.values.crypto).toBe(dolr);
    expect(s.tx.at(-1)!.amount).toBe(0);
    s = exchangeCoins(s, 'MOONCAT', 'DOLR', coinHeld(s, 'MOONCAT')).state;
    expect(coinHeld(s, 'MOONCAT')).toBe(0);
    // two fees on the way round, nothing else lost (day 1 rates)
    expect(s.values.crypto).toBeGreaterThan(dolr + 60 * 0.96);
  });

  it('refuses what the wallet can\'t cover, tiny amounts and same-coin swaps', () => {
    const s = newGame(1);
    expect(exchangeCoins(s, 'EURI', 'DOLR', 5).error).toMatch(/You have 0\.00 EURI/);
    expect(exchangeCoins(s, 'DOLR', 'EURI', 0.5).error).toMatch(/minimum/);
    expect(exchangeCoins(s, 'MOONCAT', 'DOLR', 4_200_000).error).toMatch(/minimum/);
    expect(exchangeCoins(s, 'DOLR', 'DOLR', 5).error).toMatch(/different/);
    expect(exchangeCoins(s, 'DOLR', 'XMR', 5).error).toBeTruthy();
  });
});
