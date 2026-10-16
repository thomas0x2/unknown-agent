/*
 * The sentiment crawler and Spin Cycle Status (day 2): their output is computed from real data (the
 * stock posts on Y, the raw machine feed), each failure from the day plans is a named bug that shows
 * up in that output, and naming the bug in a fix prompt fixes it.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { postToY, writeReview } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { getApp, nameUnnamedBugs, bugsOf } from '../engine/apps';
import { marketPosts, crawl, autoBuys, portfolio, START_PORTFOLIO } from '../engine/crawler';
import { machineFeed, machineRows } from '../engine/laundromat';
import type { GameState } from '../engine/state';
import { wordJev, promptDone } from '../engine/_fixtures';
import { CLOCK } from '../engine/config';

const content = loadContent();

function onDay(day: number): GameState {
  const s = startGame(content, 7);
  s.values.day = day;
  s.clockMin = CLOCK.sleep - 1; // late in the day, once all of today's posts are up
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
    expect(posts.some((p) => /nova/i.test(p.text))).toBe(false);
    const all = marketPosts(onDay(21), content);
    for (let d = 1; d <= 21; d++) expect(all.filter((p) => p.day === d && !p.bot).length, `day ${d}`).toBeGreaterThanOrEqual(2);
  });
  it("today's posts go up over the day, so the crawler only sees what's posted so far", () => {
    const s = onDay(3);
    const late = marketPosts(s, content).filter((p) => p.day === 3);
    s.clockMin = CLOCK.wake;
    const early = marketPosts(s, content).filter((p) => p.day === 3);
    expect(early.length).toBeLessThan(late.length);
    expect(marketPosts(s, content).filter((p) => p.day === 2).length).toBeGreaterThan(0); // yesterday's are all up
  });
});

describe('sentiment crawler', () => {
  const posts = marketPosts(onDay(2), content);

  it('built right: today, $-tagged, no bots, sarcasm read as bearish, every counted post', () => {
    const r = crawl(posts, 2, bugs());
    expect(row(r, 'GAI')).toMatchObject({ count: 3, bullish: 67, bearish: 33, neutral: 0 });
    expect(row(r, 'VANT')).toMatchObject({ count: 4, bullish: 50, neutral: 25, bearish: 25 });
    expect(r.map((x) => x.ticker)).toEqual(['GAI', 'VANT']);
    expect(row(r, 'VANT').posts[0].handle).toBe('brentk_capital');
  });

  it('each bug shows up in the numbers', () => {
    expect(row(crawl(posts, 2, bugs('bots_counted')), 'GAI').count).toBe(33);
    expect(row(crawl(posts, 2, bugs('sarcasm_literal')), 'VANT').bullish).toBe(75);
    expect(row(crawl(posts, 2, bugs('inverted')), 'GAI')).toMatchObject({ bullish: 33, bearish: 67 });
    expect(row(crawl(posts, 2, bugs('lowercase_missed')), 'GAI').count).toBe(2);
    expect(crawl(posts, 2, bugs('wrong_tickers')).map((r) => r.ticker)).toContain('VNTR');
  });

  it('lists every crawled post with the mood it read, bugs included', () => {
    const ok = row(crawl(posts, 2, bugs()), 'VANT');
    expect(ok.posts).toHaveLength(ok.count);
    expect(row(crawl(posts, 2, bugs('bots_counted')), 'GAI').posts.filter((p) => /\d{4}$/.test(p.handle)).length).toBe(30);
    const sarcastic = posts.find((p) => p.literal && p.tickers.includes('VANT'))!;
    expect(ok.posts.find((p) => p.handle === sarcastic.handle)!.mood).toBe(sarcastic.mood);
    expect(row(crawl(posts, 2, bugs('sarcasm_literal')), 'VANT').posts.find((p) => p.handle === sarcastic.handle)!.mood).toBe(sarcastic.literal);
  });

  it("auto-buy: once on Crane's real praise; each bug buys differently", () => {
    const all = marketPosts(onDay(6), content);
    const ok = autoBuys(all, 6, bugs());
    expect(ok.map((b) => [b.day, b.ticker])).toEqual([[6, 'GAI']]);
    expect(autoBuys(all, 6, bugs('no_buy'))).toHaveLength(0);
    expect(autoBuys(all, 6, bugs('wrong_ticker'))[0].ticker).not.toBe('GAI');
    expect(autoBuys(all, 6, bugs('buys_on_criticism')).map((b) => [b.ticker, b.post.crane])).toContainEqual(['VANT', 'criticism']);
    expect(autoBuys(all, 6, bugs('impostor_buy')).map((b) => [b.ticker, b.post.handle])).toContainEqual(['VANT', 'randa11_crane']);
    expect(autoBuys(all, 6, bugs('repeat_buys')).length).toBeGreaterThan(1);
    expect(portfolio(ok, 6, bugs()).holdings.find((h) => h.ticker === 'GAI')!.shares).toBeGreaterThan(START_PORTFOLIO.holdings.GAI);
  });

  it('each portfolio bug is off by enough to see at a glance', () => {
    const all = marketPosts(onDay(6), content);
    const buys = autoBuys(all, 6, bugs());
    const ok = portfolio(buys, 6, bugs());
    const sum = ok.holdings.reduce((a, h) => a + h.value, 0) + ok.cash;
    expect(ok.total).toBeCloseTo(sum);
    expect(ok.change).toBeCloseTo(ok.holdings.reduce((a, h) => a + h.dayPnl, 0));
    for (const h of ok.holdings) expect(Math.sign(h.dayPnl)).toBe(Math.sign(h.move));
    // the total is smaller than a single holding
    expect(portfolio(buys, 6, bugs('wrong_totals')).total).toBeLessThan(Math.max(...ok.holdings.map((h) => h.value)));
    // a value smaller than the share count
    for (const h of portfolio(buys, 6, bugs('value_wrong')).holdings) expect(h.value).toBeLessThan(h.shares * 5);
    // a rising stock with a loss
    for (const h of portfolio(buys, 6, bugs('pnl_sign')).holdings) expect(Math.sign(h.dayPnl)).toBe(-Math.sign(h.move));
    // a few dollars' move on a $140 stock shown as a double-digit percentage
    for (const h of portfolio(buys, 6, bugs('pct_wrong')).holdings) expect(Math.abs(h.movePct)).toBeGreaterThan(0.1);
    for (const h of ok.holdings) expect(Math.abs(h.movePct)).toBeLessThan(0.1);
    // the totals add up what's shown: only the buggy calculation itself is off
    for (const b of ['value_wrong', 'pnl_sign', 'pct_wrong']) {
      const p = portfolio(buys, 6, bugs(b));
      expect(p.total, b).toBeCloseTo(p.holdings.reduce((a, h) => a + h.value, 0) + p.cash);
      expect(p.change, b).toBeCloseTo(p.holdings.reduce((a, h) => a + h.dayPnl, 0));
    }
    expect(portfolio(buys, 6, bugs('value_wrong')).total).toBeLessThan(ok.total);
    expect(portfolio(buys, 6, bugs('wrong_totals')).total).toBeCloseTo(ok.cash);
  });
});

describe('Spin Cycle Status', () => {
  const steps = (from = 10 * 60) => Array.from({ length: (24 * 60 - from) / 30 }, (_, k) => from + k * 30);

  it('the feed: 8 machines, 12 from day 5, M3 always out of order', () => {
    expect(machineFeed(2)).toHaveLength(8);
    expect(machineFeed(5)).toHaveLength(12);
    for (let d = 1; d <= 21; d++) for (const m of steps(7 * 60)) expect(machineFeed(d, m).find((x) => x.id === 3)!.st).toBe(3);
  });

  it('done-as-free and broken-as-free can always be caught: a done and an out-of-order machine on page one, all day', () => {
    for (let d = 1; d <= 21; d++) {
      for (const m of steps(7 * 60)) {
        const first = machineFeed(d, m).slice(0, 6);
        expect(first.some((x) => x.st === 2), `day ${d} ${m}`).toBe(true);
        expect(first.some((x) => x.st === 3)).toBe(true);
        const shown = (b: string) => machineRows(d, bugs(b), { showMinutes: true, twelve: true }, m);
        expect(shown('done_as_free').length).toBe(machineFeed(d, m).length);
        expect(machineRows(d, bugs(), { showMinutes: true, twelve: true }, m).some((r) => r.status === 'done')).toBe(true);
      }
    }
  });

  it('changes with every half hour, the same way every time', () => {
    for (let d = 2; d <= 8; d++) {
      for (const m of steps().slice(0, -1)) {
        expect(machineFeed(d, m), `day ${d} ${m}`).not.toEqual(machineFeed(d, m + 30));
        expect(machineFeed(d, m)).toEqual(machineFeed(d, m));
      }
    }
  });

  it('machines run their cycle down, finish, wait for pickup and free up', () => {
    let seen = 0;
    for (let d = 2; d <= 8; d++) {
      for (const m of steps().slice(0, -1)) {
        const now = machineFeed(d, m), later = machineFeed(d, m + 30);
        for (const x of now.filter((x) => x.st === 1)) {
          const y = later.find((z) => z.id === x.id)!;
          // a load still running has 30 minutes less to go; one that ended is done or already collected
          if (x.t > 1800 + 60) { expect(y.st, `M${x.id}`).toBe(1); expect(Math.abs(x.t - 1800 - y.t)).toBeLessThan(60); seen++; }
          else expect([0, 1, 2, 3]).toContain(y.st);
        }
        for (const x of now.filter((x) => x.st !== 1)) expect(x.t).toBe(0);
      }
    }
    expect(seen).toBeGreaterThan(10);
  });

  it('busier in the evening than in the morning', () => {
    let morning = 0, evening = 0;
    for (let d = 2; d <= 15; d++) {
      for (const m of [10 * 60, 10 * 60 + 30, 11 * 60]) morning += machineFeed(d, m).filter((x) => x.st === 1).length;
      for (const m of [19 * 60, 19 * 60 + 30, 20 * 60]) evening += machineFeed(d, m).filter((x) => x.st === 1).length;
    }
    expect(evening).toBeGreaterThan(morning * 1.3);
  });

  it('each bug shows up on the machine list', () => {
    const opts = { showMinutes: true, twelve: true };
    // a time on day 2 with a done and a running machine on the first page
    const at = steps().find((m) => { const f = machineFeed(2, m).slice(0, 6); return f.some((x) => x.st === 2) && f.some((x) => x.st === 1); })!;
    const rows = (day: number, ...b: string[]) => machineRows(day, bugs(...b), opts, at);
    const ok = rows(2);
    expect(ok).toHaveLength(8);
    expect(ok.find((m) => m.id === 3)!.status).toBe('broken');
    expect(ok.every((m) => m.raw === undefined)).toBe(true);
    expect(rows(2, 'raw_codes').map((m) => m.raw)).toEqual(machineFeed(2, at).map((x) => x.st));
    expect(rows(2, 'six_of_eight')).toHaveLength(6);
    expect(rows(2, 'broken_as_free').find((m) => m.id === 3)!.status).toBe('free');
    expect(rows(2, 'done_as_free').some((m) => m.status === 'done')).toBe(false);
    expect(rows(2, 'fetch_failed').every((m) => m.status === 'free')).toBe(true);
    const running = ok.find((m) => m.status === 'running')!;
    const t = machineFeed(2, at).find((m) => m.id === running.id)!.t;
    expect(running.minutes).toBe(Math.ceil(t / 60));
    expect(rows(2, 'minutes_wrong').find((m) => m.id === running.id)!.minutes).toBe(t);
    expect(rows(5, 'still_eight')).toHaveLength(8);
    expect(rows(5)).toHaveLength(12);
    expect(rows(5, 'new_always_free').filter((m) => m.id > 8).every((m) => m.status === 'free')).toBe(true);
  });

  it('one post about the live app on Y and one on Yowl each bring users, once per platform', async () => {
    const { s, id } = appFor('laundromat_contact', 3);
    const app = getApp(s, id)!;
    app.deployed = true;
    s.values.followers = 400;
    const before = app.users!;
    let st = (await postToY(s, wordJev, 'Built Spin Cycle Status so you can see which machines are free.', [])).state;
    const afterY = getApp(st, id)!.users!;
    expect(afterY).toBe(before + Math.round(st.values.followers * 0.15));
    st = (await postToY(st, wordJev, 'Spin Cycle Status again, still free machines.', [])).state;
    expect(getApp(st, id)!.users).toBe(afterY);
    st = (await writeReview(st, content, wordJev, 'spincycle', 4, 'Use spin-cycle-status.forkyard.app before you walk over.')).state;
    expect(getApp(st, id)!.users).toBe(afterY + 30);
    // a post that doesn't mention it does nothing
    const other = (await postToY(s, wordJev, 'Rent is due again.', [])).state;
    expect(getApp(other, id)!.users).toBe(before);
  });

  it('asking the agent starts the app and builds it, no email needed', async () => {
    const s = onDay(2);
    s.values.crypto = 100;
    const out = (await promptDone(s, content, wordJev, 'Create an app that visualizes spincycle.test/feed')).state;
    const app = out.apps.find((a) => a.template === 'laundromat')!;
    expect(app).toBeTruthy();
    expect(app.repoVersion).toBeGreaterThan(0);
    expect(app.repo.map((f) => f.id).sort()).toEqual([...app.required].sort());
    // it said nothing about the codes, so the app shows them raw
    expect(bugsOf(app.repo.find((f) => f.id === 'machines')!)).toContain('raw_codes');
    // a second prompt doesn't start another one
    const again = (await promptDone(out, content, wordJev, 'Build the Spin Cycle app again')).state;
    expect(again.apps.filter((a) => a.template === 'laundromat')).toHaveLength(1);
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
    inverted: 'Bullish and bearish are swapped in the sentiment split.',
    sarcasm_literal: 'The sentiment reads sarcastic posts literally.',
    bots_counted: 'It counts bot spam.',
    wrong_totals: 'The portfolio total is wrong, it only counts the cash and leaves out the holdings.',
    value_wrong: "The holding values are wrong, 100 times too small. It's shares times price.",
    pnl_sign: 'The day P&L has the wrong sign, gains show as losses.',
    pct_wrong: 'The percent changes are 100 times too big.',
    no_buy: "Auto-buy didn't buy when Crane praised $GAI.",
    wrong_ticker: 'Auto-buy bought the wrong ticker.',
    buys_on_criticism: 'Auto-buy fires on criticism, not just praise.',
    repeat_buys: 'Auto-buy fires again on every refresh. Only once per post.',
    impostor_buy: 'Auto-buy trusted an impostor Crane account.',
  }],
  laundromat: ['laundromat_contact', 'Spin Cycle Status: ', {
    raw_codes: 'It shows the raw ST codes. Translate them: 0 free, 1 running, 2 done, 3 out of order.',
    six_of_eight: 'It only shows 6 machines, the second page of the feed is never fetched.',
    done_as_free: 'Done machines waiting for pickup show as free.',
    broken_as_free: 'Out of order machines show as free.',
    no_refresh: 'The status never refreshes.',
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
        const out = (await promptDone(s, content, wordJev, prefix + ask)).state;
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
    // a save holding a bug that was since removed gets a current one
    getApp(s, id)!.repo[0] = { id: 'tickers', correct: false, seed: 0, variant: 'wrong_window' };
    nameUnnamedBugs(s, content);
    expect(content.apps.sentiment.features[0].bugs!.map((b) => b.id)).toContain(getApp(s, id)!.repo[0].variant);
    // and a feature that was since removed leaves the app
    const a = getApp(s, id)!;
    a.required.push('top_posts'); a.repo.push({ id: 'top_posts', correct: true }); a.features.push({ id: 'top_posts', correct: true });
    nameUnnamedBugs(s, content);
    expect([...a.required, ...a.repo.map((f) => f.id), ...a.features.map((f) => f.id)]).not.toContain('top_posts');
  });
});
