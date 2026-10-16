import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { STOCKS, buyStock, sellStock, quote, sharesOf, costOf } from './stocks';
import { price } from './crawler';

const content = loadContent();
const fresh = () => { const s = startGame(content, 3); s.values.day = 4; return s; };

describe('Sherwood', () => {
  it('quotes four tickers, $GAI and $VANT from the crawler\'s price source', () => {
    expect(STOCKS.map((x) => x.ticker)).toEqual(['GAI', 'VANT', 'DISH', 'HALD']);
    const s = fresh();
    for (const x of STOCKS) expect(quote(s, x.ticker)).toBe(price(x.ticker, 4));
    // the four don't share a price walk
    expect(new Set(STOCKS.map((x) => quote(s, x.ticker))).size).toBe(4);
  });

  it('buys fractional shares with wallet DOLR and sells back into the wallet', () => {
    const s0 = fresh();
    const bal = s0.values.crypto;
    const b = buyStock(s0, 'GAI', 50);
    expect(b.error).toBeUndefined();
    expect(b.state.values.crypto).toBeCloseTo(bal - 50);
    expect(sharesOf(b.state, 'GAI')).toBeCloseTo(50 / price('GAI', 4), 5);
    expect(b.state.tx.at(-1)!.memo).toMatch(/^Sherwood · Bought/);
    expect(costOf(b.state, 'GAI')).toBe(50);
    // the next day the price moved, so selling everything returns a different amount
    b.state.values.day = 5;
    const out = sellStock(b.state, 'GAI', 'all');
    expect(out.error).toBeUndefined();
    expect(sharesOf(out.state, 'GAI')).toBe(0);
    expect(out.state.values.crypto - b.state.values.crypto).toBeCloseTo(Math.round(50 / price('GAI', 4) * price('GAI', 5) * 100) / 100, 2);
  });

  it('refuses orders it cannot fill, without touching the state', () => {
    const s = fresh();
    expect(buyStock(s, 'GAI', s.values.crypto + 1).error).toMatch(/Not enough DOLR/);
    expect(buyStock(s, 'GAI', 0.5).error).toMatch(/minimum/);
    expect(buyStock(s, 'NOPE', 10).error).toBeTruthy();
    expect(sellStock(s, 'VANT', 10).error).toMatch(/don't own/);
    const b = buyStock(s, 'VANT', 20).state;
    expect(sellStock(b, 'VANT', 25).error).toMatch(/worth/);
    const half = sellStock(b, 'VANT', 10);
    expect(half.error).toBeUndefined();
    expect(sharesOf(half.state, 'VANT')).toBeCloseTo(sharesOf(b, 'VANT') / 2, 4);
    expect(costOf(half.state, 'VANT')).toBe(10);
  });
});
