/*
 * Deployed apps as real websites. Each feature renders from what was actually built: the spec's
 * params when it's right, or the concrete bug it shipped with (BuiltFeature.variant), so the player
 * finds problems by comparing the site with the client's email, not by reading a status label.
 * Templates get a renderer here; anything without one falls back to a plain generic site.
 */
import { type AppInstance, type AppBreak, type BuiltFeature, breakVariant, bugsOf, UNNAMED_BUG } from '../engine';
import type { AppTemplate } from '../content/schema';
import { menuDishes, misspell, WRONG_HOURS } from '../engine/restaurant';
import { crawl, autoBuys, portfolio, tradeLog, trackedOf, START_PORTFOLIO, type MarketPost, type Portfolio } from '../engine/crawler';
import { machineRows } from '../engine/laundromat';
import { swapListings, listedWhen, SWAP_CATEGORIES, type Listing } from '../engine/swaplist';
import { takesOffers, buyPrice, shownPrice } from '../engine/swapdeal';
import type { SwapState, DatingState } from '../engine/state';
import { dayProfiles, screen, standardsOf, datingPaused, limitUsed, feetInches, DAILY_PICKS, type Profile } from '../engine/dating';
import { adHtml } from './ads';
import { SWAP_ART } from './swapArt';
import { dateShort, clockTime } from '../engine/calendar';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** What a feature looks like on the live site right now. */
interface Live {
  built?: BuiltFeature;
  brk?: AppBreak;
  /** The bugs to render: the build's own (they stack), plus the one a subtle break shows. */
  bugs: Set<string>;
  seed: number;
  params: Record<string, string | number>;
}

function live(app: AppInstance, tmpl: AppTemplate | undefined, id: string): Live {
  const built = app.features.find((f) => f.id === id);
  const brk = app.breaks.find((b) => b.featureId === id);
  const bugs = new Set(built && !built.correct ? bugsOf(built) : []);
  const seed = brk?.seed ?? built?.seed ?? 0;
  const shown = brk && breakVariant(brk, tmpl?.features.find((f) => f.id === id));
  if (shown) bugs.add(shown);
  return { built, brk, bugs, seed, params: built?.params ?? app.specParams[id] ?? {} };
}

/** A break that takes the whole section down instead of showing wrong content. */
function outage(l: Live, what: string): string | null {
  if (l.brk?.failure === 'visible') return `<div class="as-crash"><b>Application error</b><p>A client-side exception has occurred while loading ${esc(what)}.</p></div>`;
  if (l.brk?.failure === 'failed_fetch') return `<div class="as-fetch"><p>Couldn't load ${esc(what)}.</p><code>TypeError: Failed to fetch</code></div>`;
  return null;
}

const notFound = () => `<div class="as-404"><h1>404</h1><p>This page could not be found.</p></div>`;

export interface SiteExtras {
  /** The booking form, owned by the view (it wires into Qmail). */
  booking?: string;
  /** The page a confirmation's cancel link opens. */
  cancel?: string;
  /** Today, and the stock posts on Y: what the crawler and the laundromat read. */
  day?: number;
  /** The clock, minutes since midnight: the laundry feed changes with it. */
  minute?: number;
  market?: MarketPost[];
  /** Everything posted as Randall Crane so far: what the auto-trade log lists. */
  crane?: MarketPost[];
  /** Minutes of play so far, and whether Viktor has said his watch sold: what Swaplist lists. */
  play?: number;
  watchSold?: boolean;
  /** Swaplist as a buyer: the player's chats, offers and purchases, and whether a reply is on its way. */
  swap?: SwapState;
  busy?: boolean;
  /** Matchless: every accept and reject made so far. */
  dating?: DatingState;
}

/** Logos of the apps that have one, by template: the site header and the browser tab both use them. */
const LOGO_SVG: Record<string, string> = {
  // classifieds purple: two arrows trading places
  swaplist: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#6e3fa3"/><path d="M11 15h17M24 10.5l4.5 4.5-4.5 4.5M29 25H12M16 20.5 11.5 25l4.5 4.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // a rose tile: a heart dropping through a filter funnel
  dating: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#b4234f"/><path d="M20 15.5c-1.6-3.2-6.5-2.6-6.5 1 0 2.6 3.3 4.6 6.5 7 3.2-2.4 6.5-4.4 6.5-7 0-3.6-4.9-4.2-6.5-1z" fill="#ffd3df"/><path d="M8 9h24l-8.5 11v9l-7 3V20z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
  laundromat: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="2" width="32" height="36" rx="6" fill="#2f80ed"/><rect x="8" y="6" width="24" height="5" rx="2" fill="#fff" opacity=".35"/><circle cx="20" cy="24" r="10" fill="#fff"/><circle cx="20" cy="24" r="7" fill="#9cc6f5"/><path d="M14 25c2-2 4 2 6 0s4 2 6 0" stroke="#2f80ed" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  // a dark terminal tile: a market line climbing through a crawler's scan brackets
  sentiment: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#0f1419"/><path d="M9 11V9h4M27 9h4v2M31 29v2h-4M13 31H9v-2" stroke="#3a4552" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="11" y="21" width="3" height="6" rx="1" fill="#e5484d"/><rect x="16.5" y="17" width="3" height="10" rx="1" fill="#30a46c"/><rect x="22" y="19" width="3" height="8" rx="1" fill="#e5484d"/><path d="M10 19l6.5-5 5 3 8.5-6" stroke="#4cc38a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="11" r="2.2" fill="#4cc38a"/></svg>`,
};
export const appLogo = (template: string): string | undefined => LOGO_SVG[template];

