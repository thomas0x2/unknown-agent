/*
 * sherwood.com: the stock app (Robinhood parody). Six tickers, quotes from engine/crawler.price (the
 * same closes the vibe check shows), orders paid from and into the Coinbin wallet.
 */
import type { GameStore } from '../game/store';
import { STOCKS, quote, sharesOf, costOf, price, dateShort } from '../engine';
import { ICONS } from './icons';
import { adHtml } from './ads';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const num = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) => (n > -0.005 ? '+' : '−') + num(Math.abs(n));
const tone = (n: number) => (n > -0.005 ? 'pos' : 'neg');
const pct = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n * 100).toFixed(2) + '%';

/** Closes from the day before the game started up to today. */
const closes = (t: string, day: number) => Array.from({ length: day + 1 }, (_, d) => price(t, d));

function chart(vals: number[], up: boolean, cls: string): string {
  const w = 600, h = cls === 'sw-spark' ? 40 : 200, pad = cls === 'sw-spark' ? 3 : 12;
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => (i / (vals.length - 1 || 1)) * w;
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="${cls} ${up ? 'up' : 'down'}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

export function pageSherwood(store: GameStore, param?: string): string {
  const s = store.state;
  const day = s.values.day;
  const sel = STOCKS.find((x) => x.ticker.toLowerCase() === param?.toLowerCase()) ?? STOCKS[0];
  const t = sel.ticker;
  const px = quote(s, t), prev = price(t, day - 1), move = px - prev;
  const held = sharesOf(s, t);

  const invested = STOCKS.reduce((a, x) => a + sharesOf(s, x.ticker) * quote(s, x.ticker), 0);
  const gain = invested - STOCKS.reduce((a, x) => a + costOf(s, x.ticker), 0);

  const list = STOCKS.map((x) => {
    const p = quote(s, x.ticker), m = p - price(x.ticker, day - 1);
    const sh = sharesOf(s, x.ticker);
    return `<a href="#" class="sw-row${x.ticker === t ? ' on' : ''}" data-nav="sherwood.com/${x.ticker.toLowerCase()}">
      <span class="sw-tk"><b>${x.ticker}</b><small>${sh > 0 ? `${sh.toFixed(4)} shares` : esc(x.name)}</small></span>
      ${chart(closes(x.ticker, day).slice(-8), m >= 0, 'sw-spark')}
      <span class="sw-q"><b>${num(p)}</b><small class="${tone(m)}">${pct(m / (p - m))}</small></span></a>`;
  }).join('');

  const f = store.ui.sw;
  const line = f.error ? `<p class="sw-err" role="alert">${esc(f.error)}</p>`
    : f.notice ? `<p class="sw-ok" role="status">${esc(f.notice)}</p>`
    : `<p class="sw-hint">Buying power: ${num(s.values.crypto)} DOLR from Coinbin</p>`;
  const position = held > 0
    ? `<div class="sw-pos"><span><small>Your shares</small><b>${held.toFixed(4)}</b></span><span><small>Market value</small><b>${num(held * px)}</b></span><span><small>Paid</small><b>${num(costOf(s, t))}</b></span><span><small>Total return</small><b class="${tone(held * px - costOf(s, t))}">${signed(held * px - costOf(s, t))}</b></span></div>`
    : '';

  return `<div class="sw">
    <header class="sw-top"><span class="sw-logo"><span class="sw-mark">${ICONS.sherwood}</span>Sherwood</span>
      <span class="sw-acct">Investing <b>${num(invested)} DOLR</b> <small class="${tone(gain)}">${signed(gain)} total</small></span></header>
    <div class="sw-ad">${adHtml('sherwood', day, 'wide')}</div>
    <div class="sw-wrap">
      <section class="sw-main">
        <p class="sw-name">${esc(sel.name)}</p>
        <h1 class="sw-price">${num(px)} <small>DOLR</small></h1>
        <p class="sw-move ${tone(move)}">${signed(move)} (${pct(move / prev)}) <span>Today</span></p>
        ${chart(closes(t, day), move >= 0, 'sw-chart')}
        <div class="sw-axis"><span>${esc(dateShort(0))}</span><span>${esc(dateShort(day))}</span></div>
        ${position}
        <form class="sw-order" data-form="sw-trade" data-ticker="${t}" autocomplete="off">
          <h2>Trade $${t}</h2>
          <label><span>Amount</span><input id="sw-amount" inputmode="decimal" placeholder="0.00" value="${esc(f.amount)}"><small>DOLR</small></label>
          <p class="sw-est">1 share = ${num(px)} DOLR. Fractional shares allowed.</p>
          <div class="sw-btns"><button type="submit" class="sw-btn buy">Buy</button><button type="button" class="sw-btn sell" data-act="sw-sell" data-ticker="${t}">Sell</button>${held > 0 ? `<button type="button" class="sw-btn ghost" data-act="sw-sell-all" data-ticker="${t}">Sell all</button>` : ''}</div>
          ${line}
        </form>
      </section>
      <aside class="sw-side"><div class="sw-list"><h2>Stocks</h2>${list}</div>${adHtml('sherwood', day, 'square')}</aside>
    </div>
    <p class="sw-fine">Commission-free trading. Prices update at each day's close. Investing involves risk, including the loss of principal.</p>
  </div>`;
}
