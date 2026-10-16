/*
 * Deployed apps as real websites. Each feature renders from what was actually built: the spec's
 * params when it's right, or the concrete bug it shipped with (BuiltFeature.variant), so the player
 * finds problems by comparing the site with the client's email, not by reading a status label.
 * Templates get a renderer here; anything without one falls back to a plain generic site.
 */
import { type AppInstance, type AppBreak, type BuiltFeature, breakVariant } from '../engine';
import type { AppTemplate } from '../content/schema';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** What a feature looks like on the live site right now. */
interface Live {
  built?: BuiltFeature;
  brk?: AppBreak;
  /** The bug to render: the build's own, or the one a subtle break shows. */
  variant?: string;
  seed: number;
  params: Record<string, string | number>;
}

function live(app: AppInstance, tmpl: AppTemplate | undefined, id: string): Live {
  const built = app.features.find((f) => f.id === id);
  const brk = app.breaks.find((b) => b.featureId === id);
  let variant = built && !built.correct ? built.variant : undefined;
  const seed = brk?.seed ?? built?.seed ?? 0;
  if (brk && !variant) variant = breakVariant(brk, tmpl?.features.find((f) => f.id === id));
  return { built, brk, variant, seed, params: built?.params ?? app.specParams[id] ?? {} };
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
}

export function renderAppSite(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras = {}): string {
  if (app.template === 'restaurant') return restaurant(app, tmpl, page, extras);
  return generic(app, tmpl, page);
}

// ── restaurant ──

interface Dish { name: string; price: string }

const parseDishes = (v: unknown): Dish[] =>
  String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)$/);
    return m ? { name: m[1], price: m[2].replace(',', '.') } : { name: x, price: '' };
  });

// what the agent reaches for when nobody told it the menu
const INVENTED: Dish[] = [
  { name: 'Spaghetti Carbonara', price: '16' }, { name: 'Bruschetta al Pomodoro', price: '8' },
  { name: 'Risotto ai Funghi', price: '17' }, { name: 'Pizza Capricciosa', price: '13' },
  { name: 'Penne all\'Arrabbiata', price: '12' }, { name: 'Ossobuco alla Milanese', price: '24' },
  { name: 'Panna Cotta', price: '6' }, { name: 'Cannoli Siciliani', price: '7' },
  { name: 'Pizza Hawaii', price: '13' }, { name: 'Caprese Salad', price: '9' },
];
const RENAMES: Record<string, string> = {
  Margherita: 'Margarita', Diavola: 'Diablo', Lasagne: 'Lasagna Bolognese', Tiramisu: 'Tiramisu Deluxe',
  Espresso: 'Expresso', 'Quattro Formaggi': 'Quattro Stagioni', 'Pizza Funghi': 'Pizza Fungo',
};
const WRONG_HOURS = ['12:00–15:00', '17:00–20:00', '11:00–23:00', '18:00–02:00'];

function misspell(name: string, seed: number): string {
  const tries = [
    (n: string) => n.replace(/([aeiou])([^aeiou]*)$/i, (_m, _v, rest) => 'a' + rest), // Gino -> Gina
    (n: string) => n.replace(/(\w)\1/, '$1'), // Trattoria -> Tratoria
    (n: string) => n.replace(/(\s)\w/, (_m, sp) => sp + 'D'), // Gino -> Dino
  ];
  for (let i = 0; i < tries.length; i++) {
    const out = tries[(seed + i) % tries.length](name);
    if (out !== name) return out;
  }
  return name + 's';
}

