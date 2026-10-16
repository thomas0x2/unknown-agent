import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startAll, endAll, wordJev } from './_fixtures';
import { replyToEvent } from './actions';
import type { JevRouter } from './jev';
import { deliverDue, deliverArrivals, settlePayments } from './events';
import { sendCrypto } from './wallets';
import type { GameState } from './state';

const content = loadContent();
const bro = content.events.find((e) => e.id === 'd4_brother_birthday')!;
const WALLET = bro.payment!.wallet;

/** Day 4 with the brother's email in the inbox and money to send. */
function day4(): GameState {
  let s = startAll(content);
  for (let i = 0; i < 3; i++) s = { ...endAll(s, content), morning: null };
  deliverDue(s, content, { now: true });
  s.values.crypto = 500;
  return s;
}
function send(s: GameState, amount: number): GameState {
  const r = sendCrypto(s, WALLET, amount);
  expect(r.error).toBeUndefined();
  settlePayments(r.state, content);
  return r.state;
}
const arrived = (s: GameState, id: string) => s.delivered.some((d) => d.eventId === id);

describe("paying the brother through Coinbin", () => {
  it('counts 40 DOLR as chipping in and he confirms an hour later', () => {
    const s = send(day4(), 40);
    expect(s.flags).toContain('gift_chipped_in');
    expect(s.delivered.find((d) => d.eventId === bro.id)).toMatchObject({ answered: true, outcomeId: 'paid' });
    const sentAt = s.clockMin;
    s.clockMin = sentAt + 59; deliverArrivals(s, content);
    expect(arrived(s, 'd4_brother_paid')).toBe(false);
    s.clockMin = sentAt + 60; deliverArrivals(s, content);
    expect(arrived(s, 'd4_brother_paid')).toBe(true);
    expect(arrived(s, 'd4_brother_paid_over')).toBe(false);
  });

  it('adds up smaller sends and mentions it when the player sent more', () => {
    let s = send(day4(), 25);
    expect(s.flags).not.toContain('gift_chipped_in');
    s = send(s, 25);
    expect(s.flags).toContain('gift_chipped_in');
    deliverArrivals(s, content, true);
    expect(arrived(s, 'd4_brother_paid_over')).toBe(true);
    expect(arrived(s, 'd4_brother_paid')).toBe(false);
  });

  it('pays once: sending again later changes nothing', () => {
    let s = send(day4(), 40);
    const trust = s.values.familyTrust;
    s = send(s, 40);
    expect(s.values.familyTrust).toBe(trust);
    expect(s.arriving!.filter((a) => a.eventId.startsWith('d4_brother_paid'))).toHaveLength(1);
  });

  it('skips the no-reply penalty and gets Mom\'s chip-in thanks', () => {
    let s = send(day4(), 40);
    s = { ...endAll(s, content), morning: null };
    s = { ...endAll(s, content), morning: null };
    expect(s.flags).not.toContain('gift_skipped');
    expect(arrived(s, 'd4_brother_paid')).toBe(true);
    deliverDue(s, content, { now: true });
    expect(arrived(s, 'd6_mom_bday_chip')).toBe(true);
  });

  it('does not count money sent after the birthday deadline', () => {
    let s = day4();
    s = { ...endAll(s, content), morning: null };
    s = { ...endAll(s, content), morning: null };
    s.values.crypto = 500;
    s = send(s, 40);
    expect(s.flags).not.toContain('gift_chipped_in');
    expect(s.flags).toContain('gift_skipped');
  });

  it('a send late in the evening lands his email next morning', () => {
    const s0 = day4();
    s0.clockMin = 21 * 60 + 30;
    const s = { ...endAll(send(s0, 40), content), morning: null };
    deliverArrivals(s, content);
    expect(arrived(s, 'd4_brother_paid')).toBe(true);
  });
});

describe("promising the money by email", () => {
  const promiseJev: JevRouter = { ...wordJev, async route() { return { kind: 'outcome', outcomeId: 'promise' }; } };

  it("gets 'i'll believe it when i see it' and leaves the thread open", async () => {
    const { state, reply } = await replyToEvent(day4(), content, promiseJev, bro.id, "sure, i'll send it later");
    expect(reply).toMatch(/believe it when i see it/);
    expect(state.delivered.find((d) => d.eventId === bro.id)?.answered).toBe(false);
    // paying afterwards still counts
    expect(send(state, 40).flags).toContain('gift_chipped_in');
  });

  it('still costs trust when the money never comes', async () => {
    let { state: s } = await replyToEvent(day4(), content, promiseJev, bro.id, "sure, i'll send it later");
    s = { ...endAll(s, content), morning: null };
    s = { ...endAll(s, content), morning: null };
    expect(s.flags).toContain('gift_skipped');
  });
});
