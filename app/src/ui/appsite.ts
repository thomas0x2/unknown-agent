/*
 * Deployed apps as real websites. Each feature renders from what was actually built: the spec's
 * params when it's right, or the concrete bug it shipped with (BuiltFeature.variant), so the player
 * finds problems by comparing the site with the client's email, not by reading a status label.
 * Templates get a renderer here; anything without one falls back to a plain generic site.
 */
import { type AppInstance, type AppBreak, type BuiltFeature, breakVariant, bugsOf, UNNAMED_BUG } from '../engine';
import type { AppTemplate } from '../content/schema';
import { misspell, wrongPitch, investorsShown, credentialsShown, FAKE_COFOUNDERS, waitlistStart, waitlistCount, fmtCount } from '../engine/startup';
import { INVESTOR_LOGOS } from '../sites/investorLogos';
import { Y_AVATARS } from './y-avatars';
import { crawl, ledger, portfolio, tradeLog, readMood, trackedOf, START_PORTFOLIO, type Buy, type MarketPost, type Portfolio } from '../engine/crawler';
import { payDay, STAKE } from '../engine/stake';
import type { StakeSend } from '../engine/state';
import { machineRows } from '../engine/laundromat';
import { COPE, countdownView, siteAddress, siteAllocation, siteSupply, siteLock } from '../engine/cope';
import { swapListings, listedWhen, SWAP_CATEGORIES, type Listing } from '../engine/swaplist';
import { takesOffers, buyPrice, shownPrice } from '../engine/swapdeal';
import type { SwapState } from '../engine/state';
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
  /** The waitlist form, owned by the view (it wires into Qmail), and how many have joined so far. */
  waitlist?: string;
  joined?: number;
  /** Today, and the stock posts on Y: what the crawler and the laundromat read. */
  day?: number;
  /** The clock, minutes since midnight: the laundry feed changes with it. */
  minute?: number;
  market?: MarketPost[];
  /** Everything posted as Randall Crane so far: what the auto-trade log lists. */
  crane?: MarketPost[];
  /** The player's sends to the trader's wallet: the stake the portfolio view shows. */
  stakes?: StakeSend[];
  /** Minutes of play so far, and whether Viktor has said his watch sold: what Swaplist lists. */
  play?: number;
  watchSold?: boolean;
  /** Swaplist as a buyer: the player's chats, offers and purchases, and whether a reply is on its way. */
  swap?: SwapState;
  busy?: boolean;
}

/** Logos of the apps that have one, by template: the site header and the browser tab both use them. */
const LOGO_SVG: Record<string, string> = {
  // WorkAgent: a black tile, two chevrons passing work along
  startup: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="9" fill="#111"/><path d="M11 13l7 7-7 7" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 13l7 7-7 7" stroke="#8b7cff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // classifieds purple: two arrows trading places
  swaplist: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#6e3fa3"/><path d="M11 15h17M24 10.5l4.5 4.5-4.5 4.5M29 25H12M16 20.5 11.5 25l4.5 4.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // a coin with a flat, resigned mouth
  coinsite: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#e8b931"/><circle cx="20" cy="20" r="14" fill="none" stroke="#b8891a" stroke-width="2"/><circle cx="15" cy="17" r="2" fill="#5a4210"/><circle cx="25" cy="17" r="2" fill="#5a4210"/><path d="M14 26h12" stroke="#5a4210" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  laundromat: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="2" width="32" height="36" rx="6" fill="#2f80ed"/><rect x="8" y="6" width="24" height="5" rx="2" fill="#fff" opacity=".35"/><circle cx="20" cy="24" r="10" fill="#fff"/><circle cx="20" cy="24" r="7" fill="#9cc6f5"/><path d="M14 25c2-2 4 2 6 0s4 2 6 0" stroke="#2f80ed" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`,
  // a dark terminal tile: a market line climbing through a crawler's scan brackets
  sentiment: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#0f1419"/><path d="M9 11V9h4M27 9h4v2M31 29v2h-4M13 31H9v-2" stroke="#3a4552" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="11" y="21" width="3" height="6" rx="1" fill="#e5484d"/><rect x="16.5" y="17" width="3" height="10" rx="1" fill="#30a46c"/><rect x="22" y="19" width="3" height="8" rx="1" fill="#e5484d"/><path d="M10 19l6.5-5 5 3 8.5-6" stroke="#4cc38a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="11" r="2.2" fill="#4cc38a"/></svg>`,
};
export const appLogo = (template: string): string | undefined => LOGO_SVG[template];

