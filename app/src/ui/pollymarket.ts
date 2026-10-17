/*
 * pollymarket.com: the prediction market (Polymarket parody). The front page lists every market open
 * so far with its odds and the latest trades; pollymarket.com/<slug> opens one with its chart, rules
 * and trades. Odds and trades come from engine/pollymarket.ts. The player can't bet: there is no
 * button, only a line saying trading isn't available in their region.
 */
import type { GameStore } from '../game/store';
import type { GameState } from '../engine';
import { liveMarkets, findMarket, marketLive, oddsNow, oddsSoFar, oddsAtDayStart, resolved, volumeNow, tradesSoFar, recentTrades, stamp, dateShort, dateMedium, clockTime, type Market, type LiveTrade } from '../engine';
import { adHtml } from './ads';
import { POLLY_ICON } from './pollymarketIcon';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** 48,200,000 → "48.2M" */
function money(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`;
  return String(n);
}
const vol = (s: GameState, m: Market) => `${money(volumeNow(s, m))} DOLR vol.`;
const link = (m: Market, inner: string, cls = 'pm-a') => `<a href="#" class="${cls}" data-nav="pollymarket.com/${esc(m.slug)}">${inner}</a>`;

/** "▲ 6" / "▼ 4" since the start of today, or nothing. */
function moveToday(s: GameState, m: Market): string {
  if (resolved(s, m)) return '';
  const d = oddsNow(s, m) - oddsAtDayStart(s, m);
  if (!d || m.opens.day >= s.values.day) return '';
  return `<span class="pm-move ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)}</span>`;
}

function badge(s: GameState, m: Market): string {
  const r = resolved(s, m);
  return r ? `<span class="pm-res ${r === 'YES' ? 'yes' : 'no'}">Resolved ${r}</span>` : `<b class="pm-pct">${oddsNow(s, m)}%</b><small>chance</small>`;
}

