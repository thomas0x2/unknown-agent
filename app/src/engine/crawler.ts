/*
 * The vibe check's data and output. The stock posts on Y (content/y_market.json, plus labelled
 * story events like Crane's $GAI praise) are the ground truth; the crawler's dashboard is computed
 * from them with the build's bugs applied, so the player can check every number against the feed.
 */
import type { GameState } from './state';
import type { Content, Mood } from '../content/schema';
import { posted, postMin } from './events';
import { CLOCK } from './config';

export interface MarketPost {
  id: string;
  day: number;
  /** Minutes since midnight when it went up. */
  min?: number;
  author: string;
  handle: string;
  text: string;
  likes: number;
  tickers: string[];
  mood: Mood;
  literal?: Mood;
  bot?: boolean;
  crane?: 'praise' | 'criticism';
  impostor?: boolean;
}

/** Accounts whose handle isn't their display name in snake case. */
const Y_HANDLES: Record<string, string> = { 'Wade Tillman': 'wade_awake', 'Brynn LeClaire': 'brynnleclaire', 'Dr. Adam Hoberman': 'dr_hoberman' };
/** The Y handle a display name gets (Randall Crane → randall_crane). */
export const handleOf = (from: string) => Y_HANDLES[from] ?? (from.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'user');

/** Bot swarms wait this long after the player takes deskjockey's job, and never go up after `last`. */
export const SWARM = { delay: 30, last: 19 * 60 };

/**
 * When a bot swarm goes up, or null if it never does. The swarms only start once the player has
 * taken deskjockey's job: one written for an earlier day never posts, one due less than
 * SWARM.delay minutes after the job was taken waits until then, and one that would then land after
 * SWARM.last goes up the next day at its written time instead.
 */
export function swarmSlot(s: GameState, p: { id: string; day: number; at?: string }): { day: number; min: number } | null {
  const from = s.flagDays.trader_client;
  if (from == null || p.day < from) return null;
  const written = postMin(p, p.day);
  const start = (s.flagMins.trader_client ?? CLOCK.wake) + SWARM.delay;
  if (p.day > from || written >= start) return { day: p.day, min: written };
  return start <= SWARM.last ? { day: p.day, min: start } : { day: p.day + 1, min: written };
}

/** Every stock post on Y up to today, bots expanded into their separate accounts (only once the trader is a client). */
export function marketPosts(s: GameState, content: Content): MarketPost[] {
  const m = content.yMarket;
  if (!m) return [];
  const today = s.values.day;
  const out: MarketPost[] = [];
  for (const p of m.posts) {
    const slot = p.bots ? swarmSlot(s, p) : { day: p.day, min: postMin(p, p.day) };
    if (!slot) continue;
    const { day, min } = slot;
    // today's posts go up over the day; the crawler only sees what's on the timeline so far
    if (!posted(s, day, min)) continue;
    const base = { day, min, author: p.from, text: p.body, likes: p.likes, tickers: p.tickers, mood: p.mood, literal: p.literal, crane: p.crane, impostor: p.impostor };
    if (!p.bots) { out.push({ ...base, id: p.id, handle: p.handle }); continue; }
    for (let n = 1; n <= p.bots; n++) {
      const tag = 1000 + ((n * 7919 + p.day * 131) % 9000); // by the written day, so a late swarm keeps its handles
      out.push({ ...base, id: `${p.id}_${n}`, handle: `${p.handle}${tag}`, author: `${p.from}${tag}`, text: p.body + (n % 3 === 0 ? '!' : ''), likes: n % 4 === 0 ? 2 : 1, bot: true });
    }
  }
  for (const l of m.events) {
    const d = s.delivered.find((x) => x.eventId === l.event);
    const e = content.events.find((x) => x.id === l.event);
    if (!d || !e || d.day > today) continue;
    out.push({ id: e.id, day: d.day, min: d.min, author: e.from ?? 'someone', handle: handleOf(e.from ?? 'someone'), text: e.body ?? '', likes: l.likes ?? 100, tickers: l.tickers, mood: l.mood, literal: l.literal, crane: l.crane });
  }
  return out;
}

export const TRACKED = ['GAI', 'VANT'];
/** The tickers a build tracks, from its spec ("$GAI $VANT", later "$GAI $VANT $APO $DISH"). */
export const trackedOf = (spec?: string | number) => String(spec ?? '').toUpperCase().match(/[A-Z]+/g) ?? TRACKED;
/** The list the agent tracks when it gets the tickers wrong: Vantor under a ticker that doesn't exist. */
const wrongTracked = (tracked: string[]) => tracked.map((t) => (t === 'VANT' ? 'VNTR' : t));

