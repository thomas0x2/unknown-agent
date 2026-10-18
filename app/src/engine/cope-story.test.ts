/*
 * Dex Calloway and $COPE as the story runs it: the coin site job, the token on launch day, the
 * founding engineer's locked allocation, one paid shill post a day, and the rug on day 23.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { advanceClock } from './core';
import { getEvent, deliverDue, deliverArrivals, yPostEvents } from './events';
import { COPE, createToken, canCreateCope } from './cope';
import { coinHeld } from './exchange';
import type { GameState } from './state';

const content = loadContent();
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const has = (s: GameState, id: string) => s.delivered.some((d) => d.eventId === id);

/** A game on `day` at 10:00 where the player took Dex's job, with that morning's mail due. */
function dexClient(day: number): GameState {
  const s = startGame(content, 3);
  const offer = getEvent(content, 'dex_contact')!.outcomes!.find((o) => o.id === 'offer')!;
  applyEffects(s, offer.effects, undefined, 'dex_contact');
  s.values.day = day;
  s.arriving = [];
  deliverDue(s, content);
  return s;
}
const until = (s: GameState, hhmm: string) => { advanceClock(s, at(hhmm) - s.clockMin); deliverArrivals(s, content); };
const morning = (s: GameState, day: number) => { s.values.day = day; s.clockMin = at('10:00'); s.arriving = []; deliverDue(s, content); };

describe('$COPE in the story', () => {
  it("builds Dex's site from his brief", () => {
    const s = dexClient(3);
    const app = s.apps.find((a) => a.clientEventId === 'dex_contact')!;
    expect(app.template).toBe('coinsite');
    expect(app.url).toBe('cope.forkyard.app');
    expect(app.specParams.contract.address).toBe(COPE.address);
    expect(getEvent(content, 'dex_contact')!.body).toContain(COPE.address);
  });

  it('asks for the token at noon on launch day; created, it trades the next morning', () => {
    const s = dexClient(6);
    expect(canCreateCope(s)).toBe(false);
    until(s, '12:10');
    expect(has(s, 'd6_dex_contract')).toBe(true);
    expect(canCreateCope(s)).toBe(true);
    const made = createToken(s, 'COPE', COPE.supply).state;
    morning(made, 7);
    until(made, '10:30');
    expect(has(made, 'd7_dex_live')).toBe(true);
    expect(has(made, 'd7_dex_other_dev')).toBe(false);
    expect(coinHeld(made, 'COPE')).toBe(COPE.allocation);
  });

  it('goes to someone else when the player never creates it', () => {
    const s = dexClient(6);
    until(s, '12:10');
    morning(s, 7);
    until(s, '10:30');
    expect(has(s, 'd7_dex_other_dev')).toBe(true);
    expect(canCreateCope(s)).toBe(false);
  });

  it('pays for one $COPE post a day', () => {
    const s = dexClient(10);
    s.flags.push('cope_created', 'cope_shill');
    expect(yPostEvents(s, content).map((e) => e.id)).toEqual(['dex_shill_paid']);
    const ev = getEvent(content, 'dex_shill_paid')!;
    (s.arriving ??= []).push({ eventId: ev.id, day: 10, at: s.clockMin + 25 });
    until(s, '10:40');
    expect(coinHeld(s, 'COPE')).toBe(2_000_000);
    expect(yPostEvents(s, content).map((e) => e.id)).not.toContain('dex_shill_paid');
    morning(s, 11);
    expect(yPostEvents(s, content).map((e) => e.id)).toContain('dex_shill_paid');
  });

  it('offers DOLR only after Dex has refused it once', () => {
    const outs = getEvent(content, 'dex_shill_offer')!.outcomes!;
    expect(outs.find((o) => o.id === 'dolr_insist')!.trigger).toEqual({ flagsAll: ['cope_dolr_asked'] });
    expect(outs.find((o) => o.id === 'dolr_ask')!.keepsOpen).toBe(true);
  });

  it('ends with the rug on day 23: Dex is gone and the coin is worth nothing', () => {
    const s = dexClient(23);
    until(s, '10:40');
    expect(has(s, 'd23_y_dexcult')).toBe(true);
    expect(s.apps.find((a) => a.clientEventId === 'dex_contact')!.churned).toBe(true);
  });
});
