/*
 * Two story beats on the trader's vibe check. Day 6: the Crane impostor's $VANT post lands a
 * guaranteed bug on a live auto-buy (it trusts the lookalike account), fixable the whole day. And 90
 * minutes after the auto-buy first goes live, Crane praises $APO (the auto-buy's first real test) and
 * Axel answers with a rocket.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { deploy } from './actions';
import { getEvent, deliverArrivals } from './events';
import { revealBugs, bugsOf } from './apps';
import { marketPosts, autoBuys } from './crawler';
import type { GameState, AppInstance } from './state';

const content = loadContent();
const at = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** A Vibe Check whose agent has pushed a clean build with the auto-buy, not yet deployed. */
function trader(day: number, min: string, withAutoBuy = true): { s: GameState; app: AppInstance } {
  const s = startGame(content, 5);
  s.values.day = day;
  s.clockMin = at(min);
  const offer = getEvent(content, 'trader_contact')!.outcomes!.find((o) => o.id === 'offer')!;
  applyEffects(s, offer.effects, undefined, 'trader_contact');
  const app = s.apps.find((a) => a.clientEventId === 'trader_contact')!;
  if (withAutoBuy) app.required.push('auto_buy');
  app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
  app.repoVersion = 1;
  return { s, app };
}
const live = (s: GameState) => s.apps.find((a) => a.clientEventId === 'trader_contact')!;
const autoBuyBugs = (f?: { correct: boolean; variant?: string; also?: string[] }) => (f && !f.correct ? bugsOf(f as never) : []);

describe('day 6: the impostor gets the auto-buy', () => {
  it('lands once the impostor has posted, on the live build and the repo', () => {
    const { s: s0, app } = trader(6, '10:00');
    const s = deploy(s0, app.id, content);
    revealBugs(s, content);
    expect(live(s).features.find((f) => f.id === 'auto_buy')!.correct).toBe(true);
    s.clockMin = at('15:40');
    revealBugs(s, content);
    const a = live(s);
    expect(autoBuyBugs(a.features.find((f) => f.id === 'auto_buy'))).toContain('impostor_buy');
    expect(autoBuyBugs(a.repo.find((f) => f.id === 'auto_buy'))).toContain('impostor_buy');
    // the bot buys $VANT off the lookalike account
    expect(autoBuys(marketPosts(s, content), 6, new Set(['impostor_buy'])).map((b) => [b.ticker, b.post.handle])).toContainEqual(['VANT', 'randa11_crane']);
  });

  it('comes once: a fix the same day stays fixed', () => {
    const { s: s0, app } = trader(6, '16:00');
    const s = deploy(s0, app.id, content);
    revealBugs(s, content);
    const a = live(s);
    for (const f of [...a.repo, ...a.features]) if (f.id === 'auto_buy') Object.assign(f, { correct: true, variant: undefined, also: undefined });
    s.clockMin = at('17:00');
    revealBugs(s, content);
    expect(a.features.find((f) => f.id === 'auto_buy')!.correct).toBe(true);
    expect(a.planted).toEqual(['impostor_buy']);
  });

  it('needs the auto-buy live, and only on day 6', () => {
    const { s: s0, app } = trader(6, '16:00', false);
    const s = deploy(s0, app.id, content);
    revealBugs(s, content);
    expect(live(s).planted).toBeUndefined();
    const { s: s4, app: app4 } = trader(5, '16:00');
    const d4 = deploy(s4, app4.id, content);
    revealBugs(d4, content);
    expect(live(d4).planted).toBeUndefined();
  });
});

describe("Crane's $APO post tests the new auto-buy", () => {
  it('lands 90 minutes after the auto-buy goes live, Axel\'s rocket a few minutes later, and the bot buys $APO', () => {
    const { s: s0, app } = trader(3, '14:00');
    const s = deploy(s0, app.id, content);
    expect(s.arriving).toContainEqual({ eventId: 'trader_y_crane_apo', day: 3, at: at('15:30') });
    expect(s.arriving).toContainEqual({ eventId: 'trader_y_axel_apo', day: 3, at: at('15:36') });
    // Axel's reply waits for a free slot on Y, but always comes after Crane's post
    for (let m = at('15:30'); m <= at('17:00'); m++) { s.clockMin = m; deliverArrivals(s, content); }
    const min = (id: string) => s.delivered.find((d) => d.eventId === id)?.min;
    expect(min('trader_y_crane_apo')).toBe(at('15:30'));
    expect(min('trader_y_axel_apo')).toBeGreaterThan(min('trader_y_crane_apo')!);
    expect(autoBuys(marketPosts(s, content), 3, new Set()).map((b) => [b.ticker, b.post.id])).toEqual([['APO', 'trader_y_crane_apo']]);
  });

  it('only the first deploy with the auto-buy queues it, not the deploy before it', () => {
    const { s: s0, app } = trader(3, '11:00', false);
    let s = deploy(s0, app.id, content);
    expect(s.arriving?.some((a) => a.eventId === 'trader_y_crane_apo')).toBeFalsy();
    const a = live(s);
    a.required.push('auto_buy');
    a.repo.push({ id: 'auto_buy', correct: true });
    a.repoVersion = 2;
    s.clockMin = at('13:00');
    s = deploy(s, a.id, content);
    expect(s.arriving?.filter((x) => x.eventId === 'trader_y_crane_apo')).toEqual([{ eventId: 'trader_y_crane_apo', day: 3, at: at('14:30') }]);
    s.clockMin = at('14:40');
    deliverArrivals(s, content);
    live(s).repoVersion = 3;
    s = deploy(s, a.id, content);
    expect(s.arriving?.some((x) => x.eventId === 'trader_y_crane_apo')).toBeFalsy();
  });

  it('lands by 20:00, or the next morning with Axel still after Crane', () => {
    const fits = deploy(trader(3, '18:24').s, trader(3, '18:24').app.id, content);
    expect(fits.arriving).toContainEqual({ eventId: 'trader_y_axel_apo', day: 3, at: at('20:00') });
    const { s: s0, app } = trader(3, '18:30');
    const s = deploy(s0, app.id, content);
    expect(s.arriving).toContainEqual({ eventId: 'trader_y_crane_apo', day: 4, at: at('10:30') });
    expect(s.arriving).toContainEqual({ eventId: 'trader_y_axel_apo', day: 4, at: at('10:36') });
    // still waiting tonight
    s.clockMin = at('21:59');
    deliverArrivals(s, content);
    expect(s.delivered.some((d) => d.eventId === 'trader_y_crane_apo')).toBe(false);
  });
});