export interface CrawledPost { author: string; handle: string; text: string; likes: number; day: number; mood: Mood }
export interface TickerSummary { ticker: string; count: number; bullish: number; bearish: number; neutral: number; posts: CrawledPost[] }

const tagged = (p: MarketPost, t: string, bugs: Set<string>) =>
  p.tickers.includes(t) && (!bugs.has('lowercase_missed') || p.text.includes(`$${t}`));

/** The mood the classifier gives a post, as a build with these bugs reads it. */
export function readMood(p: MarketPost, bugs: Set<string>): Mood {
  const m: Mood = bugs.has('sarcasm_literal') && p.literal ? p.literal : p.mood;
  if (!bugs.has('inverted')) return m;
  return m === 'bullish' ? 'bearish' : m === 'bearish' ? 'bullish' : m;
}

/** The crawler's summary for `day`, as a build with these bugs computes it. */
export function crawl(posts: MarketPost[], day: number, bugs: Set<string>, tickers: string[] = TRACKED): TickerSummary[] {
  const tracked = bugs.has('wrong_tickers') ? wrongTracked(tickers) : tickers;
  const kept = posts.filter((p) => p.day === day && (!p.bot || bugs.has('bots_counted')));
  return tracked.map((t) => {
    const mine = kept.filter((p) => tagged(p, t, bugs));
    const tally = { bullish: 0, bearish: 0, neutral: 0 };
    // every post it counted, with the mood it gave it
    const read: CrawledPost[] = mine.map((p) => {
      const m = readMood(p, bugs);
      tally[m]++;
      return { author: p.author, handle: p.handle, text: p.text, likes: p.likes, day: p.day, mood: m };
    }).sort((a, b) => b.likes - a.likes);
    const pct = (n: number) => (mine.length ? Math.round((n / mine.length) * 100) : 0);
    return { ticker: t, count: mine.length, bullish: pct(tally.bullish), bearish: pct(tally.bearish), neutral: pct(tally.neutral), posts: read };
  });
}

// ── the market, the trader's book and the auto-buy (the trader's day 3 update) ──

// DISH, HALD, APO and PDUR aren't in the trader's portfolio; Sherwood (engine/stocks.ts) quotes all six
const BASE_PRICE: Record<string, number> = { GAI: 140, VANT: 48, DISH: 31, HALD: 22, APO: 212, PDUR: 58 };
export const START_PORTFOLIO = { cash: 1_850_000, holdings: { GAI: 42_000, VANT: 95_000 } as Record<string, number> };
const BUY_SHARES = 2_000;

/**
 * The market script: every ticker's move on each day 1 to 21, as fractions of the day before's close.
 * Nothing is random: each move follows what the Y posts say that day (day 1 $GAI's "almost escaped"
 * pop, day 2 $VANT's 8% on the layoffs and $DISH's 7% on its escaped robot, day 4 agent-2 and
 * Crane's $VANT criticism, days 12 and 19 agent-3 and agent-4, day 10 the Apogee rocket coming apart and $APO going up, day 15 the
 * DoorDish strike, day 19 the Vantor lawsuit...).
 * A "flat" day still moves a little, so today's change is never zero.
 */
