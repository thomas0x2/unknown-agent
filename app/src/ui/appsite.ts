/*
 * Deployed apps as real websites. Each feature renders from what was actually built: the spec's
 * params when it's right, or the concrete bug it shipped with (BuiltFeature.variant), so the player
 * finds problems by comparing the site with the client's email, not by reading a status label.
 * Templates get a renderer here; anything without one falls back to a plain generic site.
 */
import { type AppInstance, type AppBreak, type BuiltFeature, breakVariant, bugsOf, UNNAMED_BUG } from '../engine';
import type { AppTemplate } from '../content/schema';
import { menuDishes, misspell, WRONG_HOURS } from '../engine/restaurant';
import { crawl, autoBuys, portfolio, START_PORTFOLIO, type MarketPost, type Portfolio } from '../engine/crawler';
import { machineRows } from '../engine/laundromat';
import { adHtml } from './ads';
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
}

export function renderAppSite(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras = {}): string {
  if (app.template === 'restaurant') return restaurant(app, tmpl, page, extras);
  if (app.template === 'sentiment') return crawler(app, tmpl, page, extras);
  if (app.template === 'laundromat') return laundromat(app, tmpl, page, extras);
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

// ── sentiment crawler ──

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
  const dots = values.length < 2 ? '' : values.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5"><title>${dateShort(i + 1)}: ${money(v)}</title></circle>`).join('');
  const days = values.length < 2 ? [1, day] : values.map((_, i) => i + 1);
  return `<figure class="as-s-chart ${k}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Portfolio value by day">
      <defs><linearGradient id="as-s-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-opacity="0.35"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>
      <g class="grid">${grid}</g><polygon class="area" points="${area}"/><polyline class="line" points="${line}"/><g class="dots">${dots}</g></svg>
    <figcaption><span>${money(hi)}</span><span>${money(lo)}</span></figcaption>
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
  const head = `<header class="as-s-head"><b>${esc(app.name)}</b><span>$-tagged posts on Y</span></header>`;
  // a ticker's page is the dashboard with that ticker's posts open in a window on top
  const open = page && page !== 'dash' ? page.toUpperCase() : undefined;
  let modal = '';
  let body: string;
  if (!f.tickers.built) body = `<p class="as-s-empty">Nothing tracked yet.</p>`;
  else {
    // the posts come in one fetch: if it fails, every card keeps yesterday's summary (or nothing, on the first day)
    const fetchFailed = ['tickers', 'sentiment', 'filter'].some((id) => f[id].brk?.failure === 'failed_fetch');
    const dataDay = fetchFailed ? day - 1 : day;
    const rows = crawl(fetchFailed && dataDay < 1 ? [] : posts, dataDay, bugs);
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
    // the trade log keeps its own position count: what the holdings should say after each buy
    const pos: Record<string, number> = { ...START_PORTFOLIO.holdings };
    const log = buys.map((b) => {
      const was = pos[b.ticker] ?? 0;
      pos[b.ticker] = was + b.shares;
      return `<tr><td>${dateShort(b.day)}</td><td class="tk">BUY $${esc(b.ticker)}</td><td>${b.shares.toLocaleString('en-US')} @ ${money(b.price)}</td><td>${money(b.shares * b.price)}</td><td>${was.toLocaleString('en-US')} → ${pos[b.ticker].toLocaleString('en-US')}</td>
        <td class="src"><a href="#" data-nav="y.com/${esc(b.post.handle)}">@${esc(b.post.handle)}</a> “${esc(b.post.text)}”</td></tr>`;
    }).reverse().join('');
    body += `<section class="as-s-buys"><h2>Auto-buy trades</h2>${log
      ? `<table class="as-s-trades"><thead><tr><th>Date</th><th>Order</th><th>Fill</th><th>Cost</th><th>Position</th><th>Signal</th></tr></thead><tbody>${log}</tbody></table>`
      : '<p>No trades yet. Watching @randall_crane.</p>'}</section>`;
  }
  if (open && !modal) return `<div class="as as-s">${head}<main>${notFound()}</main></div>`;
  return `<div class="as as-s">${head}<main>${body}</main>${modal}</div>`;
}

// ── laundromat ──

const SPIN_LOGO = `<svg class="as-l-logo" viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="2" width="32" height="36" rx="6" fill="#2f80ed"/><rect x="8" y="6" width="24" height="5" rx="2" fill="#fff" opacity=".35"/><circle cx="20" cy="24" r="10" fill="#fff"/><circle cx="20" cy="24" r="7" fill="#9cc6f5"/><path d="M14 25c2-2 4 2 6 0s4 2 6 0" stroke="#2f80ed" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;

const MACHINE_LABEL = { free: 'Free', running: 'Running', done: 'Done, waiting for pickup', broken: 'Out of order' };

function laundromat(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const f = Object.fromEntries(['machines', 'refresh', 'minutes', 'more_machines'].map((id) => [id, live(app, tmpl, id)]));
  const bugs = new Set(Object.values(f).flatMap((l) => [...l.bugs]));
  const head = `<header class="as-l-head">${SPIN_LOGO}<div><b>${esc(app.name)}</b><span>Spin Cycle Laundry · 201 Ferris St</span></div>
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

interface DevRow { id: string; repoNow: string; liveNow: string; present: Set<string>; possible: { key: string; label: string; live?: boolean }[]; checklist: string }

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
    const possible = [
      ...(unnamed || !def?.bugs?.length ? [{ key: UNNAMED_BUG, label: 'wrong (no named bug)' }] : []),
      ...(def?.bugs ?? []).map((b) => ({ key: b.id, label: b.deep ? `${b.id} (deep)` : b.id })),
      ...(def?.details?.length ? ['hallucinated', 'outdated'] : []).map((key) => ({ key, label: key })),
      // subtle and deep breaks show one of the bugs above, so with named bugs they'd only repeat them
      ...(def?.failures ?? []).filter((f) => !(def?.bugs?.length && (f === 'subtle' || f === 'deep'))).map((f) => ({ key: f, label: BREAK_LABEL[f] ?? f, live: true })),
    ];
    // the spec checklist from the last build prompt: a missed item guarantees its bug
    const checklist = (def?.checklist ?? []).map((c) => {
      const hit = repo?.checked?.[c.id];
      const cls = hit === undefined ? '' : hit ? 'hit' : 'miss';
      return `<span class="dvb-check ${cls}">${hit === undefined ? '·' : hit ? '✓' : '✗'} ${esc(c.id)}${hit === false ? ` → ${esc(c.bug)}` : ''}</span>`;
    }).join('');
    return { id, repoNow, liveNow, present, possible, checklist };
  });
}

/** How many features currently have a bug (in the repo or live), for the repo list badge. */
export function devBugCount(app: AppInstance, tmpl: AppTemplate | undefined): number {
  return devRows(app, tmpl).filter((r) => r.repoNow !== 'ok' || (app.deployed && r.liveNow !== 'ok')).length;
}

const pill = (label: string, v: string) => `<span class="dvb-pill ${v === 'ok' ? 'ok' : v === 'not deployed' ? 'off' : 'bad'}"><i>${label}</i>${esc(v)}</span>`;

export function devBugPanel(app: AppInstance, tmpl: AppTemplate | undefined): string {
  const rows = devRows(app, tmpl);
  const n = devBugCount(app, tmpl);
  const cards = rows.map((r) => `<div class="dvb-card">
      <div class="dvb-title"><b>${esc(r.id)}</b>${pill('repo', r.repoNow)}${pill('live', r.liveNow)}</div>
      ${r.checklist ? `<div class="dvb-line"><span class="dvb-k">Build prompt</span>${r.checklist}</div>` : ''}
      <div class="dvb-line"><span class="dvb-k">Possible bugs</span>${r.possible.map((p) => {
        const off = p.live && !app.deployed;
        const tip = off ? 'Deploy first: breaks only happen on the live site' : r.present.has(p.key) ? 'Click to remove' : p.live ? 'Click to break the live site' : 'Click to add to the repo and live build';
        return `<button class="dvb-tag${r.present.has(p.key) ? ' on' : ''}" data-devbug="${esc(`${app.id}|${r.id}|${p.key}`)}" title="${tip}"${off ? ' disabled' : ''}>${esc(p.label)}</button>`;
      }).join('') || '<i>none</i>'}</div>
    </div>`).join('');
  return `<section class="dev-bugs"><div class="dvb-head"><span class="dvb-badge">DEV</span><b>Bugs in ${esc(app.id)}</b><span class="dvb-sum ${n ? 'bad' : 'ok'}">${n ? `${n} feature${n > 1 ? 's' : ''} with a bug` : 'no bugs'}</span><span class="dvb-hint">Click a bug to switch it on or off</span></div>${cards}</section>`;
}