/** The odds as a step line from the market's opening to now (or its resolution). */
function chart(s: GameState, m: Market, cls: string): string {
  const pts = oddsSoFar(s, m).map((p) => ({ t: stamp(p), p: p.p }));
  const r = resolved(s, m);
  const end = r && m.resolve ? stamp(m.resolve) : (s.values.day - 1) * 1440 + s.clockMin;
  if (r) pts.push({ t: end, p: r === 'YES' ? 100 : 0 });
  if (!pts.length) return '';
  const t0 = pts[0].t, span = Math.max(1, end - t0);
  const w = 600, h = cls === 'pm-spark' ? 44 : 220, pad = 6;
  const x = (t: number) => ((t - t0) / span) * w;
  // the card sparkline zooms to its own range; the market chart shows the full 0 to 100
  const vals = pts.map((q) => q.p);
  const [lo, hi] = cls === 'pm-spark' ? [Math.min(...vals) - 2, Math.max(...vals) + 2] : [0, 100];
  const y = (p: number) => h - pad - ((p - lo) / (hi - lo)) * (h - pad * 2);
  let d = `M0,${y(pts[0].p).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` H${x(pts[i].t).toFixed(1)} V${y(pts[i].p).toFixed(1)}`;
  d += ` H${w}`;
  const grid = cls === 'pm-chart' ? [25, 50, 75].map((g) => `<line x1="0" x2="${w}" y1="${y(g)}" y2="${y(g)}"/>`).join('') : '';
  return `<svg viewBox="0 0 ${w} ${h}" class="${cls}" preserveAspectRatio="none" aria-hidden="true"><g class="pm-gl">${grid}</g><path d="${d}"/></svg>`;
}

const when = (s: GameState, t: { day: number; at: string }) => {
  const [hh, mm] = t.at.split(':').map(Number);
  return t.day === s.values.day ? clockTime(hh * 60 + mm) : `${dateShort(t.day)}, ${clockTime(hh * 60 + mm)}`;
};

function tradeRow(s: GameState, t: LiveTrade, withMarket: boolean): string {
  return `<li class="pm-trade"><span class="pm-who">${esc(t.who)}</span>
    <span>bought <b class="pm-side ${t.side === 'YES' ? 'yes' : 'no'}">${t.side}</b> for ${t.amount.toLocaleString('en-US')} DOLR at ${t.price}¢</span>
    ${withMarket ? link(t.market, esc(t.market.title), 'pm-a pm-tm') : ''}
    <small>${esc(when(s, t))}</small></li>`;
}

const top = `<header class="pm-top"><a href="#" class="pm-logo" data-nav="pollymarket.com"><span class="pm-mark">${POLLY_ICON}</span>Pollymarket</a>
  <span class="pm-tag">The world's largest prediction market</span></header>`;
const foot = `<footer class="pm-foot">Prices are the crowd's odds, in cents. Each market resolves on the source named in its rules.</footer>`;

export function pagePollymarket(store: GameStore, param?: string): string {
  const s = store.state;
  const slug = param?.split('/')[0];
  if (slug) {
    const m = findMarket(slug);
    return `<div class="pm">${top}${m && marketLive(s, m) ? marketPage(s, m) : missing()}${foot}</div>`;
  }
  const list = liveMarkets(s);
  const cards = list.map((m) => `<article class="pm-card${resolved(s, m) ? ' done' : ''}">
      <p class="pm-cat">${esc(m.category)}</p>
      <h2>${link(m, esc(m.title))}</h2>
      <div class="pm-odds">${badge(s, m)}${moveToday(s, m)}</div>
      ${chart(s, m, 'pm-spark')}
      <p class="pm-vol">${esc(vol(s, m))}</p>
    </article>`).join('');
  const trades = recentTrades(s);
  return `<div class="pm">${top}
    <div class="pm-wrap">
      <main><h1 class="pm-h">Markets</h1><div class="pm-grid">${cards || '<p class="pm-none">No markets yet.</p>'}</div></main>
      <aside><section class="pm-box"><h3>Recent activity</h3>${trades.length ? `<ul class="pm-trades">${trades.map((t) => tradeRow(s, t, true)).join('')}</ul>` : '<p class="pm-none">No trades yet.</p>'}</section>
        ${adHtml('pollymarket', s.values.day, 'square')}</aside>
    </div>${foot}</div>`;
}

function marketPage(s: GameState, m: Market): string {
  const r = resolved(s, m);
  const yes = oddsNow(s, m);
  const trades = tradesSoFar(s, m);
  const prices = r
    ? `<p class="pm-final">This market resolved <b class="pm-side ${r === 'YES' ? 'yes' : 'no'}">${r}</b> on ${esc(dateShort(m.resolve!.day))}.</p>`
    : `<div class="pm-prices"><span class="yes">Yes <b>${yes}¢</b></span><span class="no">No <b>${100 - yes}¢</b></span></div>
       <p class="pm-region">Trading is not available in your region.</p>`;
  return `<div class="pm-wrap pm-one">
    <main>
      <p class="pm-cat">${esc(m.category)} · <a href="#" class="pm-a pm-back" data-nav="pollymarket.com">All markets</a></p>
      <h1 class="pm-title">${esc(m.title)}</h1>
      <div class="pm-odds big">${badge(s, m)}${moveToday(s, m)}</div>
      ${chart(s, m, 'pm-chart')}
      <div class="pm-axis"><span>${esc(dateShort(m.opens.day))}</span><span>${esc(r ? dateShort(m.resolve!.day) : 'Now')}</span></div>
      <p class="pm-meta">${esc(vol(s, m))} · ${r ? 'Closed' : `Ends ${esc(dateMedium(m.ends))}`}</p>
      ${prices}
      <section class="pm-rules"><h3>Rules</h3><p>${esc(m.rules)}</p></section>
    </main>
    <aside><section class="pm-box"><h3>Trades</h3>${trades.length ? `<ul class="pm-trades">${trades.map((t) => tradeRow(s, t, false)).join('')}</ul>` : '<p class="pm-none">No trades yet.</p>'}</section>
      ${adHtml('pollymarket', s.values.day, 'square')}</aside>
  </div>`;
}

function missing(): string {
  return `<div class="pm-wrap pm-one"><main><h1 class="pm-title">Market not found</h1><p>This market doesn't exist, or it hasn't opened yet.</p><p><a href="#" class="pm-a pm-back" data-nav="pollymarket.com">All markets</a></p></main></div>`;
}