function menuDishes(l: Live): { dishes: Dish[]; currency: string } {
  const spec = parseDishes(l.params.dishes);
  switch (l.variant) {
    case 'hallucinated': {
      const start = l.seed % INVENTED.length;
      return { dishes: [0, 3, 6, 1, 7].map((k) => INVENTED[(start + k) % INVENTED.length]), currency: 'DOLR' };
    }
    case 'prices_missing': return { dishes: spec.map((d) => ({ ...d, price: '' })), currency: '' };
    case 'prices_curo': return { dishes: spec, currency: 'CURO' };
    case 'wrong_items': {
      const d = spec.slice();
      if (!d.length) return { dishes: d, currency: 'DOLR' };
      const i = l.seed % d.length;
      const how = Math.floor(l.seed / 7) % 3;
      if (how === 0 && d.length > 1) d.splice(i, 1);
      else if (how === 1) d[i] = { ...d[i], name: RENAMES[d[i].name] ?? `${d[i].name} Speciale` };
      else d.splice(Math.min(i + 1, d.length), 0, INVENTED.find((x) => !d.some((y) => y.name === x.name)) ?? INVENTED[0]);
      return { dishes: d, currency: 'DOLR' };
    }
    default: return { dishes: spec, currency: 'DOLR' };
  }
}

function restaurant(app: AppInstance, tmpl: AppTemplate | undefined, page: string | undefined, extras: SiteExtras): string {
  const landing = live(app, tmpl, 'landing');
  const menu = live(app, tmpl, 'menu');
  const hasLanding = !!landing.built;
  const specName = String(landing.params.name ?? app.name);
  const name = !hasLanding ? 'My Restaurant' : landing.variant === 'name_wrong' ? misspell(specName, landing.seed) : specName;
  const hoursSpec = String(landing.params.hours ?? '').replace('-', '–');
  const hours = landing.variant === 'hours_wrong' ? WRONG_HOURS[landing.seed % WRONG_HOURS.length] : hoursSpec;

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
  } else if (page === 'booking' && extras.booking) {
    body = `<section class="as-r-book">${extras.booking}</section>`;
  } else body = notFound();

  const foot = `<footer class="as-r-foot">© ${esc(name)}${hours && hasLanding ? ` · ${esc(hours)}` : ''}<span>Built with Forkyard</span></footer>`;
  return `<div class="as as-r">${header}<main>${body}</main>${foot}</div>`;
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

interface DevRow { id: string; repoNow: string; liveNow: string; present: Set<string>; possible: string[]; checklist: string }

function devRows(app: AppInstance, tmpl: AppTemplate | undefined): DevRow[] {
  return app.required.map((id) => {
    const def = tmpl?.features.find((f) => f.id === id);
    const repo = app.repo.find((f) => f.id === id);
    const liveF = app.features.find((f) => f.id === id);
    const brk = app.breaks.find((b) => b.featureId === id);
    const repoNow = !repo ? 'missing' : repo.correct ? 'ok' : repo.variant ?? 'wrong';
    const liveNow = !app.deployed ? 'not deployed'
      : brk ? `${BREAK_LABEL[brk.failure] ?? brk.failure}${brk.failure === 'subtle' ? `: ${breakVariant(brk, def) ?? '?'}` : ''}`
      : !liveF ? 'missing' : liveF.correct ? 'ok' : liveF.variant ?? 'wrong';
    const present = new Set([repo?.variant, liveF?.variant, brk && BREAK_LABEL[brk.failure], brk && breakVariant(brk, def)].filter(Boolean) as string[]);
    const possible = [
      ...(def?.bugs ?? []).map((b) => b.id),
      ...(def?.details?.length ? ['hallucinated', 'outdated'] : []),
      ...(def?.failures ?? []).map((f) => BREAK_LABEL[f] ?? f),
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
      <div class="dvb-line"><span class="dvb-k">Possible bugs</span>${r.possible.map((p) => `<span class="dvb-tag${r.present.has(p) ? ' on' : ''}">${esc(p)}</span>`).join('') || '<i>none</i>'}</div>
    </div>`).join('');
  return `<section class="dev-bugs"><div class="dvb-head"><span class="dvb-badge">DEV</span><b>Bugs in ${esc(app.id)}</b><span class="dvb-sum ${n ? 'bad' : 'ok'}">${n ? `${n} feature${n > 1 ? 's' : ''} with a bug` : 'no bugs'}</span></div>${cards}</section>`;
}