export function renderAppSite(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras = {}): string {
  if (app.template === 'startup') return startup(app, tmpl, page, extras);
  if (app.template === 'sentiment') return crawler(app, tmpl, page, extras);
  if (app.template === 'laundromat') return laundromat(app, tmpl, page, extras);
  if (app.template === 'swaplist') return swaplist(app, tmpl, page, extras);
  if (app.template === 'coinsite') return coinsite(app, tmpl, page, extras);
  return generic(app, tmpl, page);
}

// ── startup ──

const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();

/** One investor in the "Backed by" row: its logo, a plain wordmark for a fund we have none for, or a broken image. */
function investorLogo(name: string, broken: boolean): string {
  if (broken) {
    const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-logo.png`;
    return `<span class="as-u-logo broken" title="${esc(file)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h9l3 3v9H2z" fill="#fff" stroke="#9aa3ab"/><path d="M4 11l3-3 2 2 1-1 2 2" stroke="#9aa3ab" fill="none"/><path d="M9 2l-2 5 3 1-2 6" stroke="#e5484d" fill="none"/></svg><small>${esc(file)}</small></span>`;
  }
  const logo = INVESTOR_LOGOS[name];
  // Why Combinator is the one fund with a site of its own
  if (logo && name === 'Why Combinator') return `<a href="#" class="as-u-logo" data-nav="whycombinator.com" aria-label="${esc(name)}">${logo}</a>`;
  return logo ? `<span class="as-u-logo" role="img" aria-label="${esc(name)}">${logo}</span>` : `<span class="as-u-logo word">${esc(name)}</span>`;
}

function startup(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const landing = live(app, tmpl, 'landing');
  const about = live(app, tmpl, 'about');
  const waitlist = live(app, tmpl, 'waitlist');
  const hasLanding = !!landing.built;
  const specName = String(landing.params.name ?? app.name);
  const name = !hasLanding ? 'My Startup' : landing.bugs.has('name_wrong') ? misspell(specName, landing.seed) : specName;
  const pitch = landing.bugs.has('pitch_wrong') ? wrongPitch(landing.seed) : String(landing.params.pitch ?? '');

  const base = app.url;
  const tabs: [string, string, boolean][] = [['', 'Home', true], ['about', 'About us', !!about.built], ['waitlist', 'Waitlist', !!extras.waitlist]];
  const nav = tabs.filter((t) => t[2]).map(([p, label]) =>
    `<a href="#" data-nav="${esc(p ? `${base}/${p}` : base)}" class="${(page ?? '') === p ? 'on' : ''}">${esc(label)}</a>`).join('');
  const header = `<header class="as-u-head"><a href="#" data-nav="${esc(base)}" class="as-u-brand"><span class="as-u-mark">${LOGO_SVG.startup}</span>${esc(name)}</a><nav>${nav}</nav></header>`;

  let body: string;
  if (!page) {
    // the "Backed by" row is part of the landing page (landing/investors/ in the repo)
    const funds = hasLanding ? investorsShown(landing) : [];
    const backed = !funds.length ? '' : `<section class="as-u-backed"><p>Backed by</p>
        <div class="as-u-logos">${funds.map((n) => investorLogo(n, landing.bugs.has('logos_broken'))).join('')}</div></section>`;
    body = !hasLanding
      ? `<section class="as-u-hero starter"><h1>Welcome to your new site</h1><p>Edit this page to tell visitors who you are.</p></section>`
      : outage(landing, 'this page') ?? (`<section class="as-u-hero">
          <p class="as-u-kicker">Now in stealth</p>
          <h1>${esc(pitch)}</h1>
          ${extras.waitlist ? `<a href="#" class="as-u-cta" data-nav="${esc(base)}/waitlist">Join the waitlist</a>` : ''}
        </section>` + backed);
  } else if (page === 'about' && about.built) {
    const down = outage(about, 'the team');
    const founder = about.bugs.has('founder_wrong') ? misspell(String(about.params.founder ?? ''), about.seed) : String(about.params.founder ?? '');
    const creds = credentialsShown(about).map((c) => `<li>${esc(c)}</li>`).join('');
    // Logan uses his Y picture; the cofounders the agent made up get initials
    const person = (n: string, role: string, extra: string, ai = false, face = '') => `<article class="as-u-person${ai ? ' ai' : ''}"><span class="as-u-face${face ? ' pic' : ''}" aria-hidden="true">${face || esc(initials(n))}</span><div><h2>${esc(n)}</h2><p class="as-u-role">${esc(role)}</p>${extra}</div></article>`;
    const team = [person(founder, 'Founder & CEO', `<ul class="as-u-creds">${creds}</ul>`, false, Y_AVATARS.logan_ships),
      ...(about.bugs.has('fake_cofounders') ? FAKE_COFOUNDERS.map((c) => person(c.name, c.role, `<p class="as-u-bio">${esc(c.bio)}</p>`, true)) : [])].join('');
    body = `<section class="as-u-about"><h1>About us</h1>${down ?? `<p class="as-u-lead">We're building the future of work.</p><div class="as-u-team">${team}</div>`}</section>`;
  } else if (page === 'waitlist' && extras.waitlist) {
    const down = outage(waitlist, 'the waitlist');
    const count = waitlistCount(waitlistStart(waitlist.params), extras.joined ?? 0, waitlist.bugs);
    body = `<section class="as-u-wait"><h1>Join the waitlist</h1>${down ?? `<p class="as-u-count"><b>${fmtCount(count)}</b> people are already waiting.</p>${extras.waitlist}`}</section>`;
  } else body = notFound();

  const foot = `<footer class="as-u-foot">© 2030 ${esc(name)}, Inc.<span>Built with Forkyard</span></footer>`;
  return `<div class="as as-u">${header}<main>${body}</main>${foot}</div>`;
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

/**
 * The player's stake, as the dashboard computes it: each send moves with the portfolio value shown
 * (so the display bugs reach it too); a paid-out send shows what it paid.
 */
function stakePanel(stakes: StakeSend[], history: number[], day: number, bugs: Set<string>): string {
  if (!stakes.length) return '';
  const pctScale = bugs.has('pct_wrong') ? 100 : 1;
  const rows = stakes.map((x) => {
    const due = `${dateShort(payDay(x))}, ${clockTime(STAKE.payAt)}`;
    if (x.paid != null) return `<tr class="paid"><td>${dateShort(x.day)}</td><td>${money(x.amount)}</td><td>${money(x.paid)}</td><td class="${tone(x.paid - x.amount)}">${pct(((x.paid - x.amount) / x.amount) * pctScale)}</td><td>Paid out ${due}</td></tr>`;
    const ratio = history[day - 1] / (history[x.day - 1] || 1);
    return `<tr><td>${dateShort(x.day)}</td><td>${money(x.amount)}</td><td>${money(x.amount * ratio)}</td><td class="${tone(ratio - 1)}">${pct((ratio - 1) * pctScale)}</td><td>Pays out ${due}</td></tr>`;
  }).join('');
  return `<div class="as-s-stake"><h3>Your stake</h3>
    <table class="as-s-hold"><thead><tr><th>Staked</th><th>In</th><th>Value</th><th>Since</th><th>Payout</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function portfolioPanel(pf: Portfolio, history: number[], day: number, stake = ''): string {
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
    ${stake}
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
  // the trader's book: his own trades on the news, and the bot's buys once it's built
  const book = ledger(posts, day, f.auto_buy.built ? bugs : new Set([...bugs, 'no_buy']));
  // the portfolio goes on top, with its value over the days so far
  if (f.portfolio.built) {
    const history = Array.from({ length: day }, (_, i) => portfolio(book.filter((b) => b.day <= i + 1), i + 1, bugs).total);
    body = portfolioPanel(portfolio(book, day, bugs), history, day, stakePanel(extras.stakes ?? [], history, day, bugs)) + body;
  }
  if (f.auto_buy.built) {
    // every Crane post with the mood the classifier read and what the bot did about it, and the
    // trader's own trades, newest first; the position column is what the holdings should say after each
    const pos: Record<string, number> = { ...START_PORTFOLIO.holdings };
    const moves = new Map<Buy, [number, number]>();
    for (const b of book) { const was = pos[b.ticker] ?? 0; pos[b.ticker] = was + b.shares; moves.set(b, [was, pos[b.ticker]]); }
    const trade = (bs: Buy[]) => {
      const b = bs[0];
      const shares = bs.reduce((a, x) => a + x.shares, 0);
      const [was] = moves.get(b)!, [, now] = moves.get(bs.at(-1)!)!;
      const times = bs.length > 1 ? ` <b class="x">×${bs.length}</b>` : '';
      const side = shares < 0 ? '<b class="sell">SELL' : '<b class="buy">BUY';
      return `${side} $${esc(b.ticker)}</b>${times}<small>${Math.abs(shares).toLocaleString('en-US')} @ ${money(b.price)} · ${money(Math.abs(shares) * b.price)}</small><small>position ${was.toLocaleString('en-US')} → ${now.toLocaleString('en-US')}</small>`;
    };
    // the trader's trade on a Crane post goes in that post's row
    const manual = book.filter((b) => b.manual);
    const crane = extras.crane ?? [];
    const byHand = (id: string) => manual.filter((b) => b.post.id === id).map((b) => `<small class="who">Manual trade</small>${trade([b])}`).join('');
    const rows = [
      ...tradeLog(crane, book.filter((b) => !b.manual), bugs).map((r) => ({ post: r.post, mood: r.mood, who: '', action: (r.buys.length ? trade(r.buys) : manual.some((b) => b.post.id === r.post.id) ? '' : '<span class="none">No action</span>') + byHand(r.post.id) })),
      ...manual.filter((b) => !crane.some((p) => p.id === b.post.id)).map((b) => ({ post: b.post, mood: readMood(b.post, bugs), who: '<small class="who">Manual trade</small>', action: trade([b]) })),
    ].sort((a, b) => a.post.day - b.post.day || (a.post.min ?? 0) - (b.post.min ?? 0));
    const log = rows.map((r) => {
      const mood = f.sentiment.built ? `<span class="as-s-mood ${r.mood}">${r.mood}</span>` : '<span class="as-s-mood">—</span>';
      return `<tr><td>${dateShort(r.post.day)}${r.post.min != null ? `<small>${clockTime(r.post.min)}</small>` : ''}</td>
        <td class="src">${r.who}<a href="#" data-nav="y.com/${esc(r.post.handle)}">@${esc(r.post.handle)}</a> “${esc(r.post.text)}”</td><td class="mood">${mood}</td><td class="act">${r.action}</td></tr>`;
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

// ── coinsite (Dex's $COPE site) ──

function coinsite(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const f = Object.fromEntries(['countdown', 'contract', 'tokenomics'].map((id) => [id, live(app, tmpl, id)]));
  const base = app.url;
  const tabs: [string, string, boolean][] = [['', 'Home', true], ['tokenomics', 'Tokenomics', !!f.tokenomics.built]];
  const nav = tabs.filter((t) => t[2]).map(([p, label]) => `<a href="#" data-nav="${esc(p ? `${base}/${p}` : base)}" class="${(page ?? '') === p ? 'on' : ''}">${esc(label)}</a>`).join('');
  const head = `<header class="as-c-head"><span class="as-c-logo">${LOGO_SVG.coinsite}</span><b>$${COPE.ticker}</b><nav>${nav}</nav></header>`;
  let body: string;
  if (!page) {
    const cd = f.countdown;
    const view = countdownView(cd.bugs, extras.day ?? 1, extras.minute ?? 600, app.lastDeployDay ? { day: app.lastDeployDay, min: app.lastDeployMin ?? 600 } : undefined);
    const clock = !cd.built ? '' : outage(cd, 'the countdown') ?? `<div class="as-c-clock${view.live ? ' live' : ''}"><small>${view.live ? 'Launched' : 'Launch'} · ${esc(view.target)}</small><b>${esc(view.text)}</b></div>`;
    const ca = f.contract;
    const addr = !ca.built ? '' : outage(ca, 'the contract address') ?? `<div class="as-c-ca"><small>Contract address</small><code>${esc(siteAddress(String(ca.params.address ?? COPE.address), ca.bugs, ca.seed))}</code></div>`;
    body = `<section class="as-c-hero"><h1>$${COPE.ticker}</h1><p>For everyone the system left behind.</p>${clock}${addr}${!cd.built && !ca.built ? '<p class="as-c-empty">Coming soon.</p>' : ''}</section>`;
  } else if (page === 'tokenomics' && f.tokenomics.built) {
    const t = f.tokenomics;
    const down = outage(t, 'the tokenomics');
    if (down) body = `<section class="as-c-tok"><h1>Tokenomics</h1>${down}</section>`;
    else {
      const rows = siteAllocation(String(t.params.shares ?? ''), t.bugs);
      const total = rows.reduce((a, r) => a + r.pct, 0);
      const lock = siteLock(String(t.params.lock ?? ''), t.bugs);
      const list = rows.map((r) => `<tr><td>${esc(r.name)}</td><td><i style="width:${Math.min(100, r.pct)}%"></i></td><td>${r.pct}%</td><td>${/^dev\b|founding/i.test(r.name) ? `Locked until ${esc(lock)}` : ''}</td></tr>`).join('');
      body = `<section class="as-c-tok"><h1>Tokenomics</h1>
        <p class="as-c-supply"><small>Total supply</small><b>${esc(siteSupply(String(t.params.supply ?? ''), t.bugs))} ${COPE.ticker}</b></p>
        <table class="as-c-alloc"><tbody>${list}</tbody><tfoot><tr><td>Total</td><td></td><td>${total}%</td><td></td></tr></tfoot></table>
        <p class="as-c-note">No presale. No team tokens. The treasury belongs to the congregation.</p></section>`;
    }
  } else body = notFound();
  return `<div class="as as-c">${head}<main>${body}</main><footer class="as-c-foot">$${COPE.ticker} is a memecoin with no intrinsic value or expectation of financial return.</footer></div>`;
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
      return wrap(`<section class="as-w-chat"><h1>Chat with @${esc(l.seller)}</h1><p class="as-w-meta">About: ${esc(titleOf(l))} · ${back}</p>
        <ul class="as-w-thread">${msgs || '<li class="none">No messages yet.</li>'}</ul>
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
      ? `<p class="as-w-offer ${offer.status}">Your offer of ${offer.amount.toLocaleString('en-US')} DOLR: ${offer.status === 'pending' ? 'waiting for the seller' : offer.status === 'accepted' ? 'accepted' : offer.status === 'declined' ? 'declined' : 'item sold'}.${lastFromSeller && offer.status !== 'pending' ? ` <q>${esc(lastFromSeller)}</q>` : ''}</p>` : '';
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
