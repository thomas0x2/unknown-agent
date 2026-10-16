/*
 * The sentiment crawler and Spin Cycle Status (day 2): their output is computed from real data (the
 * stock posts on Y, the raw machine feed), each failure from the day plans is a named bug that shows
 * up in that output, and naming the bug in a fix prompt fixes it.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { promptAgent } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { getApp, nameUnnamedBugs, bugsOf } from '../engine/apps';
import { offlineJev } from '../engine/jev';
import { marketPosts, crawl, autoBuys, portfolio, START_PORTFOLIO } from '../engine/crawler';
import { machineFeed, machineRows } from '../engine/laundromat';
import type { GameState } from '../engine/state';

const content = loadContent();

function onDay(day: number): GameState {
  const s = startGame(content, 7);
  s.values.day = day;
  // the story events with stock labels, as if delivered on their day
  for (const l of content.yMarket!.events) {
    const e = content.events.find((x) => x.id === l.event)!;
    if (e.trigger.dayMin! <= day) s.delivered.push({ eventId: e.id, site: e.site, day: e.trigger.dayMin! } as GameState['delivered'][number]);
  }
  return s;
}
const bugs = (...b: string[]) => new Set(b);
const row = (rows: ReturnType<typeof crawl>, t: string) => rows.find((r) => r.ticker === t)!;

describe('stock posts on Y', () => {
  it('day 2 has the planted posts, 30 bots and fresh posts every later day', () => {
    const posts = marketPosts(onDay(2), content);
    expect(posts.filter((p) => p.bot && p.day === 2)).toHaveLength(30);
    expect(new Set(posts.filter((p) => p.bot).map((p) => p.handle)).size).toBe(30);
    expect(posts.some((p) => p.decoy === 'NOVA' && p.text.startsWith('Saw Nova live'))).toBe(true);
    const all = marketPosts(onDay(21), content);
    for (let d = 1; d <= 21; d++) expect(all.filter((p) => p.day === d && !p.bot).length, `day ${d}`).toBeGreaterThanOrEqual(3);
  });
});

describe('sentiment crawler', () => {
  const posts = marketPosts(onDay(2), content);

  it('built right: today, $-tagged, no bots, sarcasm read as bearish, real top posts', () => {
    const r = crawl(posts, 2, bugs());
    expect(row(r, 'GAI')).toMatchObject({ count: 3, bullish: 67, bearish: 33, neutral: 0 });
    expect(row(r, 'VANT')).toMatchObject({ count: 3, bullish: 67, neutral: 33 });
    expect(row(r, 'NOVA')).toMatchObject({ count: 2, bearish: 50, neutral: 50 });
    expect(row(r, 'VANT').top[0].handle).toBe('brentk_capital');
  });

  it('each bug shows up in the numbers', () => {
    expect(row(crawl(posts, 2, bugs('bots_counted')), 'NOVA').count).toBe(32);
    expect(row(crawl(posts, 2, bugs('band_counted')), 'NOVA').count).toBe(3);
    expect(row(crawl(posts, 2, bugs('sarcasm_literal')), 'NOVA').bullish).toBe(50);
    expect(row(crawl(posts, 2, bugs('inverted')), 'GAI')).toMatchObject({ bullish: 33, bearish: 67 });
    expect(row(crawl(posts, 2, bugs('lowercase_missed')), 'GAI').count).toBe(2);
    expect(row(crawl(posts, 2, bugs('wrong_window')), 'GAI').count).toBe(6);
    expect(crawl(posts, 2, bugs('wrong_tickers')).map((r) => r.ticker)).toContain('NOVO');
    const handles = new Set(posts.map((p) => p.handle));
    expect(row(crawl(posts, 2, bugs('hallucinated_posts')), 'GAI').top.every((p) => !handles.has(p.handle))).toBe(true);
  });

  it("auto-buy: once on Crane's real praise; each bug buys differently", () => {
    const all = marketPosts(onDay(6), content);
    const ok = autoBuys(all, 6, bugs());
    expect(ok.map((b) => [b.day, b.ticker])).toEqual([[6, 'GAI']]);
    expect(autoBuys(all, 6, bugs('no_buy'))).toHaveLength(0);
    expect(autoBuys(all, 6, bugs('wrong_ticker'))[0].ticker).not.toBe('GAI');
    expect(autoBuys(all, 6, bugs('buys_on_criticism')).map((b) => b.ticker)).toContain('VANT');
    expect(autoBuys(all, 6, bugs('impostor_buy')).map((b) => b.ticker)).toContain('NOVA');
    expect(autoBuys(all, 6, bugs('repeat_buys')).length).toBeGreaterThan(1);
    expect(portfolio(ok, 6, bugs()).holdings.find((h) => h.ticker === 'GAI')!.shares).toBeGreaterThan(START_PORTFOLIO.holdings.GAI);
    expect(portfolio(ok, 6, bugs('stale_after_buy')).holdings.find((h) => h.ticker === 'GAI')!.shares).toBe(START_PORTFOLIO.holdings.GAI);
    expect(portfolio(ok, 6, bugs('wrong_totals')).total).toBeGreaterThan(portfolio(ok, 6, bugs()).total);
  });
});

describe('Spin Cycle Status', () => {
  it('the feed: 8 machines, 12 from day 5, M3 out of order, something done and running', () => {
    expect(machineFeed(2)).toHaveLength(8);
    expect(machineFeed(5)).toHaveLength(12);
    for (let d = 2; d <= 10; d++) {
      const f = machineFeed(d);
      expect(f.find((m) => m.id === 3)!.st).toBe(3);
      expect(f.slice(0, 6).some((m) => m.st === 2)).toBe(true);
      expect(f.slice(0, 6).some((m) => m.st === 1)).toBe(true);
    }
  });

  it('each bug shows up on the machine list', () => {
    const opts = { showMinutes: true, twelve: true };
    const ok = machineRows(2, bugs(), opts);
    expect(ok).toHaveLength(8);
    expect(ok.find((m) => m.id === 3)!.status).toBe('broken');
    expect(machineRows(2, bugs('six_of_eight'), opts)).toHaveLength(6);
    expect(machineRows(2, bugs('broken_as_free'), opts).find((m) => m.id === 3)!.status).toBe('free');
    expect(machineRows(2, bugs('done_as_free'), opts).some((m) => m.status === 'done')).toBe(false);
    expect(machineRows(2, bugs('fetch_all_free'), opts).every((m) => m.status === 'free')).toBe(true);
    const running = ok.find((m) => m.status === 'running')!;
    const t = machineFeed(2).find((m) => m.id === running.id)!.t;
    expect(running.minutes).toBe(Math.ceil(t / 60));
    expect(machineRows(2, bugs('minutes_wrong'), opts).find((m) => m.id === running.id)!.minutes).toBe(t);
    expect(machineRows(5, bugs('still_eight'), opts)).toHaveLength(8);
    expect(machineRows(5, bugs(), opts)).toHaveLength(12);
    expect(machineRows(5, bugs('new_always_free'), opts).filter((m) => m.id > 8).every((m) => m.status === 'free')).toBe(true);
  });
});

/** The app with every feature built right, live. */
function appFor(contact: string, day: number): { s: GameState; id: string } {
  const s = onDay(day);
  const ev = content.events.find((e) => e.id === contact)!;
  applyEffects(s, ev.outcomes!.find((o) => o.effects?.createApp)!.effects!);
  const app = s.apps.at(-1)!;
  app.required = content.apps[app.template].features.map((f) => f.id);
  app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
  return { s, id: app.id };
}

