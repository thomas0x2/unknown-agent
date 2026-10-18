import { describe, expect, it } from 'vitest';
import { newGame } from './state';
import { addFlag } from './core';
import { COPE, copeRate, createToken, countdownView, siteAddress, siteAllocation } from './cope';
import { coinHeld, exchangeCoins, coinsListed } from './exchange';
import { applyEffects } from './effects';

const onDay = (day: number) => { const s = newGame(1); s.values.day = day; return s; };
const asked = (day = COPE.launchDay) => { const s = onDay(day); addFlag(s, 'dex_contract_ask'); return s; };

describe('$COPE', () => {
  it('trades from day 7, climbs on paper and is worth nothing after the rug', () => {
    expect(copeRate(COPE.launchDay)).toBe(0);
    expect(COPE.allocation * copeRate(COPE.listDay)).toBeCloseTo(100, 6);
    const top = COPE.allocation * copeRate(COPE.rugDay - 1);
    expect(top).toBeGreaterThan(10_000);
    // after the rug the allocation is under the exchange minimum, even once it unlocks
    expect(COPE.allocation * copeRate(COPE.unlockDay)).toBeLessThan(1);
  });

  it('is created only after Dex asks, as he reserved it, for the listing fee', () => {
    expect(createToken(onDay(6), 'COPE', COPE.supply).error).toMatch(/reserved/);
    const s0 = asked();
    expect(createToken(s0, 'HOPE', COPE.supply).error).toMatch(/\$HOPE/);
    expect(createToken(s0, 'COPE', 1_000_000).error).toMatch(/supply/);
    const { state: s, error } = createToken(s0, '$cope', COPE.supply);
    expect(error).toBeUndefined();
    expect(s.values.crypto).toBeCloseTo(s0.values.crypto - COPE.fee, 2);
    expect(coinHeld(s, 'COPE')).toBe(COPE.allocation);
    expect(s.flags).toEqual(expect.arrayContaining(['cope_created', 'cope_deployer']));
    expect(createToken(s, 'COPE', COPE.supply).error).toBeTruthy();
  });

  it("locks the creator's COPE: it can't be sold, before the listing or after", () => {
    let s = createToken(asked(), 'COPE', COPE.supply).state;
    expect(exchangeCoins(s, 'COPE', 'DOLR', 1000).error).toMatch(/trading yet/);
    s.values.day = 15;
    expect(exchangeCoins(s, 'COPE', 'DOLR', COPE.allocation).error).toMatch(/locked until Oct 30/);
    // buying is fine; what is bought is locked with the rest
    s = exchangeCoins(s, 'DOLR', 'COPE', 10).state;
    expect(coinHeld(s, 'COPE')).toBeGreaterThan(COPE.allocation);
    s.values.day = COPE.unlockDay;
    expect(exchangeCoins(s, 'COPE', 'DOLR', coinHeld(s, 'COPE')).error).toMatch(/minimum/);
  });

  it('shows on Coinbin once it trades or the wallet holds some', () => {
    expect(coinsListed(onDay(3)).map((c) => c.id)).not.toContain('COPE');
    expect(coinsListed(onDay(7)).map((c) => c.id)).toContain('COPE');
  });

  it('pays shill posts in COPE through effects', () => {
    const s = onDay(10);
    applyEffects(s, { coins: { from: 'Dex Calloway', add: { COPE: 2_000_000 } } });
    expect(coinHeld(s, 'COPE')).toBe(2_000_000);
    expect(s.tx.at(-1)!.memo).toBe('Dex Calloway · 2,000,000 COPE');
  });
});

describe("Dex's coin site", () => {
  it('counts down to noon on day 6, then says the coin is live', () => {
    const none = new Set<string>();
    expect(countdownView(none, 3, 12 * 60).text).toBe('3d 00h 00m');
    expect(countdownView(none, 6, 13 * 60)).toMatchObject({ text: '$COPE is live', live: true });
    expect(countdownView(new Set(['negative']), 6, 13 * 60).text).toBe('−0d 01h 00m');
    expect(countdownView(new Set(['wrong_target']), 3, 12 * 60).text).toBe('4d 00h 00m');
    expect(countdownView(new Set(['frozen']), 4, 15 * 60, { day: 3, min: 12 * 60 }).text).toBe('3d 00h 00m');
  });

  it('gets the address and allocation wrong in ways the player can check', () => {
    const wrong = siteAddress(COPE.address, new Set(['address_wrong']), 7);
    expect(wrong).not.toBe(COPE.address);
    expect(wrong).toHaveLength(COPE.address.length);
    const shares = 'Liquidity 40%, Congregation 30%, Treasury 15%, Marketing 10%, Founding engineer 5%';
    const sum = (b: string[]) => siteAllocation(shares, new Set(b)).reduce((a, r) => a + r.pct, 0);
    expect(sum([])).toBe(100);
    expect(sum(['sum_over'])).toBeGreaterThan(100);
    expect(siteAllocation(shares, new Set(['shares_wrong']))[0].pct).toBe(30);
  });
});
