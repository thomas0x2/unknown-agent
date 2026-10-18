/*
 * Swaplist as a buyer: chatting with sellers, offers and buying, with the live app's bugs applied.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { getEvent } from './events';
import { buildApp, deployApp, getApp, devToggleBug } from './apps';
import { swapMessage, swapOffer, swapBuy, liveListings, lowestOffer, TOO_LONG_SWAP, deliverSwapReplies, SWAP_REPLY_DELAY } from './swapdeal';
import { setValue } from './core';
import { scriptedWriter } from './writer';
import type { GameState } from './state';

const content = loadContent();
const tmpl = content.apps.swaplist;

/** A live Swaplist with no bugs, a day and a half after its first listing. */
function market(): { s: GameState; id: string } {
  const s = startGame(content, 2);
  applyEffects(s, getEvent(content, 'viktor_contact')!.outcomes!.find((o) => o.id === 'build')!.effects, undefined, 'viktor_contact');
  // Viktor's day 5 Y post asks for seller messages
  applyEffects(s, getEvent(content, 'd7_y_swaplist_messages')!.onDeliver!, undefined, 'd7_y_swaplist_messages');
  const id = s.apps.find((a) => a.template === 'swaplist')!.id;
  buildApp(s, id, ['listings', 'search', 'contact', 'mark_sold'], 5, { tmpl });
  deployApp(s, id, tmpl);
  const app = getApp(s, id)!;
  app.contentAt = 0; app.contentLive = true;
  for (const list of [app.repo, app.features]) for (const f of list) Object.assign(f, { correct: true, variant: undefined, also: undefined });
  s.values.day = 2; s.clockMin = 14 * 60;
  setValue(s, 'crypto', 500);
  return { s, id };
}
/** Lets enough game minutes pass for every seller to have answered. */
function later(s: GameState): GameState { s.clockMin += SWAP_REPLY_DELAY.max * 3; deliverSwapReplies(s); return s; }
const w = scriptedWriter;
const unsold = (s: GameState, id: string) => liveListings(s, getApp(s, id)!).find((l) => l.soldAt == null && l.price > 0)!;
const sold = (s: GameState, id: string) => liveListings(s, getApp(s, id)!).find((l) => l.soldAt != null)!;

describe('Swaplist seller chat', () => {
  it('is not in the first brief: Viktor asks for it on Y on day 5, once the site is live and working', () => {
    const s = startGame(content, 2);
    applyEffects(s, getEvent(content, 'viktor_contact')!.outcomes!.find((o) => o.id === 'build')!.effects, undefined, 'viktor_contact');
    const app = s.apps.find((a) => a.template === 'swaplist')!;
    expect(app.required).not.toContain('contact');
    const ask = getEvent(content, 'd7_y_swaplist_messages')!;
    expect(ask.trigger).toMatchObject({ dayMin: 7, appWorking: 'viktor_contact' });
    applyEffects(s, ask.onDeliver!, undefined, ask.id);
    expect(app.required).toContain('contact');
  });

  it('the seller answers the message', async () => {
    const { s, id } = market();
    const l = unsold(s, id);
    const r = await swapMessage(s, content, scriptedWriter, l.n, 'Is it still available?');
    const t = r.state.swap!.threads[0];
    expect(t.msgs.map((m) => m.from)).toEqual(['you']);
    later(r.state);
    expect(t.msgs.map((m) => m.from)).toEqual(['you', l.seller]);
  });

  it('with wrong_seller someone else answers', async () => {
    const { s, id } = market();
    devToggleBug(s, id, 'contact', 'wrong_seller');
    const l = unsold(s, id);
    const r = await swapMessage(s, content, scriptedWriter, l.n, 'Is it still available?');
    const reply = later(r.state).swap!.threads[0].msgs[1];
    expect(reply.from).not.toBe(l.seller);
    expect(reply.text).toMatch(/wrong person/);
  });

  it('a dead contact button sends nothing', async () => {
    const { s, id } = market();
    devToggleBug(s, id, 'contact', 'contact_dead');
    const r = await swapMessage(s, content, scriptedWriter, unsold(s, id).n, 'Hello?');
    expect(r.sent).toBe(false);
    expect(r.state.swap).toBeUndefined();
  });

  it('a message over the input cap gets a scripted line without asking the writer', async () => {
    const { s, id } = market();
    const writer = { write: async () => { throw new Error('writer was asked'); } };
    const r = await swapMessage(s, content, writer, unsold(s, id).n, 'x'.repeat(2001));
    expect(TOO_LONG_SWAP).toContain(later(r.state).swap!.threads[0].msgs[1].text);
  });
});

