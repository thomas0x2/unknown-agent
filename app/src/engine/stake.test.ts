/*
 * The trader's stake (day 7): every send to his wallet is staked, pays out exactly 4 days later at
 * 12:00 at the book's real value then, and shows on the vibe check moving with the portfolio shown.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { registerApp, getApp } from './apps';
import { sendCrypto } from './wallets';
import { recordStake, payStakes, bookValue, stakeWorth, TRADER_WALLET, STAKE } from './stake';
import { marketPosts, cranePosts } from './crawler';
import { renderAppSite } from '../ui/appsite';
import type { GameState } from './state';

const content = loadContent();
const tmpl = content.apps.sentiment;
const email = content.events.find((e) => e.id === 'd7_trader_buyin')!;

function onDay(day: number, min = 12 * 60): GameState {
  const s = startGame(content, 7);
  s.values.day = day;
  s.clockMin = min;
  s.values.crypto = 500;
  for (const l of content.yMarket!.events) {
    const e = content.events.find((x) => x.id === l.event)!;
    if (e.trigger.dayMin == null) continue; // timed by the auto-buy going live (Crane's $APO post)
    s.delivered.push({ eventId: e.id, site: e.site, day: e.trigger.dayMin! } as GameState['delivered'][number]);
  }
  return s;
}
function send(s: GameState, amount: number): GameState {
  const r = sendCrypto(s, TRADER_WALLET, amount);
  expect(r.error).toBeUndefined();
  recordStake(r.state, TRADER_WALLET, amount);
  return r.state;
}
const at = (s: GameState, day: number, min: number) => { s.values.day = day; s.clockMin = min; return payStakes(s, content); };

describe("the trader's stake", () => {
  it('his email gives his wallet and spells out the deal', () => {
    expect(email.body).toContain(TRADER_WALLET);
    expect(email.body).toMatch(/any amount/i);
    expect(email.body).toMatch(/4 days later, 12:00/);
    expect(email.outcomes!.some((o) => o.effects?.add?.crypto)).toBe(false);
  });

  it('every send is staked, sends add up, each pays out exactly 4 days later at 12:00', () => {
    let s = send(onDay(7, 13 * 60), 50);
    s.values.day = 8;
    s = send(s, 30);
    expect(s.stakes.map((x) => [x.day, x.amount])).toEqual([[7, 50], [8, 30]]);
    expect(s.values.crypto).toBeCloseTo(420);
    expect(at(s, 10, 13 * 60)).toBe(false);
    expect(at(s, 11, STAKE.payAt - 1)).toBe(false);
    const first = 50 * (bookValue(s, content, 11) / bookValue(s, content, 7));
    expect(at(s, 11, STAKE.payAt)).toBe(true);
    expect(s.values.crypto).toBeCloseTo(420 + first, 1);
    expect(s.stakes[0].paid).toBeCloseTo(first, 1);
    expect(s.stakes[1].paid).toBeUndefined();
    expect(s.tx.at(-1)!.memo).toBe('deskjockey · Stake payout');
    // paid once
    expect(at(s, 11, 20 * 60)).toBe(false);
    expect(at(s, 12, STAKE.payAt)).toBe(true);
    expect(s.stakes[1].paid).toBeCloseTo(30 * (bookValue(s, content, 12) / bookValue(s, content, 8)), 1);
  });

  it('pays what the stake is worth then: the book moves with the scripted market, up or down', () => {
    const s = onDay(21, 21 * 60);
    const moves = [7, 9, 14, 15].map((d) => bookValue(s, content, d + 4) / bookValue(s, content, d) - 1);
    // never flat, and not always up: the $GAI and $VANT slide on day 16 costs sends from days 14 and 15
    for (const m of moves) expect(Math.abs(m)).toBeGreaterThan(0.0005);
    expect(new Set(moves.map(Math.sign)).size).toBe(2);
  });

  it('a payout missed while the game skipped ahead lands at its own payout day value', () => {
    const s = send(onDay(7), 100);
    at(s, 13, 10 * 60);
    const due = 100 * (bookValue(s, content, 11) / bookValue(s, content, 7));
    expect(s.stakes[0].paid).toBeCloseTo(due, 1);
  });

  it('sends anywhere else are not staked', () => {
    const s = onDay(7);
    recordStake(s, '0xb8d6e201b59c95094b2e417784b38b06c0c7e46a', 40);
    expect(s.stakes).toEqual([]);
  });

  it("the vibe check shows the stake moving with the portfolio; stale prices freeze it there, not the payout", () => {
    const s = send(onDay(7), 100);
    s.values.day = 10;
    s.clockMin = 21 * 60;
    const id = registerApp(s, { template: 'sentiment', kind: 'client', name: 'Vibe Check', spec: tmpl.features.map((f) => ({ id: f.id, params: f.params })) });
    const app = getApp(s, id)!;
    app.features = tmpl.features.map((f) => ({ id: f.id, correct: true, params: f.params }));
    app.deployed = true;
    const site = () => renderAppSite(app, tmpl, undefined, { day: 10, minute: s.clockMin, market: marketPosts(s, content), crane: cranePosts(s, content), stakes: s.stakes });
    const real = stakeWorth(s, content, s.stakes[0]);
    expect(site()).toContain('Your stake');
    expect(site()).toContain(real.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    // the price column stuck on the first quote: the stake shown barely moves, the real one does
    app.features.find((f) => f.id === 'portfolio')!.correct = false;
    app.features.find((f) => f.id === 'portfolio')!.variant = 'stale_prices';
    expect(site()).not.toContain(real.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    expect(stakeWorth(s, content, s.stakes[0])).toBeCloseTo(real);
  });
});
