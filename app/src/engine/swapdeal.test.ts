/*
 * Swaplist as a buyer: chatting with sellers, offers and buying, with the live app's bugs applied.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { getEvent } from './events';
import { buildApp, deployApp, getApp, devToggleBug } from './apps';
import { swapMessage, swapOffer, swapBuy, liveListings, lowestOffer, TOO_LONG_SWAP } from './swapdeal';
import { setValue } from './core';
import { scriptedWriter } from './writer';
import type { GameState } from './state';

const content = loadContent();
const tmpl = content.apps.swaplist;

/** A live Swaplist with no bugs, a day and a half after its first listing. */
function market(): { s: GameState; id: string } {
  const s = startGame(content, 2);
  applyEffects(s, getEvent(content, 'viktor_contact')!.outcomes!.find((o) => o.id === 'build')!.effects, undefined, 'viktor_contact');
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
const unsold = (s: GameState, id: string) => liveListings(s, getApp(s, id)!).find((l) => l.soldAt == null && l.price > 0)!;
const sold = (s: GameState, id: string) => liveListings(s, getApp(s, id)!).find((l) => l.soldAt != null)!;

describe('Swaplist seller chat', () => {
  it('the seller answers the message', async () => {
    const { s, id } = market();
    const l = unsold(s, id);
    const r = await swapMessage(s, content, scriptedWriter, l.n, 'Is it still available?');
    const t = r.state.swap!.threads[0];
    expect(t.msgs.map((m) => m.from)).toEqual(['you', l.seller]);
  });

  it('with wrong_seller someone else answers', async () => {
    const { s, id } = market();
    devToggleBug(s, id, 'contact', 'wrong_seller');
    const l = unsold(s, id);
    const r = await swapMessage(s, content, scriptedWriter, l.n, 'Is it still available?');
    const reply = r.state.swap!.threads[0].msgs[1];
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
    expect(TOO_LONG_SWAP).toContain(r.state.swap!.threads[0].msgs[1].text);
  });
});

describe('Swaplist offers and buying', () => {
  it('an offer at the lowest price is accepted and buying pays that', () => {
    const { s, id } = market();
    const l = unsold(s, id);
    const low = swapOffer(s, content, l.n, lowestOffer(l) - 1);
    expect(low.swap!.threads[0].offer!.status).toBe('declined');
    const ok = swapOffer(low, content, l.n, lowestOffer(l));
    expect(ok.swap!.threads[0].offer!.status).toBe('accepted');
    const paid = swapBuy(ok, content, l.n);
    expect(paid.values.crypto).toBe(500 - lowestOffer(l));
    expect(paid.tx.at(-1)!.memo).toBe(`@${l.seller} · Swaplist`);
    expect(liveListings(paid, getApp(paid, id)!).find((x) => x.n === l.n)!.boughtByYou).toBe(true);
  });

  it('buying without enough DOLR says so and charges nothing', () => {
    const { s, id } = market();
    setValue(s, 'crypto', 1);
    const l = unsold(s, id);
    const r = swapBuy(s, content, l.n);
    expect(r.values.crypto).toBe(1);
    expect(r.swap!.notice!.text).toMatch(/Not enough DOLR/);
  });

  it('price_x100 charges the price the site shows', () => {
    const { s, id } = market();
    setValue(s, 'crypto', 100000);
    devToggleBug(s, id, 'listings', 'price_x100');
    const l = unsold(s, id);
    expect(swapBuy(s, content, l.n).values.crypto).toBe(100000 - l.price * 100);
  });

  it('sold items take no offers, unless offers_open; then the seller says it is sold', () => {
    const { s, id } = market();
    const l = sold(s, id);
    expect(swapOffer(s, content, l.n, l.price)).toBe(s);
    devToggleBug(s, id, 'mark_sold', 'offers_open');
    expect(swapOffer(s, content, l.n, l.price).swap!.threads[0].offer!.status).toBe('sold');
  });
});