describe('Swaplist offers and buying', () => {
  it('an offer at the lowest price is accepted and buying pays that', async () => {
    const { s, id } = market();
    const l = unsold(s, id);
    const low = await swapOffer(s, content, w, l.n, lowestOffer(l) - 1);
    expect(low.swap!.threads[0].offer!.status).toBe('pending');
    expect(later(low).swap!.threads[0].offer!.status).toBe('declined');
    const ok = later(await swapOffer(low, content, w, l.n, lowestOffer(l)));
    expect(ok.swap!.threads[0].offer!.status).toBe('accepted');
    const paid = await swapBuy(ok, content, w, l.n);
    expect(paid.values.crypto).toBe(500 - lowestOffer(l));
    expect(paid.tx.at(-1)!.memo).toBe(`@${l.seller} · Swaplist`);
    expect(liveListings(paid, getApp(paid, id)!).find((x) => x.n === l.n)!.boughtByYou).toBe(true);
  });

  it('buying without enough DOLR says so and charges nothing', async () => {
    const { s, id } = market();
    setValue(s, 'crypto', 1);
    const l = unsold(s, id);
    const r = await swapBuy(s, content, w, l.n);
    expect(r.values.crypto).toBe(1);
    expect(r.swap!.notice!.text).toMatch(/Not enough DOLR/);
  });

  it('price_x100 charges the price the site shows', async () => {
    const { s, id } = market();
    setValue(s, 'crypto', 100000);
    devToggleBug(s, id, 'listings', 'price_x100');
    const l = unsold(s, id);
    expect((await swapBuy(s, content, w, l.n)).values.crypto).toBe(100000 - l.price * 100);
  });

  it('sold items take no offers, unless offers_open; then the seller says it is sold', async () => {
    const { s, id } = market();
    const l = sold(s, id);
    expect(await swapOffer(s, content, w, l.n, l.price)).toBe(s);
    devToggleBug(s, id, 'mark_sold', 'offers_open');
    expect(later(await swapOffer(s, content, w, l.n, l.price)).swap!.threads[0].offer!.status).toBe('sold');
  });
});

describe('Swaplist seller replies take a while', () => {
  it('each reply arrives a few game minutes after the message, stamped when it arrives', async () => {
    const { s, id } = market();
    const l = unsold(s, id);
    const r = await swapMessage(s, content, w, l.n, 'Still there?');
    const t = r.state.swap!.threads[0];
    const due = t.pending![0].due;
    r.state.clockMin += SWAP_REPLY_DELAY.min - 1;
    expect(deliverSwapReplies(r.state)).toBe(false);
    r.state.clockMin = s.clockMin + SWAP_REPLY_DELAY.max;
    expect(deliverSwapReplies(r.state)).toBe(true);
    expect(t.pending).toBeUndefined();
    expect(t.msgs[1]).toMatchObject({ from: l.seller, min: r.state.clockMin });
    expect(due - (s.clockMin - 600 + (s.values.day - 1) * 720)).toBeGreaterThanOrEqual(SWAP_REPLY_DELAY.min);
  });

  it('every seller reply is written by the Writer, offers and thanks included', async () => {
    const { s, id } = market();
    const asked: string[] = [];
    const writer = { write: async (req: { situation?: string; character?: string }) => { asked.push(req.character!); return { text: 'ok', llm: true }; } };
    const l = unsold(s, id);
    let st = later((await swapMessage(s, content, writer, l.n, 'Hi')).state);
    st = later(await swapOffer(st, content, writer, l.n, lowestOffer(l)));
    st = later(await swapBuy(st, content, writer, l.n));
    expect(asked.length).toBe(3);
    expect(st.swap!.threads[0].msgs.filter((m) => m.from === l.seller).map((m) => m.text)).toEqual(['ok', 'ok', 'ok']);
  });
});

describe('Swaplist purchases asked for in an email', () => {
  const jacket = (s: GameState, id: string) => liveListings(s, getApp(s, id)!).find((l) => l.photo === 'jacket_leather')!;
  const asked = (s: GameState) => { s.values.day = 4; s.delivered.push({ eventId: 'd4_brother_birthday', site: 'qmail', day: 4, answered: false }); };

  it("buying the leather jacket after the brother's ask is the gift: trust, flag, thread closed, his reply queued", async () => {
    const { s, id } = market();
    asked(s);
    const trust = s.values.familyTrust;
    const r = (await swapBuy(s, content, w, jacket(s, id).n));
    expect(r.flags).toContain('gift_own');
    expect(r.values.familyTrust).toBe(trust + 10);
    expect(r.delivered.find((d) => d.eventId === 'd4_brother_birthday')).toMatchObject({ answered: true, outcomeId: 'bought' });
    expect(r.arriving?.some((a) => a.eventId === 'd4_brother_bought')).toBe(true);
  });

  it('counts once, not before the ask, not after day 5, and not for other listings', async () => {
    const { s, id } = market();
    expect((await swapBuy(s, content, w, jacket(s, id).n)).flags).not.toContain('gift_own');
    const late = market(); asked(late.s); late.s.values.day = 6;
    expect((await swapBuy(late.s, content, w, jacket(late.s, late.id).n)).flags).not.toContain('gift_own');
    const other = market(); asked(other.s);
    const lamp = liveListings(other.s, getApp(other.s, other.id)!).find((l) => l.photo === 'lamp')!;
    expect((await swapBuy(other.s, content, w, lamp.n)).flags).not.toContain('gift_own');
  });
});