export function renderAppSite(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras = {}): string {
  if (app.template === 'restaurant') return restaurant(app, tmpl, page, extras);
  if (app.template === 'sentiment') return crawler(app, tmpl, page, extras);
  if (app.template === 'laundromat') return laundromat(app, tmpl, page, extras);
  if (app.template === 'swaplist') return swaplist(app, tmpl, page, extras);
  if (app.template === 'dating') return dating(app, tmpl, page, extras);
  return generic(app, tmpl, page);
}

// ── restaurant ──

function restaurant(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const landing = live(app, tmpl, 'landing');
  const menu = live(app, tmpl, 'menu');
  const hasLanding = !!landing.built;
  const specName = String(landing.params.name ?? app.name);
  const name = !hasLanding ? 'My Restaurant' : landing.bugs.has('name_wrong') ? misspell(specName, landing.seed) : specName;
  const hoursSpec = String(landing.params.hours ?? '').replace('-', '–');
  const hours = landing.bugs.has('hours_wrong') ? WRONG_HOURS[landing.seed % WRONG_HOURS.length] : hoursSpec;

  const base = app.url;
  const tabs: [string, string, boolean][] = [['', 'Home', true], ['menu', 'Menu', !!menu.built], ['booking', 'Book a table', !!extras.booking]];
  const nav = tabs.filter((t) => t[2]).map(([p, label]) =>
    `<a href="#" data-nav="${esc(p ? `${base}/${p}` : base)}" class="${(page ?? '') === p ? 'on' : ''}">${esc(label)}</a>`).join('');
  const header = `<header class="as-r-head"><a href="#" data-nav="${esc(base)}" class="as-r-brand">${esc(name)}</a><nav>${nav}</nav></header>`;

  let body: string;
  if (!page) {
    body = !hasLanding
      ? `<section class="as-r-hero starter"><h1>Welcome to your new site</h1><p>Edit this page to tell visitors who you are.</p></section>`
      : outage(landing, 'this page') ?? `<section class="as-r-hero">
          <p class="as-r-kicker">Cucina italiana</p>
          <h1>${esc(name)}</h1>
          ${hours ? `<p class="as-r-hours"><span>Open daily</span> ${esc(hours)}</p>` : ''}
          ${menu.built ? `<a href="#" class="as-r-cta" data-nav="${esc(base)}/menu">See the menu</a>` : ''}
        </section>`;
  } else if (page === 'menu' && menu.built) {
    const down = outage(menu, 'the menu');
    if (down) body = `<section class="as-r-menu"><h1>Menu</h1>${down}</section>`;
    else {
      const { dishes, currency } = menuDishes(menu);
      const rows = dishes.map((d) => `<li><span>${esc(d.name)}</span><i></i><b>${d.price ? `${esc(d.price)} ${currency}` : ''}</b></li>`).join('');
      body = `<section class="as-r-menu"><h1>Menu</h1><ul>${rows}</ul></section>`;
    }
  } else if (page === 'cancel' && extras.cancel) {
    body = `<section class="as-r-book">${extras.cancel}</section>`;
  } else if (page === 'booking' && extras.booking) {
    body = `<section class="as-r-book">${outage(live(app, tmpl, 'booking'), 'the booking form') ?? extras.booking}</section>`;
  } else body = notFound();

  const foot = `<footer class="as-r-foot">© ${esc(name)}${hours && hasLanding ? ` · ${esc(hours)}` : ''}<span>Built with Forkyard</span></footer>`;
  return `<div class="as as-r">${header}<main>${body}</main>${foot}</div>`;
}

/** What a restaurant's DoorDish listing shows: the live site's name, hours and menu, bugs included. */
export interface DishListing {
  name: string;
  hours: string;
  address: string;
  dishes: { name: string; price: string }[];
  currency: string;
  /** The listing itself is down: the store page can't load its menu. */
  down: boolean;
}

/** A deployed restaurant with the DoorDish feature live, as DoorDish lists it; undefined if it isn't on DoorDish. */
export function dishListing(app: AppInstance, tmpl: AppTemplate | undefined): DishListing | undefined {
  if (app.template !== 'restaurant' || !app.deployed) return undefined;
  const listing = live(app, tmpl, 'doordish');
  if (!listing.built) return undefined;
  const landing = live(app, tmpl, 'landing');
  const menu = live(app, tmpl, 'menu');
  const specName = String(landing.params.name ?? app.name);
  const name = landing.bugs.has('name_wrong') ? misspell(specName, landing.seed) : specName;
  const hours = landing.bugs.has('hours_wrong') ? WRONG_HOURS[landing.seed % WRONG_HOURS.length] : String(landing.params.hours ?? '').replace('-', '–');
  const down = !!listing.brk && (listing.brk.failure === 'visible' || listing.brk.failure === 'failed_fetch');
  const { dishes, currency } = menu.built && !outage(menu, '') ? menuDishes(menu) : { dishes: [], currency: '' };
  return { name, hours, address: String(listing.params.address ?? ''), dishes, currency, down };
}

// ── vibe check ──

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;

