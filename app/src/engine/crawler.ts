/*
 * The sentiment crawler's data and output. The stock posts on Y (content/y_market.json, plus labelled
 * story events like Crane's $GAI praise) are the ground truth; the crawler's dashboard is computed
 * from them with the build's bugs applied, so the player can check every number against the feed.
 */
import type { GameState } from './state';
import type { Content, Mood } from '../content/schema';

export interface MarketPost {
  id: string;
  day: number;
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

/** The Y handle a display name gets (Randall Crane → randall_crane). */
export const handleOf = (from: string) => from.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'user';

/** Every stock post on Y up to today, bots expanded into their separate accounts. */
export function marketPosts(s: GameState, content: Content): MarketPost[] {
  const m = content.yMarket;
  if (!m) return [];
  const today = s.values.day;
  const out: MarketPost[] = [];
  for (const p of m.posts) {
    if (p.day > today) continue;
    const base = { day: p.day, author: p.from, text: p.body, likes: p.likes, tickers: p.tickers, mood: p.mood, literal: p.literal, crane: p.crane, impostor: p.impostor };
    if (!p.bots) { out.push({ ...base, id: p.id, handle: p.handle }); continue; }
    for (let n = 1; n <= p.bots; n++) {
      const tag = 1000 + ((n * 7919 + p.day * 131) % 9000);
      out.push({ ...base, id: `${p.id}_${n}`, handle: `${p.handle}${tag}`, author: `${p.from}${tag}`, text: p.body + (n % 3 === 0 ? '!' : ''), likes: n % 4 === 0 ? 2 : 1, bot: true });
    }
  }
  for (const l of m.events) {
    const d = s.delivered.find((x) => x.eventId === l.event);
    const e = content.events.find((x) => x.id === l.event);
    if (!d || !e || d.day > today) continue;
    out.push({ id: e.id, day: d.day, author: e.from ?? 'someone', handle: handleOf(e.from ?? 'someone'), text: e.body ?? '', likes: l.likes ?? 100, tickers: l.tickers, mood: l.mood, literal: l.literal, crane: l.crane });
  }
  return out;
}

export const TRACKED = ['GAI', 'VANT'];
/** The list the agent tracks when it gets the tickers wrong. */
const WRONG_TRACKED = ['GAI', 'VNTR'];

export interface CrawledPost { author: string; handle: string; text: string; likes: number; day: number; mood: Mood }
export interface TickerSummary { ticker: string; count: number; bullish: number; bearish: number; neutral: number; posts: CrawledPost[] }

const tagged = (p: MarketPost, t: string, bugs: Set<string>) =>
  p.tickers.includes(t) && (!bugs.has('lowercase_missed') || p.text.includes(`$${t}`));

/** The crawler's summary for `day`, as a build with these bugs computes it. */
export function crawl(posts: MarketPost[], day: number, bugs: Set<string>): TickerSummary[] {
  const tracked = bugs.has('wrong_tickers') ? WRONG_TRACKED : TRACKED;
  const kept = posts.filter((p) => p.day === day && (!p.bot || bugs.has('bots_counted')));
  return tracked.map((t) => {
    const mine = kept.filter((p) => tagged(p, t, bugs));
    const tally = { bullish: 0, bearish: 0, neutral: 0 };
    // every post it counted, with the mood it gave it
    const read: CrawledPost[] = mine.map((p) => {
      let m: Mood = bugs.has('sarcasm_literal') && p.literal ? p.literal : p.mood;
      if (bugs.has('inverted')) m = m === 'bullish' ? 'bearish' : m === 'bearish' ? 'bullish' : m;
      tally[m]++;
      return { author: p.author, handle: p.handle, text: p.text, likes: p.likes, day: p.day, mood: m };
    }).sort((a, b) => b.likes - a.likes);
    const pct = (n: number) => (mine.length ? Math.round((n / mine.length) * 100) : 0);
    return { ticker: t, count: mine.length, bullish: pct(tally.bullish), bearish: pct(tally.bearish), neutral: pct(tally.neutral), posts: read };
  });
}

// ── portfolio and auto-buy (the trader's day 3 update) ──

const BASE_PRICE: Record<string, number> = { GAI: 140, VANT: 48 };
export const START_PORTFOLIO = { cash: 1_850_000, holdings: { GAI: 42_000, VANT: 95_000 } as Record<string, number> };
const BUY_SHARES = 2_000;

/** A ticker's closing price on a day: a small deterministic walk, so today's change is never zero. */
export function price(t: string, day: number): number {
  let p = BASE_PRICE[t] ?? 10;
  for (let d = 2; d <= day; d++) {
    const h = ((d * 2654435761 + t.charCodeAt(0) * 97 + t.length * 13) >>> 0) % 1000;
    p *= 1 + ((h / 1000) - 0.45) * 0.06;
  }
  return Math.round(p * 100) / 100;
}

export interface Buy { day: number; ticker: string; shares: number; price: number; post: MarketPost }

/** What the auto-buy bought by `day`. It should buy once per genuine Crane praise, the right ticker. */
export function autoBuys(posts: MarketPost[], day: number, bugs: Set<string>): Buy[] {
  if (bugs.has('no_buy')) return [];
  const out: Buy[] = [];
  let cash = START_PORTFOLIO.cash;
  for (const p of posts.filter((x) => x.crane && x.day <= day).sort((a, b) => a.day - b.day)) {
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
      out.push({ day: p.day, ticker: t, shares: BUY_SHARES, price: px, post: p });
    }
  }
  return out;
}

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
  // percentages multiplied by 100 twice
  const pctScale = bugs.has('pct_wrong') ? 100 : 1;
  const holdings = Object.entries(held).map(([ticker, shares]) => {
    const px = price(ticker, day), move = px - price(ticker, Math.max(1, day - 1));
    // value in cents divided by 100 once too often; P&L with the sign flipped
    const value = shares * px / (bugs.has('value_wrong') ? 100 : 1);
    const dayPnl = shares * move * (bugs.has('pnl_sign') ? -1 : 1);
    return { ticker, shares, price: px, move, movePct: (move / (px - move)) * pctScale, value, dayPnl };
  });
  // the totals add up the figures as shown, so only the buggy calculation itself is off
  const stocks = holdings.reduce((a, h) => a + h.value, 0);
  const change = holdings.reduce((a, h) => a + h.dayPnl, 0);
  // the total leaves the holdings out and shows only the cash
  const total = bugs.has('wrong_totals') ? cash : stocks + cash;
  const changePct = (change / (total - change || 1)) * pctScale;
  return { cash, holdings, total, change, changePct };
}
