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

export interface TopPost { author: string; handle: string; text: string; likes: number }
export interface CrawledPost extends TopPost { day: number; mood: Mood }
export interface TickerSummary { ticker: string; count: number; bullish: number; bearish: number; neutral: number; top: TopPost[]; posts: CrawledPost[] }

// what an agent writes when it can't be bothered to look up the real posts
const INVENTED: Record<string, TopPost[]> = {
  GAI: [
    { author: 'GAI Insider', handle: 'gai_insider_daily', text: '$GAI insiders say the next model is "beyond anything we imagined."', likes: 18400 },
    { author: 'Wall St Whale', handle: 'wallst_whale_official', text: 'Just added another 50,000 shares of $GAI.', likes: 9200 },
    { author: 'TechAlpha', handle: 'techalpha_signals', text: '$GAI price target raised to 900 by every analyst at once.', likes: 7700 },
  ],
  VANT: [
    { author: 'Vantor Watch', handle: 'vantorwatch_news', text: '$VANT announces record profits and free lunches for all remaining staff.', likes: 11300 },
    { author: 'Dividend King', handle: 'dividend_king_real', text: '$VANT is the safest stock of the decade.', likes: 6400 },
    { author: 'MarketPulse', handle: 'marketpulse_live', text: '$VANT to acquire General AI, sources say.', likes: 5100 },
  ],
};

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
    const top = bugs.has('hallucinated_posts') ? (INVENTED[t] ?? INVENTED.GAI)
      : mine.slice().sort((a, b) => b.likes - a.likes).slice(0, 3).map(({ author, handle, text, likes }) => ({ author, handle, text, likes }));
    return { ticker: t, count: mine.length, bullish: pct(tally.bullish), bearish: pct(tally.bearish), neutral: pct(tally.neutral), top, posts: read };
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

/** `move` is the market's price change since yesterday's close, straight from the quote (bugs don't touch it). */
export interface Holding { ticker: string; shares: number; price: number; move: number; value: number; dayPnl: number }
export interface Portfolio { cash: number; holdings: Holding[]; total: number; change: number }

export function portfolio(buys: Buy[], day: number, bugs: Set<string>): Portfolio {
  const held = { ...START_PORTFOLIO.holdings };
  let cash = START_PORTFOLIO.cash;
  if (!bugs.has('stale_after_buy')) for (const b of buys) { held[b.ticker] = (held[b.ticker] ?? 0) + b.shares; cash -= b.shares * b.price; }
  const holdings = Object.entries(held).map(([ticker, shares]) => {
    const px = price(ticker, day), move = px - price(ticker, Math.max(1, day - 1));
    return { ticker, shares, price: px, move, value: shares * px, dayPnl: shares * move };
  });
  const stocks = holdings.reduce((a, h) => a + h.value, 0);
  // today's change; the bug shows the change since the account was opened (day 1 prices)
  const change = holdings.reduce((a, h) => a + h.shares * (h.price - price(h.ticker, bugs.has('change_wrong') ? 1 : day - 1)), 0);
  // the classic: cash added to the total twice
  const total = stocks + cash * (bugs.has('wrong_totals') ? 2 : 1);
  return { cash, holdings, total, change };
}