const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(2)}%`;
const tone = (n: number) => (n >= 0 ? 'bull' : 'bear');

/** Portfolio value per day: an area chart with a grid and the daily closes as points. */
function valueChart(values: number[], day: number): string {
  const W = 640, H = 160, L = 4, R = 4, T = 10, B = 10;
  const series = values.length < 2 ? [values[0], values[0]] : values;
  const lo = Math.min(...series), hi = Math.max(...series);
  const pad = (hi - lo || hi * 0.01 || 1) * 0.15;
  const min = lo - pad, max = hi + pad;
  const x = (i: number) => L + (i / (series.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${x(0).toFixed(1)},${H} ${line} ${x(series.length - 1).toFixed(1)},${H}`;
  const grid = [0.25, 0.5, 0.75].map((g) => `<line x1="0" x2="${W}" y1="${(T + g * (H - T - B)).toFixed(1)}" y2="${(T + g * (H - T - B)).toFixed(1)}"/>`).join('');
  const k = tone(series[series.length - 1] - series[0]);
  // a flat series (one day, or stale prices) gets one label beside the line, not the same number twice
  const labels = hi === lo ? `<span>${money(hi)}</span>` : `<span>${money(hi)}</span><span>${money(lo)}</span>`;
  const dots = values.length < 2 ? '' : values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5"><title>${dateShort(i + 1)}: ${money(v)}</title></circle>`).join('');
  const days = values.length < 2 ? [1, day] : values.map((_, i) => i + 1);
  return `<figure class="as-s-chart ${k}${hi === lo ? ' flat' : ''}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Portfolio value by day">
      <defs><linearGradient id="as-s-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-opacity="0.35"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${grid}</g><polygon class="area" points="${area}"/><polyline class="line" points="${line}"/><g class="dots">${dots}</g></svg>
    <figcaption>${labels}</figcaption>
    <div class="as-s-xaxis">${days.map((d) => `<span>${dateShort(d)}</span>`).join('')}</div></figure>`;
}

function portfolioPanel(pf: Portfolio, history: number[], day: number): string {
  const rows = pf.holdings.map((h) => `<tr><td class="tk">$${esc(h.ticker)}</td><td>${h.shares.toLocaleString('en-US')}</td><td>${money(h.price)}</td>
      <td class="${tone(h.move)}">${signed(h.move)} <small>${pct(h.movePct)}</small></td><td>${money(h.value)}</td><td class="${tone(h.dayPnl)}">${signed(h.dayPnl)}</td></tr>`).join('');
  return `<section class="as-s-pf">
    <div class="as-s-pf-top">
      <div><span class="lbl">Portfolio value</span><b class="as-s-big">${money(pf.total)} <small>DOLR</small></b></div>
      <span class="as-s-pill ${tone(pf.change)}">${signed(pf.change)} (${pct(pf.changePct)}) today</span>
    </div>
    ${valueChart(history, day)}
    <table class="as-s-hold"><thead><tr><th>Ticker</th><th>Shares</th><th>Price</th><th>Today</th><th>Value</th><th>Day P&amp;L</th></tr></thead>
      <tbody>${rows}<tr class="cash"><td class="tk">Cash</td><td></td><td></td><td></td><td>${money(pf.cash)}</td><td></td></tr></tbody></table>
  </section>`;
}

function crawler(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const posts = extras.market ?? [];
  const f = Object.fromEntries(['tickers', 'sentiment', 'filter', 'portfolio', 'auto_buy'].map((id) => [id, live(app, tmpl, id)]));
  const bugs = new Set(Object.values(f).flatMap((l) => [...l.bugs]));
  // without the filter it counts everything it finds
  if (!f.filter.built) { bugs.add('bots_counted'); }
  const head = `<header class="as-s-head"><span class="as-s-logo">${LOGO_SVG.sentiment}</span><b>${esc(app.name)}</b><span>$-tagged posts on Y</span></header>`;
  // a ticker's page is the dashboard with that ticker's posts open in a window on top
  const open = page && page !== 'dash' ? page.toUpperCase() : undefined;
  let modal = '';
  let body: string;
  if (!f.tickers.built) body = `<p class="as-s-empty">Nothing tracked yet.</p>`;
  else {
    // the posts come in one fetch: if it fails, every card keeps yesterday's summary (or nothing, on the first day)
    const fetchFailed = ['tickers', 'sentiment', 'filter'].some((id) => f[id].brk?.failure === 'failed_fetch');
    const dataDay = fetchFailed ? day - 1 : day;
    const rows = crawl(fetchFailed && dataDay < 1 ? [] : posts, dataDay, bugs, trackedOf(f.tickers.params.tickers));
    const cards = rows.map((r) => {
      const split = f.sentiment.built && r.count
        ? `<div class="as-s-bar"><i class="bull" style="width:${r.bullish}%"></i><i class="neu" style="width:${r.neutral}%"></i><i class="bear" style="width:${r.bearish}%"></i></div>
           <p class="as-s-split"><span class="bull">${r.bullish}% bullish</span><span>${r.neutral}% neutral</span><span class="bear">${r.bearish}% bearish</span></p>` : '';
      if (r.ticker === open) {
        // every post it counted, with the mood it read: the debug view
        const list = r.posts.length
          ? `<ul>${r.posts.map((p) => `<li>${f.sentiment.built ? `<span class="as-s-mood ${p.mood}">${p.mood}</span>` : ''}<div><a href="#" data-nav="y.com/${esc(p.handle)}">@${esc(p.handle)}</a> <small>${dateShort(p.day)} · ${p.likes.toLocaleString('en-US')} likes</small><p>${esc(p.text)}</p></div></li>`).join('')}</ul>`
          : '<p class="as-s-none">No posts crawled.</p>';
        modal = `<div class="as-s-modal" role="dialog" aria-label="$${esc(r.ticker)} crawled posts"><div class="as-s-win">
          <header><b>$${esc(r.ticker)}</b><span>${r.count} crawled post${r.count === 1 ? '' : 's'} · ${dateShort(dataDay < 1 ? day : dataDay)}</span><a href="#" class="as-s-x" data-nav="${esc(app.url)}" aria-label="Close">×</a></header>
          <div class="as-s-list">${list}</div></div></div>`;
      }
      return `<section class="as-s-card" data-nav="${esc(app.url)}/${r.ticker.toLowerCase()}" title="Show all crawled posts"><h2>$${esc(r.ticker)}</h2><p class="as-s-count"><b>${r.count}</b> post${r.count === 1 ? '' : 's'} today</p>${split}<span class="as-s-more">All crawled posts →</span></section>`;
    }).join('');
    body = `<p class="as-s-upd">Updated ${dateShort(dataDay < 1 ? day : dataDay)}</p><div class="as-s-grid">${cards}</div>`;
  }
  const buys = f.auto_buy.built ? autoBuys(posts, day, bugs) : [];
  // the portfolio goes on top, with its value over the days so far
  if (f.portfolio.built) {
    const history = Array.from({ length: day }, (_, i) => portfolio(buys.filter((b) => b.day <= i + 1), i + 1, bugs).total);
    body = portfolioPanel(portfolio(buys, day, bugs), history, day) + body;
  }
  if (f.auto_buy.built) {
    // every Crane post with the mood the classifier read and what the bot did about it, newest first;
    // the position column is what the holdings should say after each buy
    const pos: Record<string, number> = { ...START_PORTFOLIO.holdings };
    const log = tradeLog(extras.crane ?? [], buys, bugs).map((r) => {
      let action = '<span class="none">No action</span>';
      if (r.buys.length) {
        const b = r.buys[0];
        const shares = r.buys.reduce((a, x) => a + x.shares, 0);
        const was = pos[b.ticker] ?? 0;
        pos[b.ticker] = was + shares;
        const times = r.buys.length > 1 ? ` <b class="x">×${r.buys.length}</b>` : '';
        action = `<b class="buy">BUY $${esc(b.ticker)}</b>${times}<small>${shares.toLocaleString('en-US')} @ ${money(b.price)} · ${money(shares * b.price)}</small><small>position ${was.toLocaleString('en-US')} → ${pos[b.ticker].toLocaleString('en-US')}</small>`;
      }
      const mood = f.sentiment.built ? `<span class="as-s-mood ${r.mood}">${r.mood}</span>` : '<span class="as-s-mood">—</span>';
      return `<tr><td>${dateShort(r.post.day)}${r.post.min != null ? `<small>${clockTime(r.post.min)}</small>` : ''}</td>
        <td class="src"><a href="#" data-nav="y.com/${esc(r.post.handle)}">@${esc(r.post.handle)}</a> “${esc(r.post.text)}”</td><td class="mood">${mood}</td><td class="act">${action}</td></tr>`;
    }).reverse().join('');
    body += `<section class="as-s-buys"><h2>Auto-trade log</h2>${log
      ? `<table class="as-s-trades"><thead><tr><th>Posted</th><th>Post</th><th>Sentiment</th><th>Action</th></tr></thead><tbody>${log}</tbody></table>`
      : '<p>Nothing from @randall_crane yet. Watching.</p>'}</section>`;
  }
  if (open && !modal) return `<div class="as as-s">${head}<main>${notFound()}</main></div>`;
  return `<div class="as as-s">${head}<main>${body}</main>${modal}</div>`;
}