export const MARKET_SCRIPT: Record<string, number[]> = {
  GAI: [0.04, 0.012, 0.008, 0.06, 0.009, 0.025, 0.001, 0.011, 0.013, 0.018, 0.004, 0.05, -0.016, 0.017, 0.022, -0.035, -0.004, 0.012, 0.07, 0.003, 0.019, 0.021, -0.014, 0.008, 0.006, 0.011, 0.001, 0.024],
  VANT: [0.02, 0.059, 0.006, -0.014, 0.009, -0.002, 0.003, -0.004, 0.002, -0.011, -0.018, 0.006, 0.014, 0.001, -0.04, -0.06, 0.01, -0.012, -0.03, -0.004, -0.016, -0.022, 0.003, 0.001, -0.005, -0.027, -0.001, -0.019],
  // day 2: DoorDish's delivery robot "escapes" (day 4: still missing, still up)
  DISH: [0.011, 0.07, 0.004, 0.012, -0.012, 0.005, -0.003, 0.001, -0.008, 0.012, -0.015, 0.041, 0.002, -0.019, -0.03, 0.004, 0.018, 0.009, -0.011, -0.009, 0.004, 0.002, 0.003, -0.002, 0.007, 0.001, 0.001, 0.006],
  // day 10: an Apogee rocket comes apart on launch, and the stock goes up
  APO: [0.008, 0.015, -0.004, 0.012, 0.006, -0.009, 0.011, 0.004, 0.021, 0.064, -0.022, 0.014, 0.027, -0.012, 0.019, 0.011, 0.001, 0.016, 0.03, 0.006, 0.004, 0.009, 0.005, 0.018, 0.003, 0.022, 0.012, 0.025],
  // nobody posts about Halden Logistics; it just slides
  // day 3 Ozempra launches (+9%), day 13 Perdure's peptide line (+5%), day 18 it settles the NoDoze MAX suits and goes up (+3%)
  PDUR: [0.006, 0.011, 0.09, 0.018, 0.007, -0.004, 0.012, 0.009, -0.006, 0.004, 0.014, -0.003, 0.05, 0.008, -0.011, 0.006, -0.018, 0.03, 0.005, 0.003, -0.002, 0.004, 0.001, -0.003, 0.024, 0.002, 0.002, 0.009],
  HALD: [-0.004, -0.007, 0.002, -0.011, -0.003, 0.001, -0.006, -0.002, -0.009, 0.003, -0.005, -0.001, -0.008, 0.002, -0.004, -0.012, 0.001, -0.003, -0.006, -0.002, -0.004, 0.001, -0.007, -0.003, 0.002, -0.005, 0.002, -0.001],
};

/** A ticker's closing price on a day (day 0 is the close before the game starts), from the market script. */
export function price(t: string, day: number): number {
  let p = BASE_PRICE[t] ?? 10;
  for (let d = 1; d <= day; d++) p *= 1 + (MARKET_SCRIPT[t]?.[d - 1] ?? 0);
  return Math.round(p * 100) / 100;
}

/**
 * The trader's own trades, by hand, on the news: each goes in right after the Y post it reacts to,
 * at that day's price. They're real money, so they move the portfolio whatever the bot's bugs are.
 */
export const TRADER_TRADES: { post: string; ticker: string; shares: number }[] = [
  { post: 'm2_vant_restructure', ticker: 'VANT', shares: 10_000 },
  { post: 'm4_vant_crane', ticker: 'VANT', shares: -25_000 },
  { post: 'm9_apo_launch', ticker: 'APO', shares: 3_000 },
  { post: 'm10_dish_tips', ticker: 'DISH', shares: 6_000 },
  { post: 'm11_vant_sell', ticker: 'VANT', shares: -30_000 },
  { post: 'm12_dish_earn', ticker: 'DISH', shares: 4_000 },
  { post: 'm15_dish_strike', ticker: 'DISH', shares: -6_000 },
  { post: 'm16_vant', ticker: 'VANT', shares: -20_000 },
  { post: 'm19_gai_level4', ticker: 'GAI', shares: 3_000 },
  { post: 'm19_apo_launch2', ticker: 'APO', shares: 2_000 },
];

/** A trade in the book. `post` is the Crane post the bot bought on, or the news the trader traded on. */
export interface Buy { day: number; min?: number; ticker: string; shares: number; price: number; post: MarketPost; manual?: boolean }

/**
 * Every trade in the book by `day`, oldest first: the trader's own trades on the news and the bot's
 * buys. The bot buys the moment Crane praises a $ticker (once per post), at that day's price; each bug
 * buys differently. Neither side spends cash the book doesn't have.
 */
export function ledger(posts: MarketPost[], day: number, bugs: Set<string>): Buy[] {
  const out: Buy[] = [];
  let cash = START_PORTFOLIO.cash;
  const held: Record<string, number> = { ...START_PORTFOLIO.holdings };
  const at = (p: MarketPost) => p.day * 10_000 + (p.min ?? 0);
  for (const p of posts.filter((x) => x.day <= day).sort((a, b) => at(a) - at(b))) {
    for (const m of TRADER_TRADES.filter((x) => x.post === p.id)) {
      const px = price(m.ticker, p.day);
      const shares = m.shares < 0 ? -Math.min(-m.shares, held[m.ticker] ?? 0) : m.shares;
      if (!shares || cash < px * shares) continue;
      cash -= px * shares;
      held[m.ticker] = (held[m.ticker] ?? 0) + shares;
      out.push({ day: p.day, min: p.min, ticker: m.ticker, shares, price: px, post: p, manual: true });
    }
    if (!p.crane || bugs.has('no_buy')) continue;
    const fires = (p.crane === 'praise' && !p.impostor) || (p.crane === 'criticism' && bugs.has('buys_on_criticism')) || (p.impostor && bugs.has('impostor_buy'));
    if (!fires || !p.tickers.length) continue;
    const real = p.tickers[0];
    const t = bugs.has('wrong_ticker') ? TRACKED[(TRACKED.indexOf(real) + 1) % TRACKED.length] : real;
    // on every refresh (every 15 minutes) instead of once: it keeps buying until the cash runs out
    const times = bugs.has('repeat_buys') ? 40 : 1;
    for (let i = 0; i < times; i++) {
      const px = price(t, p.day);
      if (cash < px * BUY_SHARES) break;
      cash -= px * BUY_SHARES;
      held[t] = (held[t] ?? 0) + BUY_SHARES;
      out.push({ day: p.day, min: p.min, ticker: t, shares: BUY_SHARES, price: px, post: p });
    }
  }
  return out;
}