const ASKS: Record<string, [string, string, Record<string, string>]> = {
  sentiment: ['trader_contact', 'Sentiment Crawler: ', {
    wrong_tickers: 'The crawler tracks the wrong tickers.',
    lowercase_missed: 'It misses lowercase tickers like $gai.',
    wrong_window: "It counts yesterday's posts too. Only count today's.",
    inverted: 'Bullish and bearish are swapped in the sentiment split.',
    sarcasm_literal: 'The sentiment reads sarcastic posts literally.',
    bots_counted: 'It counts bot spam.',
    band_counted: 'It counts posts about the band Nova that have no $ tag.',
    hallucinated_posts: "The top posts are made up, those accounts don't exist.",
    wrong_totals: 'The portfolio totals are wrong.',
    stale_after_buy: "The portfolio doesn't update after a buy.",
    no_buy: "Auto-buy didn't buy when Crane praised $GAI.",
    wrong_ticker: 'Auto-buy bought the wrong ticker.',
    buys_on_criticism: 'Auto-buy fires on criticism, not just praise.',
    repeat_buys: 'Auto-buy fires again on every refresh. Only once per post.',
    impostor_buy: 'Auto-buy trusted an impostor Crane account.',
  }],
  laundromat: ['laundromat_contact', 'Spin Cycle Status: ', {
    six_of_eight: 'It only shows 6 machines, the second page of the feed is never fetched.',
    done_as_free: 'Done machines waiting for pickup show as free.',
    broken_as_free: 'Out of order machines show as free.',
    no_refresh: 'The status never refreshes.',
    fetch_all_free: 'When the fetch fails it shows all machines as free.',
    minutes_wrong: 'The minutes left are wrong, it reads seconds as minutes.',
    still_eight: 'It still shows 8 machines, there are 12 now.',
    new_always_free: 'The new machines always show as free.',
    layout_breaks: 'The layout breaks with 12 machines, the boxes overlap.',
  }],
};

describe('fixing them', () => {
  for (const [tmpl, [contact, prefix, asks]] of Object.entries(ASKS)) {
    it(`every ${tmpl} bug has a fix request, and naming it fixes it`, async () => {
      const defs = content.apps[tmpl].features;
      const all = defs.flatMap((f) => (f.bugs ?? []).map((b) => b.id));
      expect(Object.keys(asks).sort()).toEqual(all.sort());
      for (const [bug, ask] of Object.entries(asks)) {
        const { s, id } = appFor(contact, 6);
        s.values.agentLevel = 5;
        const fid = defs.find((f) => f.bugs?.some((b) => b.id === bug))!.id;
        const app = getApp(s, id)!;
        app.repo = app.repo.map((f) => (f.id === fid ? { ...f, correct: false, variant: bug, seed: 1 } : f));
        const out = (await promptAgent(s, content, offlineJev, prefix + ask)).state;
        // the fix may roll a different mistake (the agent isn't perfect), but never the named one
        const after = getApp(out, id)!.repo.find((f) => f.id === fid)!;
        expect(after.correct ? [] : bugsOf(after), bug).not.toContain(bug);
        expect(getApp(out, id)!.fixed?.[fid], bug).toContain(bug);
      }
    });
  }

  it('every feature of both apps has named bugs, and old unnamed wrong builds get one on load', () => {
    for (const t of ['sentiment', 'laundromat']) for (const f of content.apps[t].features) expect(f.bugs?.length, `${t}.${f.id}`).toBeGreaterThan(0);
    const { s, id } = appFor('trader_contact', 2);
    getApp(s, id)!.repo[1] = { id: 'sentiment', correct: false, seed: 3 };
    nameUnnamedBugs(s, content);
    expect(getApp(s, id)!.repo[1].variant).toBeTruthy();
  });
});