// ── laundromat ──


const MACHINE_LABEL = { free: 'Free', running: 'Running', done: 'Done, waiting for pickup', broken: 'Out of order' };

function laundromat(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const f = Object.fromEntries(['machines', 'refresh', 'minutes', 'more_machines'].map((id) => [id, live(app, tmpl, id)]));
  const bugs = new Set(Object.values(f).flatMap((l) => [...l.bugs]));
  const head = `<header class="as-l-head"><span class="as-l-logo">${LOGO_SVG.laundromat}</span><div><b>${esc(app.name)}</b><span>Spin Cycle Laundry · 201 Ferris St</span></div>
    <a href="#" class="as-l-feed" data-newtab="spincycle.test/feed">Raw feed ↗</a></header>`;
  if (page && page !== 'status') return `<div class="as as-l">${head}<main>${notFound()}</main></div>`;
  let body: string;
  if (!f.machines.built) body = `<p class="as-l-empty">No machines yet.</p>`;
  else {
    // one fetch reads the feed: when it fails, the app falls back to showing every machine free
    if (f.machines.brk?.failure === 'failed_fetch' || f.refresh.brk?.failure === 'failed_fetch') bugs.add('fetch_failed');
    // without a working refresh it shows what the feed said when it was deployed
    const live = f.refresh.built && !bugs.has('no_refresh');
    const dataDay = live ? day : app.lastDeployDay || day;
    const dataMin = live ? extras.minute ?? 600 : app.lastDeployMin ?? 600;
    const rows = machineRows(dataDay, bugs, { showMinutes: !!f.minutes.built, twelve: !!f.more_machines.built }, dataMin);
    const broken = bugs.has('layout_breaks') && rows.length > 8;
    const cards = rows.map((m) => `<div class="as-l-m ${m.raw == null ? m.status : 'raw'}"><b>M${m.id}</b><span>${m.raw == null ? MACHINE_LABEL[m.status] : `Status: ${m.raw}`}</span>${m.minutes != null ? `<small>${m.minutes} min left</small>` : ''}</div>`).join('');
    body = `<div class="as-l-grid${broken ? ' broken' : ''}">${cards}</div><p class="as-l-upd">Updated ${dateShort(dataDay)}, ${clockTime(dataMin)}</p>`;
  }
  // the app pays for itself with ads: one across the top, one under the machines
  const day0 = extras.day ?? 1;
  return `<div class="as as-l">${head}<main>${adHtml('spincycle-app', day0, 'wide')}${body}${adHtml('spincycle-app', day0, 'wide', 1)}</main></div>`;
}

// ── swaplist ──

const swapPrice = (l: Listing, bugs: Set<string>) => (l.price === 0 ? 'free' : `${shownPrice(l, bugs).toLocaleString('en-US')} DOLR`);

