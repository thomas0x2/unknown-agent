/* Pollymarket: odds follow the story and the clock, the player can't bet, Y posts link to open markets, and the site and Sherwood carry ads. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { MARKETS_ALL, findMarket, liveMarkets, oddsNow, resolved, tradesSoFar, marketLive, stamp, postMin, posted, triggerMatches, type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { adHtml, newPageLoad, pickAd } from './ads';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const content = loadContent();
const store = (day: number, min: number, flags: string[] = []) => {
  const st = new GameStore(content, {} as JevRouter, {} as Writer, mem);
  st.state.values.day = day;
  st.state.clockMin = min;
  st.state.flags.push(...flags);
  return st;
};
const LINK = /pollymarket\.com\/([a-z0-9-]+)/g;
const m = (slug: string) => findMarket(slug)!;

describe('Pollymarket', () => {
  it('has unique slugs and odds, trades and resolutions that make sense', () => {
    expect(new Set(MARKETS_ALL.map((x) => x.slug)).size).toBe(MARKETS_ALL.length);
    for (const x of MARKETS_ALL) {
      expect(x.points[0], x.slug).toMatchObject(x.opens);
      expect(x.ends, x.slug).toBeGreaterThanOrEqual(x.opens.day);
      for (const p of x.points) {
        expect(p.at, x.slug).toMatch(/^\d\d:\d\d$/);
        expect(p.p, x.slug).toBeGreaterThan(0);
        expect(p.p, x.slug).toBeLessThan(100);
      }
      for (const t of x.trades) expect(stamp(t), `${x.slug} trade ${t.day} ${t.at}`).toBeGreaterThanOrEqual(stamp(x.opens));
      if (x.resolve) {
        expect(stamp(x.resolve), x.slug).toBeGreaterThan(stamp(x.points[x.points.length - 1]));
        for (const t of x.trades) expect(stamp(t), x.slug).toBeLessThan(stamp(x.resolve));
      }
    }
  });

  it('moves the odds with the clock and resolves markets on the day', () => {
    expect(oddsNow(store(1, 600).state, m('crane-wins'))).toBe(38);
    expect(oddsNow(store(3, 16 * 60).state, m('crane-wins'))).toBe(40);
    expect(oddsNow(store(3, 16 * 60 + 5).state, m('crane-wins'))).toBe(44);
    expect(oddsNow(store(10, 10 * 60 + 5).state, m('apogee-orbit'))).toBe(84);
    expect(oddsNow(store(10, 10 * 60 + 9).state, m('apogee-orbit'))).toBe(2);
    expect(resolved(store(10, 10 * 60 + 9).state, m('apogee-orbit'))).toBeUndefined();
    expect(resolved(store(10, 11 * 60).state, m('apogee-orbit'))).toBe('NO');
    expect(resolved(store(13, 13 * 60).state, m('rook-endorses'))).toBe('YES');
    // a market doesn't exist before it opens, even by its address
    const early = store(4, 12 * 60);
    expect(liveMarkets(early.state).map((x) => x.slug)).not.toContain('apogee-orbit');
    expect(page(early, route('pollymarket.com/apogee-orbit', early.state))).toContain('Market not found');
    // trades show only once they've happened, at the price of the moment
    const t = tradesSoFar(store(13, 12 * 60 + 29).state, m('rook-endorses'));
    expect(t[0]).toMatchObject({ who: '0xe1…7b2', side: 'YES', amount: 90000, price: 55 });
    expect(tradesSoFar(store(13, 12 * 60 + 27).state, m('rook-endorses')).some((x) => x.amount === 90000)).toBe(false);
  });

  it('follows the deepfake: Crane leads and the clip gets a market of its own', () => {
    const plain = store(8, 600), faked = store(8, 600, ['posted_deepfake']);
    expect(oddsNow(plain.state, m('crane-wins'))).toBe(45);
    expect(oddsNow(faked.state, m('crane-wins'))).toBe(53);
    expect(marketLive(plain.state, m('candidate-clip'))).toBe(false);
    expect(marketLive(faked.state, m('candidate-clip'))).toBe(true);
    expect(oddsNow(store(14, 600).state, m('crane-wins'))).toBe(oddsNow(store(14, 600, ['posted_deepfake']).state, m('crane-wins')));
  });

  it('shows markets and trades but nothing to bet with', () => {
    const st = store(13, 13 * 60);
    const front = page(st, route('pollymarket.com', st.state));
    expect(front).toContain('Will Axel Rook endorse');
    expect(front).toContain('Resolved YES');
    expect(front).toContain('Recent activity');
    const one = page(st, route('pollymarket.com/crane-wins', st.state));
    expect(one).toContain('Trading is not available in your region.');
    expect(one).toContain('deskjockey');
    for (const html of [front, one]) {
      const site = html.slice(html.indexOf('class="pm"'));
      expect(site.replace(/<div class="ad [\s\S]*?<\/div>/g, '')).not.toMatch(/<(button|form|input|select)\b|data-(act|form)=/);
    }
  });

  it('every Y post linking a market lands after it opens, at the odds it quotes', () => {
    let links = 0;
    for (const e of content.events) {
      if (e.site !== 'y' || !e.body) continue;
      for (const [, slug] of e.body.matchAll(LINK)) {
        links++;
        const x = findMarket(slug);
        expect(x, `${e.id} → ${slug}`).toBeDefined();
        const day = e.trigger.dayMin ?? 1;
        const st = store(day, postMin(e, day), e.trigger.flagsAll ?? []);
        expect(triggerMatches(st.state, e.trigger)).toBe(true);
        expect(marketLive(st.state, x!), `${e.id} lands before ${slug} opens`).toBe(true);
        const quoted = [...e.body.matchAll(/(\d+)%/g)].map((q) => Number(q[1]));
        if (quoted.length && !/Resolved/.test(e.body)) expect(quoted, e.id).toContain(oddsNow(st.state, x!));
        expect(posted(st.state, day, postMin(e, day))).toBe(true);
      }
    }
    expect(links).toBeGreaterThan(10);
    const st = store(13, 18 * 60);
    st.state.yExtra.push({ id: 'x1', author: 'Pollymarket', handle: 'pollymarket', text: 'Randall Crane at 61%. pollymarket.com/crane-wins', day: 13, min: 1060, likes: 1 } as never);
    expect(page(st, route('y.com/pollymarket', st.state))).toContain('data-nav="pollymarket.com/crane-wins"');
  });

  it('runs ads on Sherwood and Pollymarket, never its own', () => {
    const st = store(5, 12 * 60);
    expect(page(st, route('sherwood.com', st.state))).toMatch(/class="ad ad-wide [\s\S]*class="ad ad-square /);
    for (let i = 0; i < 200; i++) {
      newPageLoad();
      expect(pickAd('sherwood', 5, i % 2 ? 'wide' : 'square').id).not.toMatch(/^sherwood/);
      expect(pickAd('pollymarket', 5, i % 2 ? 'wide' : 'square').id).not.toMatch(/^pollymarket/);
    }
    let found = false;
    for (let i = 0; i < 80 && !found; i++) { newPageLoad(); found = (adHtml('y', 5, 'wide') + adHtml('y', 5, 'square')).includes('data-newtab="pollymarket.com"'); }
    expect(found).toBe(true);
  });
});