/** What the auto-buy bought by `day`: the bot's trades in the book. */
export const autoBuys = (posts: MarketPost[], day: number, bugs: Set<string>): Buy[] => ledger(posts, day, bugs).filter((b) => !b.manual);

/**
 * `move` is the market's price change since yesterday's close, straight from the quote (bugs don't
 * touch it). Percentages are fractions (0.01 is 1%). Each calculation has its own bug, and each is
 * far enough off to see at a glance.
 */
export interface Holding { ticker: string; shares: number; price: number; move: number; movePct: number; value: number; dayPnl: number }
export interface Portfolio { cash: number; holdings: Holding[]; total: number; change: number; changePct: number }

export function portfolio(buys: Buy[], day: number, bugs: Set<string>): Portfolio {
  const held = { ...START_PORTFOLIO.holdings };
  let cash = START_PORTFOLIO.cash;
  for (const b of buys) { held[b.ticker] = (held[b.ticker] ?? 0) + b.shares; cash -= b.shares * b.price; }
  // a position sold off entirely leaves the table
  for (const t of Object.keys(held)) if (!held[t]) delete held[t];
  // percentages multiplied by 100 twice
  const pctScale = bugs.has('pct_wrong') ? 100 : 1;
  const holdings = Object.entries(held).map(([ticker, shares]) => {
    const move = price(ticker, day) - price(ticker, day - 1);
    // the price comes from a quote cached on the first fetch and never refreshed (Sherwood has the real one)
    const px = price(ticker, bugs.has('stale_prices') ? 0 : day);
    // value in cents divided by 100 once too often; P&L with the sign flipped
    const value = shares * px / (bugs.has('value_wrong') ? 100 : 1);
    const dayPnl = shares * move * (bugs.has('pnl_sign') ? -1 : 1);
    return { ticker, shares, price: px, move, movePct: (move / (price(ticker, day) - move)) * pctScale, value, dayPnl };
  });
  // the totals add up the figures as shown, so only the buggy calculation itself is off
  const stocks = holdings.reduce((a, h) => a + h.value, 0);
  const change = holdings.reduce((a, h) => a + h.dayPnl, 0);
  // the total leaves the holdings out and shows only the cash
  const total = bugs.has('wrong_totals') ? cash : stocks + cash;
  const changePct = (change / (total - change || 1)) * pctScale;
  return { cash, holdings, total, change, changePct };
}

// ── the auto-trade log: every Crane post the bot read, and what it did ──

/**
 * Everything posted as Randall Crane so far, oldest first: his daily posts, his stock posts and the
 * lookalike account. Posts without a $ticker carry no stock signal, so they read neutral.
 */
export function cranePosts(s: GameState, content: Content): MarketPost[] {
  const out = marketPosts(s, content).filter((p) => p.crane);
  for (const d of s.delivered) {
    const e = content.events.find((x) => x.id === d.eventId);
    if (d.site !== 'y' || !e || e.from !== 'Randall Crane' || d.day > s.values.day || out.some((p) => p.id === e.id)) continue;
    out.push({ id: e.id, day: d.day, min: d.min, author: e.from, handle: handleOf(e.from), text: e.body ?? '', likes: 0, tickers: [], mood: 'neutral' });
  }
  return out.sort((a, b) => a.day - b.day || (a.min ?? 0) - (b.min ?? 0));
}

export interface TradeLogRow { post: MarketPost; mood: Mood; buys: Buy[] }

/** One row per Crane post: the mood the classifier read and the buys the bot placed on it (none is no action). */
export function tradeLog(crane: MarketPost[], buys: Buy[], bugs: Set<string>): TradeLogRow[] {
  return crane.map((post) => ({ post, mood: readMood(post, bugs), buys: buys.filter((b) => b.post.id === post.id) }));
}