function swaplist(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const f = Object.fromEntries(['listings', 'search', 'contact', 'mark_sold'].map((id) => [id, live(app, tmpl, id)]));
  const bugs = new Set(Object.values(f).flatMap((l) => [...l.bugs]));
  const base = app.url;
  const all = f.listings.built ? swapListings(app.contentAt, extras.play ?? 0, extras.watchSold, extras.swap?.bought) : [];
  // with titles_shifted every row shows the title of the listing posted before it
  const titleOf = (l: Listing) => {
    if (!bugs.has('titles_shifted') || all.length < 2) return l.title;
    const i = all.indexOf(l);
    return all[(i + 1) % all.length].title;
  };
  const catOf = (l: Listing) => (bugs.has('all_free') ? 'free stuff' : l.cat);
  // without the sold feature nothing is ever marked; with no_sold_badge it's marked but never shown
  const soldShown = (l: Listing) => l.soldAt != null && !!f.mark_sold.built && !bugs.has('no_sold_badge');
  const photo = (l: Listing, big = false) => (bugs.has('no_photos')
    ? `<span class="as-w-ph none${big ? ' big' : ''}" aria-label="Image not found"></span>`
    : `<span class="as-w-ph${big ? ' big' : ''}" aria-hidden="true">${SWAP_ART[l.photo] ?? ''}</span>`);
  const when = (l: Listing) => { const t = listedWhen(l.at); return `${dateShort(t.day)}, ${clockTime(t.min)}`; };

  const [section, arg, sub] = (page ?? '').split('/');
  const query = section === 'search' && arg ? decodeURIComponent(arg).trim().toLowerCase() : '';
  const cat = section === 'cat' && arg ? decodeURIComponent(arg) : '';
  const side = f.search.built
    ? `<form class="as-w-search" data-form="sl-search" data-base="${esc(base)}"><input id="sl-q" placeholder="search swaplist" value="${esc(query)}" autocomplete="off"><button type="submit">Search</button></form>
      <ul class="as-w-cats">${SWAP_CATEGORIES.map((c) => `<li><a href="#" data-nav="${esc(`${base}/cat/${encodeURIComponent(c)}`)}" class="${c === cat ? 'on' : ''}">${esc(c)}</a></li>`).join('')}</ul>`
    : '';
  const head = `<header class="as-w-head"><a href="#" class="as-w-brand" data-nav="${esc(base)}"><span class="as-w-logo">${LOGO_SVG.swaplist}</span>${esc(app.name.toLowerCase())}</a><span>local classifieds</span></header>`;
  const wrap = (main: string) => `<div class="as as-w">${head}<div class="as-w-body"><aside>${side}${adHtml('swaplist-app', day, 'square')}</aside><main>${adHtml('swaplist-app', day, 'wide')}${main}</main></div></div>`;

  const down = outage(f.listings, 'the listings');
  if (!f.listings.built) return wrap(`<p class="as-w-empty">Nothing listed.</p>`);
  if (down) return wrap(down);

  // one listing's page
  if (section === 'item') {
    const l = all.find((x) => String(x.n) === arg);
    if (!l) return wrap(notFound());
    const seller = `<a href="#" data-nav="y.com/${esc(l.seller)}">@${esc(l.seller)}</a>`;
    const thread = extras.swap?.threads.find((t) => t.listing === l.n);
    const back = `<a href="#" data-nav="${esc(`${base}/item/${l.n}`)}">← Back to the listing</a>`;
    if (sub === 'contact' && f.contact.built && !bugs.has('contact_dead')) {
      // the header names the listing's seller; the replies come from whoever the button reached
      const msgs = (thread?.msgs ?? []).map((m) => {
        const t = `${dateShort(m.day)}, ${clockTime(m.min)}`;
        return m.from === 'you'
          ? `<li class="me"><p>${esc(m.text)}</p><small>You · ${t}</small></li>`
          : `<li><p>${esc(m.text)}</p><small>@${esc(m.from)} · ${t}${m.note ? ` · <i class="as-w-dbg">scripted: ${esc(m.note)}</i>` : ''}</small></li>`;
      }).join('');
      const typing = extras.busy ? `<li class="typing"><p>…</p></li>` : '';
      return wrap(`<section class="as-w-chat"><h1>Chat with @${esc(l.seller)}</h1><p class="as-w-meta">About: ${esc(titleOf(l))} · ${back}</p>
        <ul class="as-w-thread">${msgs || '<li class="none">No messages yet.</li>'}${typing}</ul>
        <form class="as-w-send" data-form="sl-msg" data-n="${l.n}"><textarea id="sl-msg" rows="2" placeholder="Write a message" ${extras.busy ? 'disabled' : ''}></textarea><button type="submit" class="as-w-btn"${extras.busy ? ' disabled' : ''}>Send</button></form></section>`);
    }
    if (sub) return wrap(notFound());
    const contact = !f.contact.built ? ''
      : bugs.has('contact_dead') ? `<button class="as-w-btn" type="button">Contact seller</button>`
      : `<a href="#" class="as-w-btn ghost" data-nav="${esc(`${base}/item/${l.n}/contact`)}">Contact seller</a>`;
    const notice = extras.swap?.notice?.listing === l.n ? `<p class="as-w-note">${esc(extras.swap.notice.text)}</p>` : '';
    const offer = thread?.offer;
    const lastFromSeller = [...(thread?.msgs ?? [])].reverse().find((m) => m.from === l.seller)?.text;
    const offerLine = offer && !l.boughtByYou
      ? `<p class="as-w-offer ${offer.status}">Your offer of ${offer.amount.toLocaleString('en-US')} DOLR: ${offer.status === 'accepted' ? 'accepted' : offer.status === 'declined' ? 'declined' : 'item sold'}.${lastFromSeller ? ` <q>${esc(lastFromSeller)}</q>` : ''}</p>` : '';
    const offerBox = takesOffers(app, l, bugs)
      ? `<form class="as-w-offerform" data-form="sl-offer" data-n="${l.n}"><input id="sl-offer" type="number" min="1" step="1" placeholder="Your offer" autocomplete="off"><span>DOLR</span><button type="submit" class="as-w-btn ghost">Make an offer</button>${l.offers ? `<small>${l.offers} offer${l.offers === 1 ? '' : 's'} so far</small>` : ''}</form>`
      : l.price > 0 && !l.boughtByYou ? `<small>Offers closed</small>` : '';
    // the site lets you buy anything it doesn't show as sold
    const cost = buyPrice(extras.swap, l, bugs);
    const buy = l.boughtByYou
      ? `<p class="as-w-bought">You bought this for ${(extras.swap?.bought[l.n]?.paid ?? 0).toLocaleString('en-US')} DOLR.</p>`
      : soldShown(l) ? ''
      : `<form data-form="sl-buy" data-n="${l.n}"><button type="submit" class="as-w-btn">${cost > 0 ? `Buy for ${cost.toLocaleString('en-US')} DOLR` : 'Claim it'}</button></form>`;
    return wrap(`<section class="as-w-item">${photo(l, true)}<div>
      <h1>${esc(titleOf(l))}${soldShown(l) ? ' <span class="as-w-sold">sold</span>' : ''}</h1>
      <p class="as-w-price">${swapPrice(l, bugs)}</p>
      <p class="as-w-meta">${esc(catOf(l))} · posted ${when(l)} by ${seller}</p>
      <p class="as-w-text">${esc(l.body).replace(/\n/g, '<br>')}</p>
      <div class="as-w-acts">${buy}${contact}</div>${offerBox}${offerLine}${notice}</div></section>`);
  }
  if (section && section !== 'search' && section !== 'cat') return wrap(notFound());

  let shown = all;
  let title = 'Latest listings';
  if (section === 'search' && f.search.built) {
    title = query ? `Results for “${query}”` : 'Latest listings';
    if (query) shown = all.filter((l) => {
      const t = titleOf(l).toLowerCase();
      return bugs.has('search_exact') ? t === query : t.includes(query) || l.cat.includes(query);
    });
  } else if (section === 'cat' && f.search.built && cat) {
    title = cat;
    if (!bugs.has('filter_ignored')) shown = all.filter((l) => catOf(l) === cat);
  } else if (section) return wrap(notFound());

  const rows = shown.map((l) => `<li><a href="#" data-nav="${esc(`${base}/item/${l.n}`)}">${photo(l)}<div>
      <b>${esc(titleOf(l))}${soldShown(l) ? ' <span class="as-w-sold">sold</span>' : ''}</b>
      <span class="as-w-meta">${esc(catOf(l))} · ${when(l)}</span></div><i>${swapPrice(l, bugs)}</i></a></li>`).join('');
  const empty = !all.length ? 'No listings yet.' : 'Nothing matches.';
  return wrap(`<h1 class="as-w-h1">${esc(title)}</h1>${rows ? `<ul class="as-w-list">${rows}</ul>` : `<p class="as-w-empty">${empty}</p>`}`);
}

