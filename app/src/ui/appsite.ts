/*
 * Deployed apps as real websites. Each feature renders from what was actually built: the spec's
 * params when it's right, or the concrete bug it shipped with (BuiltFeature.variant), so the player
 * finds problems by comparing the site with the client's email, not by reading a status label.
 * Templates get a renderer here; anything without one falls back to a plain generic site.
 */
import { type AppInstance, type AppBreak, type BuiltFeature, breakVariant, bugsOf, UNNAMED_BUG } from '../engine';
import type { AppTemplate } from '../content/schema';
import { menuDishes, misspell, WRONG_HOURS } from '../engine/restaurant';
import { crawl, autoBuys, portfolio, type MarketPost } from '../engine/crawler';
import { machineRows } from '../engine/laundromat';
import { dateShort } from '../engine/calendar';

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

function crawler(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const posts = extras.market ?? [];
  const f = Object.fromEntries(['tickers', 'sentiment', 'filter', 'top_posts', 'portfolio', 'auto_buy'].map((id) => [id, live(app, tmpl, id)]));
  const bugs = new Set(Object.values(f).flatMap((l) => [...l.bugs]));
  // without the filter it counts everything it finds
  if (!f.filter.built) { bugs.add('bots_counted'); bugs.add('untagged_counted'); }
  const head = `<header class="as-s-head"><b>${esc(app.name)}</b><span>$-tagged posts on Y</span></header>`;
  if (page && page !== 'dash') return `<div class="as as-s">${head}<main>${notFound()}</main></div>`;
  let body: string;
  if (!f.tickers.built) body = `<p class="as-s-empty">Nothing tracked yet.</p>`;
  else {
    // a failed fetch leaves yesterday's summary up (or nothing, on the first day)
    const fetchFailed = f.tickers.brk?.failure === 'failed_fetch';
    const dataDay = fetchFailed ? day - 1 : day;
    const rows = crawl(fetchFailed && dataDay < 1 ? [] : posts, dataDay, bugs);
    const cards = rows.map((r) => {
      const split = f.sentiment.built && r.count
        ? `<div class="as-s-bar"><i class="bull" style="width:${r.bullish}%"></i><i class="neu" style="width:${r.neutral}%"></i><i class="bear" style="width:${r.bearish}%"></i></div>
           <p class="as-s-split"><span class="bull">${r.bullish}% bullish</span><span>${r.neutral}% neutral</span><span class="bear">${r.bearish}% bearish</span></p>` : '';
      let top = '';
      if (f.top_posts.built) {
        top = outage(f.top_posts, 'the top posts') ?? (r.top.length
          ? `<ol class="as-s-top">${r.top.map((p) => `<li><a href="#" data-nav="y.com/${esc(p.handle)}">@${esc(p.handle)}</a> ${esc(p.text)} <small>${p.likes.toLocaleString('en-US')} likes</small></li>`).join('')}</ol>`
          : '');
      }
      return `<section class="as-s-card"><h2>$${esc(r.ticker)}</h2><p class="as-s-count"><b>${r.count}</b> post${r.count === 1 ? '' : 's'} today</p>${split}${top}</section>`;
    }).join('');
    body = `<p class="as-s-upd">Updated ${dateShort(dataDay < 1 ? day : dataDay)}</p><div class="as-s-grid">${cards}</div>`;
  }
  const buys = f.auto_buy.built ? autoBuys(posts, day, bugs) : [];
  if (f.portfolio.built) {
    const pf = portfolio(buys, day, bugs);
    body += `<section class="as-s-pf"><h2>Portfolio</h2><table>${pf.holdings.map((h) => `<tr><td>$${esc(h.ticker)}</td><td>${h.shares} shares</td><td>${money(h.price)}</td><td>${money(h.value)}</td></tr>`).join('')}
      <tr class="cash"><td>Cash</td><td></td><td></td><td>${money(pf.cash)}</td></tr></table>
      <p class="as-s-total">Total <b>${money(pf.total)} DOLR</b> <span class="${pf.change >= 0 ? 'bull' : 'bear'}">${signed(pf.change)} today</span></p></section>`;
  }
  if (f.auto_buy.built) {
    const log = buys.slice().reverse().map((b) => `<li>${dateShort(b.day)}: bought ${b.shares} $${esc(b.ticker)} at ${money(b.price)} on <a href="#" data-nav="y.com/${esc(b.post.handle)}">@${esc(b.post.handle)}</a> “${esc(b.post.text)}”</li>`).join('');
    body += `<section class="as-s-buys"><h2>Auto-buy</h2>${log ? `<ul>${log}</ul>` : '<p>No buys yet. Watching @randall_crane.</p>'}</section>`;
  }
  return `<div class="as as-s">${head}<main>${body}</main></div>`;
}

// ── laundromat ──

const MACHINE_LABEL = { free: 'Free', running: 'Running', done: 'Done, waiting for pickup', broken: 'Out of order' };

function laundromat(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const day = extras.day ?? 1;
  const f = Object.fromEntries(['machines', 'refresh', 'minutes', 'more_machines'].map((id) => [id, live(app, tmpl, id)]));
  const bugs = new Set(Object.values(f).flatMap((l) => [...l.bugs]));
  const head = `<header class="as-l-head"><b>${esc(app.name)}</b><span>Spin Cycle Laundry · 201 Ferris St</span></header>`;
  if (page && page !== 'status') return `<div class="as as-l">${head}<main>${notFound()}</main></div>`;
  let body: string;
  if (!f.machines.built) body = `<p class="as-l-empty">No machines yet.</p>`;
  else if (f.machines.brk?.failure === 'failed_fetch' || f.refresh.brk?.failure === 'failed_fetch') body = `<p class="as-l-empty">No machines found.</p>`;
  else {
    // without a working refresh it shows what the feed said when it was deployed
    const dataDay = f.refresh.built && !bugs.has('no_refresh') ? day : app.lastDeployDay || day;
    const rows = machineRows(dataDay, bugs, { showMinutes: !!f.minutes.built, twelve: !!f.more_machines.built });
    const broken = bugs.has('layout_breaks') && rows.length > 8;
    const cards = rows.map((m) => `<div class="as-l-m ${m.status}"><b>M${m.id}</b><span>${MACHINE_LABEL[m.status]}</span>${m.minutes != null ? `<small>${m.minutes} min left</small>` : ''}</div>`).join('');
    body = `<div class="as-l-grid${broken ? ' broken' : ''}">${cards}</div><p class="as-l-upd">Updated ${dateShort(dataDay)}</p>`;
  }
  return `<div class="as as-l">${head}<main>${body}</main></div>`;
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
