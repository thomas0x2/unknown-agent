/*
 * The vibe check (day 4) and Spin Cycle Board (day 2): their output is computed from real data (the
 * stock posts on Y, the raw machine feed), each failure from the day plans is a named bug that shows
 * up in that output, and naming the bug in a fix prompt fixes it.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { postToY, writeReview, briefFix } from '../engine/actions';
import { applyEffects } from '../engine/effects';
import { getApp, nameUnnamedBugs, bugsOf } from '../engine/apps';
import { marketPosts, cranePosts, tradeLog, crawl, autoBuys, ledger, portfolio, price, trackedOf, START_PORTFOLIO, MARKET_SCRIPT, TRADER_TRADES } from '../engine/crawler';
import { machineFeed, machineRows } from '../engine/laundromat';
import type { GameState } from '../engine/state';
import { wordJev, promptDone } from '../engine/_fixtures';
import { CLOCK } from '../engine/config';

const content = loadContent();

function onDay(day: number): GameState {
  const s = startGame(content, 7);
  s.values.day = day;
  s.clockMin = CLOCK.sleep - 1; // late in the day, once all of today's posts are up
  s.flagDays.trader_client = 1; // the bot swarms only post once the trader is a client
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
  it('day 4 has a 30-account bot swarm, and every day has fresh posts', () => {
    const posts = marketPosts(onDay(4), content);
    expect(posts.filter((p) => p.bot && p.day === 4)).toHaveLength(30);
    expect(new Set(posts.filter((p) => p.bot).map((p) => p.handle)).size).toBe(30);
    expect(posts.some((p) => /nova/i.test(p.text))).toBe(false);
    const all = marketPosts(onDay(28), content);
    // only a few before deskjockey's job (day 4), so the first days stay quiet
    for (let d = 1; d <= 28; d++) expect(all.filter((p) => p.day === d && !p.bot).length, `day ${d}`).toBeGreaterThanOrEqual(d < 4 ? 1 : 2);
  });
  it("the bot swarms only post from the day the player takes the trader's job", () => {
    const s = onDay(6);
    delete s.flagDays.trader_client;
    expect(marketPosts(s, content).some((p) => p.bot)).toBe(false);
    s.flagDays.trader_client = 4;
    const days = new Set(marketPosts(s, content).filter((p) => p.bot).map((p) => p.day));
    expect([...days].sort()).toEqual([4, 6]);
  });
  it('a $GAI post is already on Y when day 1 starts', () => {
    const s = startGame(content);
    expect(marketPosts(s, content).some((p) => p.day === 1 && p.tickers.includes('GAI'))).toBe(true);
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

describe('vibe check', () => {
  const posts = marketPosts(onDay(4), content);

  it('built right: today, $-tagged, no bots, sarcasm read as bearish, every counted post', () => {
    const r = crawl(posts, 4, bugs());
    expect(row(r, 'GAI')).toMatchObject({ count: 2, bullish: 100, bearish: 0, neutral: 0 });
    expect(row(r, 'VANT')).toMatchObject({ count: 2, bullish: 0, neutral: 0, bearish: 100 });
    expect(r.map((x) => x.ticker)).toEqual(['GAI', 'VANT']);
    expect(row(r, 'VANT').posts[0].handle).toBe('randall_crane');
  });

  it('each bug shows up in the numbers', () => {
    expect(row(crawl(posts, 4, bugs('bots_counted')), 'GAI').count).toBe(32);
    expect(row(crawl(posts, 4, bugs('sarcasm_literal')), 'VANT').bullish).toBe(50);
    expect(row(crawl(posts, 4, bugs('inverted')), 'GAI')).toMatchObject({ bullish: 0, bearish: 100 });
    expect(row(crawl(posts, 4, bugs('lowercase_missed')), 'GAI').count).toBe(1);
    expect(crawl(posts, 4, bugs('wrong_tickers')).map((r) => r.ticker)).toContain('VNTR');
  });

  it('lists every crawled post with the mood it read, bugs included', () => {
    const ok = row(crawl(posts, 4, bugs()), 'VANT');
    expect(ok.posts).toHaveLength(ok.count);
    expect(row(crawl(posts, 4, bugs('bots_counted')), 'GAI').posts.filter((p) => /\d{4}$/.test(p.handle)).length).toBe(30);
    const sarcastic = posts.find((p) => p.literal && p.tickers.includes('VANT'))!;
    expect(ok.posts.find((p) => p.handle === sarcastic.handle)!.mood).toBe(sarcastic.mood);
    expect(row(crawl(posts, 4, bugs('sarcasm_literal')), 'VANT').posts.find((p) => p.handle === sarcastic.handle)!.mood).toBe(sarcastic.literal);
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

  it("the auto-trade log lists every Crane post with the classifier's mood and the bot's action", () => {
    const s = onDay(6);
    // Crane's daily posts, as delivered on their day
    for (const e of content.events.filter((x) => x.site === 'y' && x.from === 'Randall Crane' && x.trigger.dayMin! <= 6 && !s.delivered.some((d) => d.eventId === x.id))) {
      s.delivered.push({ eventId: e.id, site: e.site, day: e.trigger.dayMin!, min: 600, answered: false } as GameState['delivered'][number]);
    }
    const all = marketPosts(s, content);
    const crane = cranePosts(s, content);
    const log = (...b: string[]) => tradeLog(crane, autoBuys(all, 6, bugs(...b)), bugs(...b));
    const byId = (rows: ReturnType<typeof log>, id: string) => rows.find((r) => r.post.id === id)!;
    // one post a day, plus the $VANT criticism (day 4) and the lookalike account (day 5)
    expect(crane.map((p) => p.day)).toEqual([1, 2, 3, 4, 5, 5, 6]);
    expect(crane.find((p) => p.impostor)!.handle).toBe('randa11_crane');
    const ok = log();
    expect(ok.filter((r) => r.buys.length).map((r) => r.post.id)).toEqual(['d6_y_crane_gai']);
    expect(byId(ok, 'd6_y_crane_gai').mood).toBe('bullish');
    expect(byId(ok, 'm4_vant_crane').mood).toBe('bearish');
    expect(byId(ok, 'd1_y_crane').mood).toBe('neutral');
    // each bug shows up as a row that doesn't add up
    expect(byId(log('no_buy'), 'd6_y_crane_gai').buys).toHaveLength(0);
    expect(byId(log('wrong_ticker'), 'd6_y_crane_gai').buys[0].ticker).toBe('VANT');
    expect(byId(log('buys_on_criticism'), 'm4_vant_crane').buys).toHaveLength(1);
    expect(byId(log('impostor_buy'), 'm5_vant_impostor').buys).toHaveLength(1);
    expect(byId(log('repeat_buys'), 'd6_y_crane_gai').buys.length).toBeGreaterThan(1);
    expect(byId(log('inverted'), 'm4_vant_crane').mood).toBe('bullish');
    // posts with no $ticker never trade, whatever the bugs
    expect(log('buys_on_criticism', 'impostor_buy', 'repeat_buys').filter((r) => !r.post.tickers.length).every((r) => !r.buys.length)).toBe(true);
  });

  it('prices match the posts: both up on days 1 to 3, $VANT up about 8% since the restructuring by day 2', () => {
    for (const d of [1, 2, 3]) for (const h of portfolio([], d, bugs()).holdings) expect(h.move, `${h.ticker} day ${d}`).toBeGreaterThan(0);
    expect(price('VANT', 2) / price('VANT', 0) - 1).toBeCloseTo(0.08, 2);
    expect(price('VANT', 2) - price('VANT', 1)).toBeGreaterThan(price('VANT', 1) - price('VANT', 0));
  });

  it('the market follows a fixed script: every move is written down, the ones the posts quote match', () => {
    for (const [t, moves] of Object.entries(MARKET_SCRIPT)) {
      expect(moves, t).toHaveLength(28);
      for (let d = 1; d <= 28; d++) {
        expect(price(t, d) / price(t, d - 1) - 1, `${t} day ${d}`).toBeCloseTo(moves[d - 1], 3);
        expect(moves[d - 1], `${t} day ${d} never flat`).not.toBe(0);
      }
    }
    // what the headlines say, to the percent
    const said: [string, number, number][] = [['GAI', 4, 0.06], ['GAI', 9, 0.05], ['GAI', 14, 0.07], ['APO', 9, 0.02], ['APO', 10, 0.06], ['APO', 19, 0.03], ['DISH', 15, -0.03], ['PDUR', 3, 0.09], ['PDUR', 13, 0.05], ['PDUR', 18, 0.03], ['VANT', 17, 0.01], ['VANT', 19, -0.03]];
    for (const [t, d, m] of said) expect(price(t, d) / price(t, d - 1) - 1, `${t} day ${d}`).toBeCloseTo(m, 2);
    // and the same day gives the same price every time
    expect(price('GAI', 12)).toBe(price('GAI', 12));
  });

  it('the trader trades on the news himself: each trade right after its post, whatever the bot does', () => {
    const all = marketPosts(onDay(28), content);
    for (const b of [bugs(), bugs('no_buy'), bugs('wrong_ticker')]) {
      const manual = ledger(all, 28, b).filter((x) => x.manual);
      expect(manual.map((x) => x.post.id)).toEqual(TRADER_TRADES.map((x) => x.post));
      for (const x of manual) expect(x.price).toBe(price(x.ticker, x.post.day));
    }
    // a trade waits for its post: the $VANT sell on Crane's criticism isn't in before day 4
    expect(ledger(marketPosts(onDay(3), content), 3, bugs()).filter((x) => x.manual).map((x) => x.post.id)).toEqual(['m2_vant_restructure']);
    // he picks up $APO and $DISH once he tracks them, and never sells more than he holds
    const pf = portfolio(ledger(all, 28, bugs()), 28, bugs());
    expect(pf.holdings.map((h) => h.ticker).sort()).toEqual(['APO', 'DISH', 'GAI', 'VANT']);
    for (const h of pf.holdings) expect(h.shares).toBeGreaterThan(0);
    expect(pf.cash).toBeGreaterThan(0);
  });

  it('the auto-buy buys the moment Crane praises a $ticker, and only then', () => {
    const all = marketPosts(onDay(28), content);
    const buys = autoBuys(all, 28, bugs());
    expect(buys.map((b) => [b.day, b.ticker])).toEqual([[6, 'GAI']]);
    expect(buys[0].post.crane).toBe('praise');
    for (const b of buys) expect(b.min).toBe(b.post.min);
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

  it("stale prices don't match Sherwood's quotes on any day", () => {
    for (let d = 2; d <= 28; d++) {
      // the whole book, the trader's own $APO and $DISH included
      const buys = ledger(marketPosts(onDay(d), content), d, bugs());
      for (const h of portfolio(buys, d, bugs()).holdings) expect(h.price, `day ${d}`).toBe(price(h.ticker, d));
      // a quick look at the price column is enough: every ticker is off by over 2%
      for (const h of portfolio(buys, d, bugs('stale_prices')).holdings) expect(Math.abs(h.price / price(h.ticker, d) - 1), `day ${d} ${h.ticker}`).toBeGreaterThan(0.02);
    }
  });
});

describe('Spin Cycle Board', () => {
  const steps = (from = 10 * 60) => Array.from({ length: (24 * 60 - from) / 30 }, (_, k) => from + k * 30);

  it('the feed: 8 machines, 12 from day 5, M3 always out of order', () => {
    expect(machineFeed(2)).toHaveLength(8);
    expect(machineFeed(5)).toHaveLength(12);
    for (let d = 1; d <= 28; d++) for (const m of steps(7 * 60)) expect(machineFeed(d, m).find((x) => x.id === 3)!.st).toBe(3);
  });

  it('done-as-free and broken-as-free can always be caught: a done and an out-of-order machine on page one, all day', () => {
    for (let d = 1; d <= 28; d++) {
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
    let st = (await postToY(s, wordJev, 'Built Spin Cycle Board so you can see which machines are free.', [])).state;
    const afterY = getApp(st, id)!.users!;
    expect(afterY).toBe(before + Math.round(st.values.followers * 0.15));
    st = (await postToY(st, wordJev, 'Spin Cycle Board again, still free machines.', [])).state;
    expect(getApp(st, id)!.users).toBe(afterY);
    st = (await writeReview(st, content, wordJev, 'spincycle', 4, 'Use spin-cycle-board.forkyard.app before you walk over.')).state;
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
  sentiment: ['trader_contact', 'Vibe Check: ', {
    wrong_tickers: 'The crawler tracks the wrong tickers.',
    lowercase_missed: 'It misses lowercase tickers like $gai.',
    inverted: 'Bullish and bearish are swapped in the sentiment split.',
    sarcasm_literal: 'The sentiment reads sarcastic posts literally.',
    bots_counted: "The bot filter doesn't work, it counts bot spam.",
    wrong_totals: 'The portfolio total is wrong, it only counts the cash and leaves out the holdings.',
    value_wrong: "The portfolio holding values are wrong, 100 times too small. It's shares times price.",
    pnl_sign: 'The portfolio P&L has the wrong sign, gains show as losses.',
    pct_wrong: 'The portfolio percent changes are 100 times too big.',
    stale_prices: "The portfolio holding prices don't match Sherwood. They never update.",
    no_buy: "Auto-buy didn't buy when Crane praised $GAI.",
    wrong_ticker: 'Auto-buy bought the wrong ticker.',
    buys_on_criticism: 'Auto-buy fires on criticism, not just praise.',
    repeat_buys: 'Auto-buy fires again on every refresh. Only once per post.',
    impostor_buy: 'Auto-buy trusted an impostor Crane account.',
  }],
  laundromat: ['laundromat_contact', 'Spin Cycle Board: ', {
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

describe("the trader's two more tickers (day 8)", () => {
  function updated() {
    const { s, id } = appFor('trader_contact', 10);
    const app = getApp(s, id)!;
    app.features = app.repo.map((f) => ({ ...f }));
    app.deployed = true;
    applyEffects(s, content.events.find((e) => e.id === 'd8_trader_tickers')!.onDeliver!);
    s.values.agentLevel = 5;
    return { s, id };
  }
  const tracked = (s: GameState, id: string) => trackedOf(getApp(s, id)!.repo.find((f) => f.id === 'tickers')!.params?.tickers);

  it('the update outdates the tracker until a prompt names the new tickers', async () => {
    const { s, id } = updated();
    expect(getApp(s, id)!.repo.find((f) => f.id === 'tickers')).toMatchObject({ correct: false, variant: 'outdated' });
    expect(tracked(s, id)).toEqual(['GAI', 'VANT']);
    const vague = (await briefFix(s, content, wordJev, id, 'Vibe Check: update the tickers like the trader asked.')).state;
    expect(getApp(vague, id)!.repo.find((f) => f.id === 'tickers')!.variant).toBe('outdated');
    const done = (await briefFix(s, content, wordJev, id, 'Vibe Check: add $APO and $DISH to the tickers it tracks.')).state;
    expect(getApp(done, id)!.repo.find((f) => f.id === 'tickers')!.correct).toBe(true);
    expect(tracked(done, id)).toEqual(['GAI', 'VANT', 'APO', 'DISH']);
  });

  it('$APO and $DISH have posts to crawl every day from the update on', () => {
    const posts = marketPosts(onDay(28), content);
    for (let d = 8; d <= 28; d++) {
      const rows = crawl(posts, d, bugs(), ['GAI', 'VANT', 'APO', 'DISH']);
      for (const t of ['APO', 'DISH']) expect(row(rows, t).count, `$${t} day ${d}`).toBeGreaterThan(0);
    }
    expect(crawl(posts, 10, bugs('wrong_tickers'), ['GAI', 'VANT', 'APO', 'DISH']).map((r) => r.ticker)).toEqual(['GAI', 'VNTR', 'APO', 'DISH']);
    expect(price('APO', 10)).toBeGreaterThan(price('APO', 9));
  });
});