// ── Matchless (dating) ──

const SKIN = ['#f1d3bd', '#e0b391', '#c68a62', '#9a6545', '#6e4630'];
const HAIR = ['#2b2118', '#4a3020', '#8a5a2b', '#c99a5b', '#1c1c1c', '#7b3f2a'];
const BACK = ['#f6d5dc', '#d9e7f5', '#e3f0dc', '#f3e6cf', '#e6dcf3', '#d8efed'];

/** A flat head-and-shoulders picture for a profile card, picked by `look`. */
function portrait(look: number): string {
  const skin = SKIN[look % SKIN.length], hair = HAIR[Math.floor(look / 5) % HAIR.length], back = BACK[Math.floor(look / 30) % BACK.length];
  const top = ['#c0567a', '#3f7cc4', '#3a9a7a', '#d08a2e', '#6d55b0', '#40464f'][Math.floor(look / 7) % 6];
  const style = Math.floor(look / 3) % 4;
  // long hair falls behind the shoulders, a bob stops at the jaw, a bun sits on top, curls go wide
  const behind = style === 0 ? `<path d="M19 30c0-13 26-13 26 0v20H19z" fill="${hair}"/>`
    : style === 3 ? `<circle cx="32" cy="27" r="15" fill="${hair}"/>` : '';
  const over = style === 1 ? `<path d="M20 31c0-12 24-12 24 0v6h-4v-7c-4 2-12 2-16 0v7h-4z" fill="${hair}"/>`
    : style === 2 ? `<circle cx="32" cy="13" r="5.5" fill="${hair}"/><path d="M21 28c1-9 21-9 22 0-6-3-16-3-22 0z" fill="${hair}"/>`
    : `<path d="M21 28c1-10 21-10 22 0-6-3-16-3-22 0z" fill="${hair}"/>`;
  return `<svg viewBox="-16 0 96 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="-16" width="96" height="64" fill="${back}"/>${behind}<path d="M12 64c2-12 10-17 20-17s18 5 20 17z" fill="${top}"/><rect x="28" y="38" width="8" height="9" rx="3" fill="${skin}"/><ellipse cx="32" cy="29" rx="10" ry="11.5" fill="${skin}"/>${over}</svg>`;
}

const stats = (p: Profile) => `${feetInches(p.height)} · ${p.miles} mi away · ${p.followers.toLocaleString('en-US')} followers`;

function dating(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const deck = live(app, tmpl, 'deck');
  const filters = live(app, tmpl, 'filters');
  const bugs = new Set([...deck.bugs, ...filters.bugs]);
  const picks = (extras.dating?.picks ?? []).filter((p) => p.app === app.id);
  const today = picks.filter((p) => p.day === day);
  const likes = picks.filter((p) => p.choice === 'yes').length;
  const head = `<header class="as-m-head"><span class="as-m-logo">${LOGO_SVG.dating}</span><div><b>${esc(app.name)}</b><span>Screening for @highvalue_derek</span></div>
    <p class="as-m-tally">Likes sent: ${likes} · Replies: 0</p></header>`;
  const wrap = (main: string) => `<div class="as as-m">${head}<main>${main}</main></div>`;
  if (page && page !== 'deck') return wrap(notFound());
  if (!deck.built) return wrap(`<p class="as-m-empty">No profiles yet.</p>`);
  const down = outage(deck, 'today\'s profiles');
  if (down) return wrap(down);
  const std = filters.built ? standardsOf(filters.params) : null;
  const rules = std ? `<p class="as-m-rules">Filters: age ${std.ageMin}–${std.ageMax} · ${feetInches(std.height)} or under · within ${std.miles} mi · fewer than ${std.followers.toLocaleString('en-US')} Y followers</p>`
    : `<p class="as-m-rules">No filters set.</p>`;
  if (datingPaused(app)) return wrap(`${rules}<div class="as-m-paused"><b>Screening is paused</b><p>The owner changed the filters. Screening resumes once the app has the new ones.</p></div>`);
  const { deck: shown, blocked } = screen(dayProfiles(day, standardsOf(app.specParams.filters)), std, bugs);
  const used = limitUsed(today.length, bugs);
  const full = limitUsed(today.length + 1, bugs) > DAILY_PICKS;
  const counter = `<p class="as-m-count">Today: ${Math.min(used, DAILY_PICKS)} of ${DAILY_PICKS} decisions${full ? ' · Daily limit reached. Back tomorrow.' : ''}</p>`;
  const cards = shown.map((p) => {
    const pick = today.find((x) => x.id === p.id);
    const acts = pick ? `<span class="as-m-stamp ${pick.choice}">${pick.choice === 'yes' ? 'Accepted' : 'Rejected'}</span>`
      : `<form data-form="dt-pick" data-app="${esc(app.id)}" data-id="${esc(p.id)}" data-pick="no"><button type="submit" class="as-m-btn no"${full ? ' disabled' : ''}>Reject</button></form>
         <form data-form="dt-pick" data-app="${esc(app.id)}" data-id="${esc(p.id)}" data-pick="yes"><button type="submit" class="as-m-btn yes"${full ? ' disabled' : ''}>Accept</button></form>`;
    return `<article class="as-m-card${pick ? ' done' : ''}"><span class="as-m-ph">${portrait(p.look)}</span><div class="as-m-info"><b>${esc(p.name)}, ${p.age}</b><small>${stats(p)}</small><p>${esc(p.bio)}</p></div><div class="as-m-acts">${acts}</div></article>`;
  }).join('');
  const out = std ? `<section class="as-m-out"><h2>Filtered out today (${blocked.length})</h2>${blocked.length ? `<table><thead><tr><th>Name</th><th>Age</th><th>Height</th><th>Distance</th><th>Followers</th><th>Caught by</th></tr></thead><tbody>${blocked.map(({ p, by }) =>
    `<tr><td>${esc(p.name)}</td><td>${p.age}</td><td>${feetInches(p.height)}</td><td>${p.miles} mi</td><td>${p.followers.toLocaleString('en-US')}</td><td>${by}</td></tr>`).join('')}</tbody></table>` : '<p class="as-m-empty">Nobody.</p>'}</section>` : '';
  return wrap(`${rules}${counter}<div class="as-m-deck">${cards || '<p class="as-m-empty">No profiles today.</p>'}</div>${out}`);
}

// ── generic fallback ──

function generic(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined): string {
  const pages = tmpl?.pages ?? [];
  const onPage = (pid: string) => (tmpl?.features ?? []).filter((f) => f.pageId === pid && app.features.some((b) => b.id === f.id));
  const built = pages.filter((p) => onPage(p.id).length);
  const current = page ? built.find((p) => p.id === page) : built[0];
  const nav = built.map((p, i) => `<a href="#" data-nav="${esc(i === 0 ? app.url : `${app.url}/${p.id}`)}" class="${p === current ? 'on' : ''}">${esc(p.title)}</a>`).join('');
  let body: string;
  if (!built.length) body = `<section class="as-g-blank"><p>Nothing here yet.</p></section>`;
  else if (!current) body = notFound();
  else body = onPage(current.id).map((f) => {
    const l = live(app, tmpl, f.id);
    const down = outage(l, f.id);
    if (down) return down;
    const text = f.description.charAt(0).toUpperCase() + f.description.slice(1);
    return l.built?.correct && !l.brk ? `<section><p>${esc(text)}.</p></section>` : `<section><p>${esc(text)}.</p><p class="as-g-glitch">undefined</p></section>`;
  }).join('');
  return `<div class="as as-g"><header class="as-g-head"><b>${esc(app.name)}</b><nav>${nav}</nav></header><main>${body}</main></div>`;
}

// ── dev mode: which bugs each feature can have and which it has now (hidden unless body.dev-on) ──

const BREAK_LABEL: Record<string, string> = { visible: 'crash', failed_fetch: 'failed fetch', subtle: 'subtle break', deep: 'deep break' };

interface DevRow { id: string; repoNow: string; liveNow: string; present: Set<string>; possible: { key: string; label: string; live?: boolean }[]; checklist: string; held: string[] }

function devRows(app: AppInstance, tmpl: AppTemplate | undefined): DevRow[] {
  return app.required.map((id) => {
    const def = tmpl?.features.find((f) => f.id === id);
    const repo = app.repo.find((f) => f.id === id);
    const liveF = app.features.find((f) => f.id === id);
    const brk = app.breaks.find((b) => b.featureId === id);
    const repoNow = !repo ? 'missing' : repo.correct ? 'ok' : bugsOf(repo).join(' + ') || 'wrong';
    const liveNow = !app.deployed ? 'not deployed'
      : brk ? `${BREAK_LABEL[brk.failure] ?? brk.failure}${breakVariant(brk, def) ? `: ${breakVariant(brk, def)}` : ''}`
      : !liveF ? 'missing' : liveF.correct ? 'ok' : bugsOf(liveF).join(' + ') || 'wrong';
    const present = new Set([...(repo?.correct ? [] : bugsOf(repo)), ...(liveF?.correct ? [] : bugsOf(liveF)), ...(brk ? [brk.failure] : []), ...(brk && breakVariant(brk, def) ? [breakVariant(brk, def)!] : [])]);
    // a wrong build with no named bug still gets a tag, so it can be seen and switched off
    const unnamed = [repo, liveF].some((f) => f && !f.correct && !f.variant);
    if (unnamed) present.add(UNNAMED_BUG);
    // a feature nobody has built yet is just missing: no bugs to show or switch on until it's pushed
    const possible = !repo && !liveF ? [] : [
      ...(unnamed || !def?.bugs?.length ? [{ key: UNNAMED_BUG, label: 'wrong (no named bug)' }] : []),
      ...(def?.bugs ?? []).map((b) => ({ key: b.id, label: b.deep ? `${b.id} (deep)` : b.id })),
      ...(def?.details?.length ? ['hallucinated', 'outdated'] : app.specParams[id] ? ['outdated'] : []).map((key) => ({ key, label: key })),
      // subtle and deep breaks show one of the bugs above, so with named bugs they'd only repeat them
      ...(def?.failures ?? []).filter((f) => !(def?.bugs?.length && (f === 'subtle' || f === 'deep'))).map((f) => ({ key: f, label: BREAK_LABEL[f] ?? f, live: true })),
    ];
    // the spec checklist from the last build prompt: a missed item guarantees its bug
    const checklist = (def?.checklist ?? []).map((c) => {
      const hit = repo?.checked?.[c.id];
      const cls = hit === undefined ? '' : hit ? 'hit' : 'miss';
      return `<span class="dvb-check ${cls}">${hit === undefined ? '·' : hit ? '✓' : '✗'} ${esc(c.id)}${hit === false ? ` → ${esc(c.bug)}` : ''}</span>`;
    }).join('');
    // bugs in the code that nothing shows yet: they land once something would show them
    const held = [...new Set([...(repo?.held ?? []), ...(liveF?.held ?? [])])];
    return { id, repoNow, liveNow, present, possible, checklist, held };
  });
}

/** How many features currently have a bug (in the repo or live), for the repo list badge. */
export function devBugCount(app: AppInstance, tmpl: AppTemplate | undefined): number {
  const bad = (v: string) => v !== 'ok' && v !== 'missing';
  return devRows(app, tmpl).filter((r) => bad(r.repoNow) || (app.deployed && bad(r.liveNow))).length;
}

const pill = (label: string, v: string) => `<span class="dvb-pill ${v === 'ok' ? 'ok' : v === 'not deployed' ? 'off' : 'bad'}"><i>${label}</i>${esc(v)}</span>`;

export function devBugPanel(app: AppInstance, tmpl: AppTemplate | undefined): string {
  const rows = devRows(app, tmpl);
  const n = devBugCount(app, tmpl);
  const cards = rows.map((r) => `<div class="dvb-card">
      <div class="dvb-title"><b>${esc(r.id)}</b>${pill('repo', r.repoNow)}${pill('live', r.liveNow)}</div>
      ${r.checklist ? `<div class="dvb-line"><span class="dvb-k">Build prompt</span>${r.checklist}</div>` : ''}
      ${r.held.length ? `<div class="dvb-line"><span class="dvb-k">Not showing yet</span>${r.held.map((b) => `<span class="dvb-check">${esc(b)}</span>`).join('')}</div>` : ''}
      <div class="dvb-line"><span class="dvb-k">Possible bugs</span>${r.possible.map((p) => {
        const off = p.live && !app.deployed;
        const tip = off ? 'Deploy first: breaks only happen on the live site' : r.present.has(p.key) ? 'Click to remove' : p.live ? 'Click to break the live site' : 'Click to add to the repo and live build';
        return `<button class="dvb-tag${r.present.has(p.key) ? ' on' : ''}" data-devbug="${esc(`${app.id}|${r.id}|${p.key}`)}" title="${tip}"${off ? ' disabled' : ''}>${esc(p.label)}</button>`;
      }).join('') || (r.repoNow === 'missing' && r.liveNow !== 'ok' ? '<i>none until it\'s built</i>' : '<i>none</i>')}</div>
    </div>`).join('');
  return `<section class="dev-bugs"><div class="dvb-head"><span class="dvb-badge">DEV</span><b>Bugs in ${esc(app.id)}</b><span class="dvb-sum ${n ? 'bad' : 'ok'}">${n ? `${n} feature${n > 1 ? 's' : ''} with a bug` : 'no bugs'}</span><span class="dvb-hint">Click a bug to switch it on or off</span></div>${cards}</section>`;
}
