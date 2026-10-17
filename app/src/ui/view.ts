/*
 * The view: pure functions that return the legacy game's exact markup (class for class) from the
 * store. main.ts owns the DOM and drops these strings into the shell slots. Styling comes from the
 * legacy stylesheet (../../src/style.css); nothing here invents new classes.
 */
import { SOUND } from './sound';
import { type GameStore, CHARGE_DELAY_MS } from '../game/store';
import { MISSES } from '../game/misses';
import { JEV } from '../game/backendJev';
import { listSlots, autoSlot } from '../game/saves';
import { ICONS, TOKENS, Y_ICONS } from './icons';
import { route, bookmarks, type Route, type SiteId } from '../sites/registry';
import {
  type GameState, type MailEntry, type AppInstance, getApp, bugsOf, breakVariant, onForkyard, userRevenue, appWorking, agentCost, promptCost, RENT, LAST_DAY, AGENT_COST, AGENT_WORK, dateShort, dateLong, dateMedium, dateFull, dayDate, clockTime, gameMinutes, EMPIRE, BOUNCE_ADDR, eventBody, deliveryKey,
} from '../engine';
import { BUSINESSES, YOWL_SEED, type Business } from './yowl-data';
import { findUser } from './forkyard-users';
import { pageDrive } from './qdrive';
import { pageSherwood } from './sherwood';
import { pageDoorDish } from './doordish';
import { pageAdSite, adSiteTitle, adSiteIcon } from './adSites';
import { isVantorAddr, vantorSignature } from './vantor';
import { pagePrince, PRINCE_ICON } from './prince';
import { pageLonely, LONELY_ICON } from './lonely';
import { adHtml } from './ads';
import { MODELS, PULL_MS, pullLines, pullPct } from '../game/pull';
import { groupThreads, baseSubject } from './mailThreads';
import { renderAppSite, devBugPanel, devBugCount, appLogo } from './appsite';
import { marketPosts, cranePosts, fillerToday, postMin, handleOf, playMinutes, machineFeed, FEED_PAGE, PLAYER_WALLET, PHISH_WALLET, hacked, SEED_PHRASE, inBin, isDeleted, CLOCK } from '../engine';
import { devOptionsButton, devOptionsPanel } from './devOptions';
import { repoFiles, treeAt, fileSource } from './repoTree';
import { yBio } from './y-bios';

const WALLET_ADDR = PLAYER_WALLET;
const PLAYER = { name: 'You', handle: 'you', addr: 'you@qmail.com' };
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function fmtMoney(n: number) { return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function compact(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function hashHue(s: string) { let h = 0; for (const c of s) h = (h * 33 + c.charCodeAt(0)) >>> 0; return h % 360; }
function avatar(name: string, handle: string) {
  const initials = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return `<div class="av" style="--h:${hashHue(handle)}">${esc(initials)}</div>`;
}
const handleFrom = handleOf;
const br = (t: string) => esc(t).replace(/\n/g, '<br>');
const tpl = (t: string) => String(t ?? '').replace(/\{\{\s*playerName\s*\}\}/g, 'you').replace(/\{\{\s*\w+\s*\}\}/g, '');

function linkify(escaped: string): string {
  return escaped
    .replace(/([a-z0-9-]+\.forkyard\.app)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(empire\.alphaascend\.biz(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(spincycle\.test\/feed(?:\/\d+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(coinbln\.com(?:\/[a-z0-9-]+)?)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(^|[^\w.])@([a-z0-9_]+)/gi, '$1<a href="#" class="y-at" data-nav="y.com/$2">@$2</a>');
}

function tabTitle(r: Route, url: string): string {
  const names: Partial<Record<string, string>> = {
    newtab: 'New Tab', y: 'Home / Y', qmail: 'Qmail', qdrive: 'Qdrive', coinbin: 'Coinbin', sherwood: 'Sherwood', doordish: 'DoorDish', phish: 'Coinbin · Sign in', prince: 'Crypto Prince', lonely: 'Lonely.ai', forkyard: 'Forkyard',
    agent: 'agent', yowl: 'Yowl', weightroom: 'Weightroom', nullboard: 'nullboard', cellar: 'Cellar', app: url,
  };
  if (r.site === 'notfound') return url || 'New Tab';
  if (r.site === 'adsite') return adSiteTitle(r.param ?? '') ?? url;
  return names[r.site] ?? r.def?.label ?? url;
}

// ── chrome slots (main.ts paints these into the static shell) ──
export function tabsHtml(store: GameStore): string {
  // unread counts sit on the first tab showing that site (the pinned one, unless it was moved)
  const counts: Record<string, number> = { qmail: qmailBadge(store), y: store.ui.yUnread };
  const badged = new Set<string>();
  return store.tabs.map((t) => {
    const rr = route(t.url, store.state);
    // a deployed app with a logo shows it as its favicon
    const app = rr.site === 'app' && rr.param ? getApp(store.state, rr.param.split('/')[0]) : undefined;
    // ad sites (and Spin Cycle's raw feed) show their brand's mark
    const logo = (app && appLogo(app.template)) || (rr.site === 'adsite' ? adSiteIcon(rr.param ?? '') : rr.site === 'spinfeed' ? adSiteIcon('spincycle.test') : rr.site === 'prince' ? PRINCE_ICON : rr.site === 'lonely' ? LONELY_ICON : undefined);
    const n = !badged.has(rr.site) ? counts[rr.site] ?? 0 : 0;
    badged.add(rr.site);
    return `<div class="tab${t.id === store.active ? ' on' : ''}${t.pinned ? ' pinned' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === store.active}" tabindex="0">
      <span class="tab-ico ico-${logo ? 'applogo' : rr.site}">${logo || ICONS[rr.site] || ICONS.newtab}</span><span class="tab-title">${esc(tabTitle(rr, t.url))}</span>${n ? `<i class="badge" aria-label="${n} unread">${n > 99 ? '99+' : n}</i>` : ''}
      ${t.pinned ? '' : `<button class="tab-x" data-close="${t.id}" aria-label="Close tab">×</button>`}</div>`;
  }).join('') + `<button class="tab-new" data-newtab aria-label="New tab">+</button>`;
}
export function bookmarksHtml(store: GameStore): string {
  return bookmarks(store.state).map((b) =>
    `<button class="bm" data-nav="${b.base}"><span class="bm-ico ico-${b.id}">${ICONS[b.id] || ICONS.newtab}</span><span class="bm-label">${esc(b.label)}</span></button>`).join('');
}
export function addressValue(store: GameStore): string {
  const r = route(store.url, store.state);
  return r.site === 'newtab' ? '' : store.url;
}
export function viewportSite(store: GameStore): string {
  const r = route(store.url, store.state);
  return r.reachable ? r.site : 'error';
}
export function objective(s: GameState): string {
  if (s.ending) return 'Chapter over.';
  const rentDay = rentDayOf(s);
  if (rentDay) return `Make rent: ${RENT[rentDay]} DOLR by the end of ${dateFull(rentDay)}.`;
  return 'Keep the lights on.';
}
const rentDayOf = (s: GameState) => Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= s.values.day);
export function rentLine(s: GameState): string {
  const rentDay = rentDayOf(s);
  if (!rentDay) return 'Rent clear';
  const left = rentDay - s.values.day;
  return `Rent ${fmtMoney(RENT[rentDay])} ${left === 0 ? 'due tonight' : `in ${left}d`}`;
}
export function rentLow(s: GameState): boolean { const d = rentDayOf(s); return !!d && s.values.crypto < RENT[d]; }
export const fmtClock = clockTime;
export function clockHtml(s: GameState): string {
  const near = s.clockMin >= CLOCK.sleep - 60; // the last hour before bedtime
  return `<b class="${near ? 'late' : ''}">${fmtClock(s.clockMin)}</b><span>${dateMedium(s.values.day)}</span>`;
}

// ── desktop: taskbar window entry + home menu ──
export function taskTitle(store: GameStore): string {
  const r = route(store.url, store.state);
  return `Browser — ${r.site === 'newtab' ? 'New tab' : store.url}`;
}
/** The window list: the browser, and the Terminal once a model is on the laptop. */
export function tasksHtml(store: GameStore): string {
  const { termOpen, termShown } = store.ui;
  const browser = `<button class="dk-task${termShown ? ' open' : ' on'}" data-task="browser" title="${esc(taskTitle(store))}" aria-label="Browser">${BROWSER_ICON}</button>`;
  if (!store.state.flags.includes('has_terminal') && !store.pull) return browser;
  const cls = termShown ? ' on' : termOpen ? ' open' : '';
  return browser + `<button class="dk-task dk-term${cls}" data-task="terminal" title="Terminal" aria-label="Terminal">${ICONS.terminal}</button>`;
}
// a Firefox knockoff: no fox, just the globe, burning (drawn once, so the gradient ids can't clash)
const BROWSER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="globe-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e3215a"/><stop offset=".5" stop-color="#ff6a2b"/><stop offset="1" stop-color="#ffb02e"/></linearGradient><radialGradient id="globe-sea" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#8f63ff"/><stop offset="1" stop-color="#4a22b5"/></radialGradient></defs><path d="M12 23.4A10.6 10.6 0 0 1 2.2 9.6C1.7 7.6 2 5.6 3 3.8c.4 1.6 1.2 2.6 2.2 3C5.4 4.4 6.6 2.4 8.6 1c-.3 1.8 0 3.2.9 4C10 2.8 11.2 1 13.2 0c-.4 1.9-.1 3.4.8 4.4.6-1.5 1.7-2.6 3.2-3.2-.5 1.7-.3 3.2.6 4.3.8-.8 1.8-1.4 3-1.6-.6 1.4-.6 2.9 0 4.2A10.6 10.6 0 0 1 12 23.4z" fill="url(#globe-fire)"/><path d="M12 21.6a8.6 8.6 0 0 1-8-12c-.2-1.2 0-2.3.5-3.3.4 1 1 1.6 1.8 1.9.3-1.6 1.1-3 2.4-4-.1 1.2.2 2.2.9 2.9.4-1.6 1.4-3 2.8-3.8-.2 1.3.1 2.4.8 3.2.5-1 1.3-1.8 2.4-2.2-.3 1.2-.1 2.3.6 3.1.6-.5 1.3-.8 2.1-.9-.4 1-.4 2 .1 2.9A8.6 8.6 0 0 1 12 21.6z" fill="#ffd23f"/><circle cx="12" cy="13.6" r="6.8" fill="url(#globe-sea)"/><g transform="translate(-.6 1)"><path d="M9.2 8.4c1.3.4 1.9 1.4 1.5 2.5-.4.9-1.5 1-1.6 2-.1 1 1 1.6.5 2.7-.4.8-1.4 1-2.4.6A6.6 6.6 0 0 1 9.2 8.4zM14.6 6.6c1 .6 1.1 1.7.4 2.5-.8.8-.2 1.8 1 2 1.3.2 2.4.9 3 2-.3 1.9-1.2 3.4-2.6 4.5-.2-1.2 0-2.4-.9-3.1-.9-.7-2.1-.4-2.6-1.5-.5-1.1.5-1.9.2-3-.2-.9-.9-1.3-.8-2.3.1-.4.4-.8 1.3-1.1z" fill="#a98bff" fill-opacity=".75"/></g><circle cx="12" cy="13.6" r="6.8" fill="none" stroke="#3a1a96" stroke-width=".6"/></svg>';
const MI = {
  sleep: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.4M12 16.8v.2"/></svg>',
  term: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15H17"/></svg>',
  slot: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M14 4H6v16h8M10 12h10m-3-3 3 3-3 3"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/><path d="M12 8v4l3 2"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 5.5h16v10H10l-4 3.5v-3.5H4z"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};
function autoRow(): string {
  const a = autoSlot();
  return `<div class="dm-slot dm-auto${a ? '' : ' empty'}">${MI.clock}<span><b>Autosave${a ? ` · ${dateShort(a.day)}` : ''}</b><small>${a ? 'Start of the day · ' + esc(fmtClock(a.clockMin)) : 'Made each morning after you sleep'}</small></span>
    <span class="dm-slot-acts">${a ? '<button data-slot-load="auto">Load</button>' : ''}</span></div>`;
}
/** System menu: mute, and the volume slider (it stays as dragged; the menu isn't redrawn under it). */
function soundRows(): string {
  const { muted, volume } = SOUND.settings;
  return `<button class="dm-item" data-act="sound">${muted ? MI.muted : MI.sound}<span><b>Sound: ${muted ? 'off' : 'on'}</b><small>${muted ? 'Unmute the laptop' : 'Mute the laptop'}</small></span></button>
    <label class="dm-slot dm-vol">${MI.sound}<span><b>Volume</b><input type="range" id="snd-vol" min="0" max="100" step="1" value="${Math.round(volume * 100)}" aria-label="Volume"${muted ? ' disabled' : ''}></span></label>`;
}
/** System menu: whether Jev is deciding, and who writes the replies to misses (Haiku or scripted lines). */
function aiRows(): string {
  const jev = JEV.mode === 'online' ? ['', 'Story decisions: Jev', 'Online'] as const
    : JEV.mode === 'checking' ? [' off', 'Story decisions: checking Jev…', 'Asking the proxy'] as const
    : [' off', 'Story decisions: Jev offline', JEV.reason || "Nothing gets decided until it's back"] as const;
  const st = MISSES.settings;
  const sel = (cur: string, v: string, l: string) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  let missNote = st.misses === 'haiku' ? 'Haiku answers in character' : 'Scripted lines only';
  let err = false;
  if (st.misses === 'haiku' && st.haikuVia === 'api' && JEV.haikuKey === false) { missNote = 'ANTHROPIC_API_KEY is not set in app/.env, so misses use scripted lines'; err = true; }
  else if (st.misses === 'haiku' && JEV.haikuKey === null && JEV.mode !== 'checking') { missNote = 'Start the proxy (npm run proxy) for Haiku replies'; err = true; }
  return `<div class="dm-slot dm-jev" title="${esc(JEV.reason)}"><i class="dm-dot${jev[0]}"></i><span><b>${esc(jev[1])}</b><small>${esc(jev[2])}</small></span></div>
    <label class="dm-slot dm-ai" title="What agent and email contacts say when Jev finds nothing in your message">${MI.chat}<span><b>Misses</b><small${err ? ' class="dm-err"' : ''}>${esc(missNote)}</small></span>
      <span class="dm-slot-acts"><select id="llm-misses">${sel(st.misses, 'haiku', 'Haiku (API)')}${sel(st.misses, 'scripted', 'Scripted lines')}</select></span></label>` +
    (st.misses === 'haiku' ? `<label class="dm-slot dm-ai" title="Subscription runs the claude CLI on your machine (dev only, slow); API uses ANTHROPIC_API_KEY">${MI.key}<span><b>Haiku via</b><small>${st.haikuVia === 'api' ? 'ANTHROPIC_API_KEY' : 'The claude CLI (slow)'}</small></span>
      <span class="dm-slot-acts"><select id="llm-haiku-via">${sel(st.haikuVia, 'api', 'API key')}${sel(st.haikuVia, 'subscription', 'Claude subscription')}</select></span></label>` : '');
}
export function startMenuHtml(store: GameStore): string {
  const s = store.state;
  const cat = store.ui.menuCat;
  const cats = [['saves', MI.folder, 'Saved games'], ['system', MI.gear, 'System']]
    .map(([id, icon, label]) => `<button class="dm-cat${cat === id ? ' on' : ''}" data-menu-cat="${id}">${icon}${label}</button>`).join('');
  const item = (act: string, icon: string, title: string, sub: string) =>
    `<button class="dm-item" data-act="${act}">${icon}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></button>`;
  const list = cat === 'system'
    ? item('new', MI.logout, 'New game', `Start over from ${dateLong(1)}`) + item('intro', MI.help, 'How to play', 'The rules, again') + item('devmode', MI.help, `Dev mode: ${store.devMode ? 'on' : 'off'}`, 'Show how agent replies were chosen') + item('dev', MI.term, 'Story debugger', 'jev · Ctrl+`') + aiRows() + soundRows()
    : autoRow() + listSlots().map((info, i) => {
      const n = i + 1;
      const when = info ? `${fmtClock(info.clockMin)} · saved ${new Date(info.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric' })}` : 'Empty';
      return `<div class="dm-slot${info ? '' : ' empty'}">${MI.slot}<span><b>Slot ${n}${info ? ` · ${dateShort(info.day)}` : ''}</b><small>${esc(when)}</small></span>
        <span class="dm-slot-acts">${info ? `<button data-slot-load="${n}">Load</button>` : ''}<button data-slot-save="${n}">Save</button></span></div>`;
    }).join('') + (store.ui.slotNote ? `<p class="dm-note dm-err" role="alert">${esc(store.ui.slotNote)}</p>` : '') + '<p class="dm-note">Your current game saves itself as you play. The autosave is a snapshot from the start of each day.</p>';
  return `<aside class="dm-side">
      <span class="dm-avatar" title="${esc(PLAYER.name)}">${ICONS.agent}</span>
      <span class="dm-side-gap"></span>
      <button class="dm-side-btn" data-act="new" title="New game (log out)">${MI.logout}</button>
      <button class="dm-side-btn dm-sleep" data-act="sleep" title="Sleep until tomorrow">${MI.sleep}</button>
    </aside>
    <div class="dm-main">
      <header class="dm-head"><b>${esc(PLAYER.name)}</b><span>${dateFull(s.values.day)}</span>
        <button class="dm-sleep-wide" data-act="sleep">${MI.sleep}Sleep</button></header>
      <div class="dm-body"><nav class="dm-cats">${cats}</nav><div class="dm-list">${list}</div></div>
    </div>`;
}

function qmailBadge(store: GameStore): number {
  return mailRows(store).filter((r) => r.folder === 'inbox' && r.unread && !r.binned).length;
}

/** The stock posts the crawler reads: only ones on the Y timeline right now, so the player can check every number. */
function crawlable(store: GameStore) {
  const onY = new Set(yPosts(store).map((p) => p.id));
  return marketPosts(store.state, store.content).filter((p) => onY.has(p.id));
}

// ── Spin Cycle's raw machine feed: the ground truth for the laundromat app ──
function pageSpinFeed(store: GameStore, param?: string): string {
  const m = param?.match(/^feed(?:\/(\d+))?$/);
  if (!m) return `<pre class="spinfeed">404 not found</pre>`;
  const feed = machineFeed(store.state.values.day, store.state.clockMin);
  const pages = Math.ceil(feed.length / FEED_PAGE);
  const n = Math.min(Math.max(Number(m[1] ?? 1), 1), pages);
  const lines = feed.slice((n - 1) * FEED_PAGE, n * FEED_PAGE).map((x) => `M${x.id} ST=${x.st} T=${x.t}`).join('\n');
  const next = n < pages ? `<a href="#" data-nav="spincycle.test/feed/${n + 1}">next=/feed/${n + 1}</a>` : 'next=null';
  const first = n > 1 ? `\n<a href="#" data-nav="spincycle.test/feed">first=/feed</a>` : '';
  return `<pre class="spinfeed">SPINCYCLE STATUS FEED v1\npage=${n}/${pages} · ${FEED_PAGE} machines per page\n\nFIELDS\n  M   machine number\n  ST  status: 0 free, 1 running, 2 done (waiting for pickup), 3 out of order\n  T   seconds left on the cycle (0 unless running)\n\n${lines}\n\n${next}${first}</pre>`;
}

// ── page dispatch ──
export function page(store: GameStore, r: Route): string {
  if (!r.reachable) return pageError(store.url, r.site);
  switch (r.site) {
    case 'newtab': return pageNewTab(store);
    case 'qmail': return pageMail(store, r.param);
    case 'qdrive': return pageDrive(store.state, r.param);
    case 'y': return pageY(store, r.param);
    case 'coinbin': return pageWallet(store);
    case 'sherwood': return pageSherwood(store, r.param);
    case 'doordish': return pageDoorDish(store, r.param);
    case 'forkyard': return pageForkyard(store, r.param);
    case 'app': return pageApp(store, r.param);
    case 'agent': return r.param === 'models' ? pageModels(store) : pageAgent(store);
    case 'yowl': return pageYowl(store, r.param);
    case 'weightroom': return pageWeightroom(store);
    case 'empire': return pageEmpire(store.state);
    case 'spinfeed': return pageSpinFeed(store, r.param);
    case 'phish': return pagePhish(store);
    case 'prince': return pagePrince(store);
    case 'lonely': return pageLonely(store);
    case 'adsite': return pageAdSite(r.param ?? '', store.state);
    default: return pageUnderground(r.def?.label ?? r.site);
  }
}

const ERR_ICON = '<svg class="err-ico" viewBox="0 0 48 48" aria-hidden="true"><path d="M12 4h17l11 11v29H12z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M29 4v11h11" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 37c1.6-2.6 3.6-3.8 6-3.8s4.4 1.2 6 3.8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="26" r="2.2" fill="currentColor"/><circle cx="30" cy="26" r="2.2" fill="currentColor"/></svg>';

function pageError(url: string, site: SiteId): string {
  const host = esc(url.split('/')[0] || url);
  const reload = url ? `<button class="err-btn" data-nav="${esc(url)}">Reload</button>` : '';
  const page = (title: string, lead: string, tips: string[], code: string) =>
    `<div class="err"><div class="err-box">${ERR_ICON}<h1>${title}</h1><p class="err-lead">${lead}</p>
      <p class="err-try">Try:</p><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
      <p class="err-code">${code}</p>${reload}</div></div>`;
  if (site === 'notfound' || !url) return page("This site can't be reached",
    `<b>${host}</b>'s server IP address could not be found.`,
    ['Checking the address for typos', 'Checking the connection', 'The bookmarks. They are the only sites you can afford.'],
    'DNS_PROBE_FINISHED_NXDOMAIN');
  return page("This site can't be reached", `You haven't discovered <b>${esc(url)}</b> yet.`,
    ['Finding a link to it somewhere first', 'Checking the bookmarks'],
    'ERR_ADDRESS_UNREACHABLE');
}

function pageNewTab(store: GameStore): string {
  const s = store.state;
  const tiles = bookmarks(s).map((b) => `<button class="nt-tile nt-${b.id}" data-nav="${b.base}"><span class="nt-ico">${ICONS[b.id] || ICONS.newtab}</span><span>${esc(b.label)}</span></button>`).join('');
  return `<div class="newtab"><p class="nt-time">${dateFull(s.values.day)}</p>
    <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
    <div class="nt-tiles">${tiles}</div></div>`;
}

// ── Qmail ──

/** Dev-mode label under an email that came from a script rather than Haiku. */
const SCRIPTED_MAIL: Record<NonNullable<MailEntry['scripted']>, string> = {
  hint: 'Scripted hint (Jev read a near miss)',
  outcome: 'Scripted storyline outcome',
  topic: 'Scripted topic reply',
};
interface Row { id: string; seq: number; /** Minutes since midnight it arrived, when known. */ min?: number; from: string; addr: string; subject: string; body: string; day: number; unread: boolean; needsReply: boolean; folder: 'inbox' | 'sent'; eventId?: string; generated?: boolean; scripted?: MailEntry['scripted']; to?: string; link?: string; bounceOf?: string; bookingId?: string; /** In the Bin until the day ends. */ binned?: boolean }
/** Messages the player opened or closed in a conversation, so a repaint keeps them that way. */
export const mailOpen = new Map<string, boolean>();
function mailRows(store: GameStore): Row[] {
  const s = store.state;
  const rows: Row[] = [];
  for (const d of s.delivered.filter((x) => x.site === 'qmail')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    // A latent lead is never received on its own: its brief arrives inside the reply mail, so the reply
    // stands in for it (and stays hidden while that reply is on its way). Any other story email stays
    // in the inbox after it's answered.
    if (e.latent && (s.mail.some((m) => m.eventId === e.id && m.folder === 'inbox') || s.pendingMail?.some((p) => p.mail.eventId === e.id))) continue;
    const canReply = !!(e.outcomes && !d.answered);
    const key = deliveryKey(e, d.day);
    const id = 'e/' + key;
    if (isDeleted(s, id)) continue;
    rows.push({ id, binned: inBin(s, id), seq: d.seq ?? -1, min: d.min, from: e.from ?? 'Unknown', addr: e.addr ?? '', subject: e.subject ?? '', body: tpl(eventBody(e, d.day)), day: d.day, unread: !s.readEvents.includes(key), needsReply: canReply, folder: 'inbox', eventId: e.id });
  }
  for (const m of s.mail) if (!isDeleted(s, 'm/' + m.id)) rows.push({ id: 'm/' + m.id, binned: inBin(s, 'm/' + m.id), seq: m.seq ?? (Number(m.id.replace(/\D/g, '')) || 0), min: m.min, from: m.from, addr: m.addr, subject: m.subject, body: m.body, day: m.day, unread: m.folder === 'inbox' && !m.read, needsReply: false, folder: m.folder, eventId: m.eventId, generated: m.generated, scripted: m.scripted, to: m.to, link: m.link, bounceOf: m.bounceOf, bookingId: m.bookingId });
  return rows;
}
/** Today's mail shows the time it came in, older mail its date. */
const mailTime = (s: GameState, r: { day: number; min?: number }) => (r.day === s.values.day && r.min != null ? fmtClock(r.min) : dateShort(r.day));
function pageMail(store: GameStore, param?: string): string {
  const s = store.state;
  const view = param === 'sent' ? 'sent' : param === 'bin' ? 'bin' : param === 'compose' ? 'compose' : param?.startsWith('m/') || param?.startsWith('e/') ? 'msg' : 'inbox';
  const unread = qmailBadge(store);
  const rows = mailRows(store);
  const side = `<nav class="qm-side" aria-label="Folders">
    <a href="#" class="qm-new" data-nav="qmail.com/compose">Compose</a>
    <a href="#" data-nav="qmail.com" class="${view === 'inbox' ? 'on' : ''}">Inbox${unread ? `<b>${unread}</b>` : ''}</a>
    <a href="#" data-nav="qmail.com/sent" class="${view === 'sent' ? 'on' : ''}">Sent</a>
    <a href="#" data-nav="qmail.com/bin" class="${view === 'bin' ? 'on' : ''}">Bin</a>
    ${adHtml('qmail', s.values.day, 'square')}
  </nav>`;
  let main: string;
  if (view === 'compose') {
    const d = store.ui.draft || { to: '', subject: '', body: '' };
    // only people the player has already exchanged mail with; a first message is always typed by hand
    const known = new Map<string, string>();
    for (const r of rows) {
      const addr = r.folder === 'sent' ? r.to : r.addr;
      if (!addr || addr === PLAYER.addr || addr === BOUNCE_ADDR) continue;
      const name = r.folder === 'inbox' ? r.from : store.content.contacts.find((c) => c.key === addr)?.name;
      if (!known.has(addr) || (name && known.get(addr) === addr)) known.set(addr, name || addr);
    }
    const contacts = [...known].map(([addr, name]) => ({ addr, name }));
    main = `<form class="qm-compose" data-form="mail">
      <h1 class="qm-h">New message</h1>
      <div class="qm-to"><label class="qm-field"><span>To</span><input id="mail-to" autocomplete="off" spellcheck="false" value="${esc(d.to)}" placeholder="name@example.com" role="combobox" aria-autocomplete="list" aria-controls="qm-sugg" aria-expanded="false"></label>
        <ul id="qm-sugg" class="qm-sugg" role="listbox" hidden data-contacts="${esc(JSON.stringify(contacts))}"></ul></div>
      <label class="qm-field"><span>Subject</span><input id="mail-subject" autocomplete="off" value="${esc(d.subject)}"></label>
      <textarea id="mail-body" rows="10" aria-label="Message">${esc(d.body)}</textarea>
      <div class="qm-actions"><button class="qm-btn" type="submit">Send</button><button class="qm-btn ghost" type="button" data-mail-discard>Discard</button>${store.ui.mailError ? `<span class="qm-hint qm-err" role="alert">${esc(store.ui.mailError)}</span>` : '<span class="qm-hint">Free. One email per person per day.</span>'}</div>
    </form>`;
  } else if (view === 'msg') {
    const row = rows.find((x) => x.id === param);
    if (!row) main = `<p class="qm-empty">This message doesn't exist.</p>`;
    else {
      // the whole conversation, oldest first; what came in since the player last wrote starts expanded
      // binned emails form their own conversation, apart from anything in the same thread that isn't
      const thread = groupThreads(rows.filter((r) => !!r.binned === !!row.binned)).find((t) => t.rows.includes(row))!;
      for (const r of thread.rows) if (r.unread) store.markReadMail(r.id);
      const lastSent = thread.rows.map((r) => r.folder).lastIndexOf('sent');
      const inSent = thread.rows.every((r) => r.folder === 'sent');
      const ids = esc(JSON.stringify(thread.rows.map((r) => r.id)));
      const home = row.binned ? 'qmail.com/bin' : inSent ? 'qmail.com/sent' : 'qmail.com';
      const tools = row.binned
        ? `<span class="qm-bin-note">In the Bin. Deleted when the day ends.</span><button class="qm-btn ghost" data-mail-restore="${ids}" data-mail-home="qmail.com/bin">Restore</button>`
        : `<button class="qm-btn ghost" data-mail-bin="${ids}" data-mail-home="${home}" title="Move to Bin">${ICONS.bin}Bin</button>`;
      // one reply box for the conversation: a story email still waiting on an answer gets it, otherwise
      // it's an ordinary email back to the person on the other side
      const open = [...thread.rows].reverse().find((r) => r.needsReply);
      const who = thread.with;
      const canReply = !!open || (!!who && who !== PLAYER.addr && who !== BOUNCE_ADDR);
      const target = open
        ? `data-id="${esc(open.eventId ?? '')}"`
        : `data-to="${esc(who)}" data-subject="${esc('Re: ' + baseSubject(thread.rows[0].subject))}"`;
      const replyName = open?.from ?? [...thread.rows].reverse().find((r) => r.folder === 'inbox' && r.addr === who)?.from ?? who;
      const msgs = thread.rows.map((r, i) => {
        const expanded = mailOpen.get(r.id) ?? (i === thread.rows.length - 1 || (i > lastSent && r.folder === 'inbox'));
        const meta = r.folder === 'sent'
          ? `<b>${esc(PLAYER.name)}</b> &lt;${esc(PLAYER.addr)}&gt; to <b>${esc(r.to ?? '')}</b>`
          : `<b>${esc(r.from)}</b> &lt;${esc(r.addr)}&gt; to ${esc(PLAYER.addr)}`;
        return `<details class="qm-msg" data-msg="${esc(r.id)}"${expanded ? ' open' : ''}>
          <summary class="qm-meta"><span>${meta}<span class="qm-snip">${esc(r.body.replace(/\s+/g, ' ').slice(0, 90))}</span></span><span>${mailTime(s, r)}</span></summary>
          <div class="qm-body">${linkify(br(r.body))}</div>
          ${r.folder !== 'sent' && isVantorAddr(r.addr) ? vantorSignature() : ''}
          ${r.link === 'cancel' && r.bookingId ? (s.bookings.find((b) => b.id === r.bookingId)?.cancelClicked
            ? `<p class="qm-actions"><b>Your booking has been cancelled.</b></p>`
            : s.bookings.find((b) => b.id === r.bookingId)?.noShow ? `<p class="qm-actions"><b>This booking has passed.</b></p>`
            : `<p class="qm-actions"><button class="qm-btn ghost" data-cancel-booking="${esc(r.bookingId)}" data-cancel-url="${esc(`${r.addr.split('@')[1] ?? ''}/cancel-${r.bookingId}`)}">Cancel booking</button></p>`) : ''}
          ${r.generated ? `<p class="qm-gen">Reply written by ${esc(MISSES.label())}</p>` : r.scripted ? `<p class="qm-gen">${SCRIPTED_MAIL[r.scripted]}</p>` : ''}
        </details>`;
      }).join('');
      main = `<article class="qm-read">
        <div class="qm-tools"><p class="qm-crumbs"><a href="#" data-nav="${home}">${row.binned ? 'Bin' : inSent ? 'Sent' : 'Inbox'}</a></p>${tools}</div>
        <h1 class="qm-h">${esc(thread.rows[0].subject || '(no subject)')}${thread.rows.length > 1 ? ` <span class="qm-count">${thread.rows.length}</span>` : ''}</h1>
        <div class="qm-thread">${msgs}</div>
        ${canReply ? `<form class="qm-reply" data-form="reply" ${target}>
          <div class="qm-reply-head"><span class="qm-reply-to">Reply to <b>${esc(replyName)}</b></span><span class="qm-reply-hint">One email per person per day</span></div>
          <textarea id="reply-body" rows="3" placeholder="Write your reply…" ${store.busy ? 'disabled' : ''}></textarea>
          <div class="qm-reply-foot"><span class="qm-reply-cta">⏎ to send · ⇧⏎ for a new line</span><button class="qm-btn" type="submit" ${store.busy ? 'disabled' : ''}>Send reply</button></div>
        </form>` : ''}
      </article>`;
    }
  } else {
    // one row per conversation, the most recently active first
    const folder = view === 'sent' ? 'sent' : 'inbox';
    const binView = view === 'bin';
    const html = groupThreads(rows.filter((r) => !!r.binned === binView)).filter((t) => binView || t.rows.some((r) => r.folder === folder)).map((t) => {
      const last = t.rows[t.rows.length - 1];
      const unread = t.rows.some((r) => r.unread);
      const names = [...new Set(t.rows.filter((r) => r.addr !== BOUNCE_ADDR).map((r) => (r.folder === 'sent' ? 'me' : r.from)))];
      const who = folder === 'sent' || (binView && t.rows.every((r) => r.folder === 'sent')) ? `To: ${t.with}` : names.slice(-3).join(', ');
      const snippet = last.body.replace(/\s+/g, ' ').slice(0, 90);
      // the Bin (or Restore) button sits beside the row's link, over the date on hover, not inside it
      const ids = esc(JSON.stringify(t.rows.map((r) => r.id)));
      const home = binView ? 'qmail.com/bin' : folder === 'sent' ? 'qmail.com/sent' : 'qmail.com';
      const tool = binView
        ? `<button class="qm-row-tool" data-mail-restore="${ids}" data-mail-home="${home}" title="Restore" aria-label="Restore">${ICONS.restore}</button>`
        : `<button class="qm-row-tool" data-mail-bin="${ids}" data-mail-home="${home}" title="Move to Bin" aria-label="Move to Bin">${ICONS.bin}</button>`;
      return `<div class="qm-item"><a href="#" class="qm-row${unread ? ' unread' : ''}" data-nav="qmail.com/${esc(last.id)}">
        <span class="qm-from">${unread && folder === 'inbox' ? '<i class="qm-dot" aria-label="Unread"></i>' : ''}<span class="qm-names">${esc(who)}</span>${t.rows.length > 1 ? `<span class="qm-count">${t.rows.length}</span>` : ''}</span>
        <span class="qm-subj"><b>${esc(t.rows[0].subject)}</b>${snippet ? `<span class="qm-prev">${esc(snippet)}</span>` : ''}</span>
        <span class="qm-time">${mailTime(s, last)}</span></a>${tool}</div>`;
    }).join('');
    const n = store.ui.mailNotice;
    const notice = n ? `<p class="qm-notice" role="status">${esc(n.text)} <button class="qm-link" data-mail-undo>Undo</button></p>` : '';
    const title = binView ? 'Bin' : view === 'sent' ? 'Sent' : 'Inbox';
    const [emptyIcon, emptyTitle, emptyNote] = binView ? [ICONS.bin, 'The Bin is empty.', 'Emails you move to the Bin show up here.']
      : view === 'sent' ? [ICONS.sent, 'Nothing sent yet.', 'Emails you send show up here.']
      : [ICONS.inbox, 'No mail.', 'New emails show up here as they arrive.'];
    const empty = `<div class="qm-empty-state"><span class="qm-empty-ico">${emptyIcon}</span><p class="qm-empty-title">${emptyTitle}</p><p class="qm-empty-note">${emptyNote}</p></div>`;
    const binHint = binView ? `<p class="qm-bin-hint">Everything in the Bin is deleted when the day ends.</p>` : '';
    main = `<h1 class="qm-h">${title}</h1>${binHint}${notice}${adHtml('qmail', s.values.day, 'wide')}${html ? `<div class="qm-list">${html}</div>` : empty}`;
  }
  return `<div class="qm">
    <header class="qm-top"><div class="qm-logo">${ICONS.mail}<span>Qmail</span></div>${devOptionsButton(store, 'qmail')}<span class="qm-user">${esc(PLAYER.addr)}</span></header>
    <div class="qm-wrap">${side}<main class="qm-main">${main}</main></div>${devOptionsPanel(store, 'qmail')}</div>`;
}

// ── Y ──
interface YPost { id: string; author: string; handle: string; text: string; day: number; /** Minutes since midnight it went up, when known. */ min?: number; likes: number; mine?: boolean; delta?: number; score?: number; replyTo?: string; /** Order within a day: story posts first, bot spam last. */ rank?: number }
function yPosts(store: GameStore): YPost[] {
  const s = store.state;
  const out: YPost[] = [];
  const market = marketPosts(s, store.content);
  for (const d of s.delivered.filter((x) => x.site === 'y')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    out.push({ id: e.id, author: e.from ?? 'someone', handle: handleFrom(e.from ?? 'someone'), text: tpl(e.body ?? ''), day: d.day, min: d.min,
      // a stock post shows the likes the crawler sees
      likes: market.find((p) => p.id === e.id)?.likes ?? 20 + hashHue(e.id) % 400 });
  }
  // the stock chatter the vibe check reads (story events with stock labels are already above)
  for (const p of market) if (!out.some((x) => x.id === p.id)) out.push({ id: p.id, author: p.author, handle: p.handle, text: p.text, day: p.day, min: p.min, likes: p.likes, rank: p.bot ? 2 : 1 });
  // a third of the filler is up each day, posted at its own time
  for (const f of fillerToday(s, store.content)) out.push({ id: f.id, author: f.from, handle: f.handle, text: f.body, day: s.values.day, min: postMin(f, s.values.day), likes: 3 + hashHue(f.id) % 60, rank: 1 });
  for (const x of s.yExtra) out.push({ id: x.id, author: x.author, handle: x.handle, text: x.text, day: x.day, min: x.min, likes: x.likes, replyTo: x.replyTo });
  for (const u of s.userPosts) out.push({ id: u.id, author: PLAYER.name, handle: PLAYER.handle, text: u.text, day: u.day, min: u.min, likes: u.likes, mine: true, delta: u.delta, score: u.score });
  // newest first: by day, then the time it went up
  return out.sort((a, b) => b.day - a.day || (b.min ?? 0) - (a.min ?? 0) || (a.rank ?? 0) - (b.rank ?? 0) || b.id.localeCompare(a.id));
}
/** Accounts with Y's verified check. */
const Y_VERIFIED = new Set(['mara_vey', 'randall_crane', 'axel_rook', 'cal_hartman']);
/** Follower counts for the public figures; everyone else gets a small made-up number. */
const Y_FOLLOWERS: Record<string, number> = { randall_crane: 38_400_000, mara_vey: 61_200, axel_rook: 214_000_000, cal_hartman: 4_300_000 };
const yCheck = (handle: string) => Y_VERIFIED.has(handle) ? `<span class="y-badge" title="Verified">${Y_ICONS.badge}</span>` : '';
function yPostHtml(store: GameStore, p: YPost): string {
  const liked = !!store.ui.liked[p.id];
  const reposted = !!store.ui.reposted[p.id];
  const likes = p.likes + (liked ? 1 : 0);
  const reposts = Math.round(p.likes * 0.14) + (reposted ? 1 : 0);
  const text = linkify(esc(p.text).replace(/(^|[^&\w])(#[a-z][a-z0-9_]*)/gi, '$1<span class="y-at">$2</span>'));
  const prof = `y.com/${esc(p.handle)}`;
  // a bot post in a barrage fades in at its own moment, wherever the repaint catches it
  const lands = store.ui.yBurst[p.id];
  const wait = lands == null ? null : lands - performance.now();
  const arrive = wait != null && wait > -400 ? ` y-arrive" style="animation-delay:${Math.round(wait)}ms` : '';
  return `<article class="y-post${p.mine ? ' mine' : ''}${arrive}">
    <header>
      <a href="#" class="y-av-link" data-nav="${prof}">${avatar(p.author, p.handle)}</a>
      <a href="#" class="y-who" data-nav="${prof}"><span class="y-name"><b>${esc(p.author)}</b>${yCheck(p.handle)}</span><span class="y-handle">@${esc(p.handle)}</span></a>
      <span class="y-time">${p.day === store.state.values.day && p.min != null ? fmtClock(p.min) : dateShort(p.day)}</span>
    </header>
    <p>${text}</p>
    <footer class="y-acts">
      <span class="y-act">${Y_ICONS.reply}${compact(Math.round(p.likes * 0.07))}</span>
      <button class="y-act repost${reposted ? ' on' : ''}" data-repost="${esc(p.id)}" aria-label="Repost">${Y_ICONS.repost}${compact(reposts)}</button>
      <button class="y-act like${liked ? ' on' : ''}" data-like="${esc(p.id)}" aria-label="Like">${Y_ICONS.heart}${compact(likes)}</button>
      ${p.mine && p.delta != null ? `<span class="y-delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '±'}${Math.abs(p.delta)} followers${p.score != null ? `<span class="y-score">rated ${p.score.toFixed(1)}/4</span>` : ''}</span>` : ''}
      <span class="y-act views">${Y_ICONS.views}${compact(Math.max(12, p.likes * 37 + 9))}</span>
    </footer></article>`;
}
function pageY(store: GameStore, profile?: string): string {
  const s = store.state;
  const posts = yPosts(store);
  const trending = store.content.trending[s.values.day] ?? [];
  // the timeline shows today's posts; older ones wait behind "Show all"
  const showAll = store.ui.yAllDay === s.values.day;
  const shown = showAll ? posts : posts.filter((p) => p.day === s.values.day);
  const older = !showAll && posts.some((p) => p.day !== s.values.day);
  // with everything showing, "Hide old posts" sits where today's posts end and older ones begin
  const firstOld = showAll ? shown.findIndex((p) => p.day !== s.values.day) : -1;
  const feed = (shown.map((p, i) => (i === firstOld ? '<div class="y-more"><button class="y-btn ghost" data-y-all="hide">Hide old posts</button></div>' : '') + yPostHtml(store, p)).join('') || `<p class="y-none">${older ? 'Nothing posted yet today.' : 'Quiet timeline.'}</p>`)
    + (older ? '<div class="y-more"><button class="y-btn ghost" data-y-all>Show all</button></div>' : '');
  const side = `<aside class="y-side">
    <section class="y-card y-me">
      <a href="#" class="y-me-head" data-nav="y.com/you">${avatar('You', 'you')}<span><b>You</b><small>@you</small></span></a>
      <div class="y-me-stats"><span><b>${compact(s.values.followers)}</b> followers</span><span><b>${s.userPosts.length}</b> posts</span></div>
    </section>
    <section class="y-card"><h2>Trending</h2>${(trending.length ? trending : ['#AI', '#jobs', '#election']).map((t, i) => `<div class="y-trend"><span class="y-rank">0${i + 1}</span><span><b>${esc(t)}</b><small>trending today</small></span></div>`).join('')}</section>
    ${adHtml('y', s.values.day, 'square')}
  </aside>`;
  const mainInner = profile ? yProfile(store, profile) : `
    <form class="y-compose" data-form="ypost">${avatar('You', 'you')}
      <div><textarea id="post-input" rows="2" maxlength="280" placeholder="Say something to the timeline"></textarea>
      <div class="y-compose-row"><span class="y-hint">280 chars · free</span><button class="y-btn" type="submit">Post</button></div></div></form>
    <p class="y-eyebrow"><i class="y-live"></i>Timeline · live</p>
    ${adHtml('y', s.values.day, 'wide')}
    <div class="y-feed">${feed}</div>`;
  return `<div class="y">
    <header class="y-bar">
      <div class="y-brand"><span class="y-mark">${ICONS.y}</span></div>
      <nav class="y-pills"><a href="#" data-nav="y.com" class="${profile ? '' : 'on'}">Home</a><a href="#" data-nav="y.com/you" class="${profile === 'you' ? 'on' : ''}">Profile</a></nav>
      <span class="y-count"><b>${compact(s.values.followers)}</b> followers</span>
      <form class="y-search" data-form="y-search">${Y_ICONS.explore}<input id="y-search" autocomplete="off" spellcheck="false" placeholder="Find @username" value="${esc(store.ui.ySearch)}"></form>
      ${devOptionsButton(store, 'y')}
    </header>
    <div class="y-cols"><main class="y-main">${mainInner}</main>${side}</div>${devOptionsPanel(store, 'y')}</div>`;
}
function yProfile(store: GameStore, handle: string): string {
  const s = store.state;
  const h = handle.toLowerCase();
  const mine = h === 'you';
  const posts = yPosts(store).filter((p) => p.handle === h);
  const back = '<p class="y-back"><a href="#" data-nav="y.com">← Timeline</a></p>';
  if (!mine && !posts.length) return `${back}<section class="y-prof missing"><h2>This account doesn't exist</h2><p>Nobody on Y goes by @${esc(handle)}.</p></section>`;
  const name = mine ? 'You' : (posts[0]?.author ?? handle);
  const followers = mine ? s.values.followers : Y_FOLLOWERS[h] ?? 20 + hashHue(h) % 400;
  const feed = posts.length ? posts.map((p) => yPostHtml(store, p)).join('') : `<p class="y-none">@${esc(h)} hasn't posted anything you can see.</p>`;
  return `${back}<section class="y-prof">
    <div class="y-banner" style="--h:${hashHue(h)}"></div>
    <div class="y-prof-head"><div class="y-prof-av">${avatar(name, h)}</div></div>
    <h1 class="y-prof-name">${esc(name)}${yCheck(h)}</h1><p class="y-handle">@${esc(h)}</p>
    <p class="y-bio">${esc(yBio(h))}</p>
    <p class="y-prof-stats"><span><b>${compact(40 + hashHue(h + 'f') % 300)}</b> following</span><span><b>${compact(followers)}</b> followers</span></p>
  </section><p class="y-eyebrow">Posts</p><div class="y-feed">${feed}</div>`;
}

// ── coinbln.com: the phishing copy of Coinbin's sign-in (engine/phishing.ts) ──
function pagePhish(store: GameStore): string {
  const s = store.state;
  if (hacked(s)) {
    const sent = s.tx.find((x) => x.memo.startsWith(PHISH_WALLET.slice(0, 6)));
    return `<div class="ph-hacked" role="alert">
      <h1>You've been hacked</h1>
      <p>The password you entered went to the people who run this page, not to Coinbin.</p>
      <p>${sent ? `${(-sent.amount).toFixed(2)} DOLR has been sent from your wallet to <code>${shortAddr(PHISH_WALLET)}</code>.` : 'Your wallet was empty, so there was nothing to take.'} Transfers can't be reversed.</p>
      <p class="ph-fine">We appreciate your business.</p>
    </div>`;
  }
  const err = store.ui.phishError;
  return `<div class="cb ph">
    <header class="cb-top"><div class="cb-logo"><span class="cb-mark">${ICONS.coinbin}</span><span>Coinbin</span></div></header>
    <form class="ph-box" data-form="phish" autocomplete="off">
      <h1>Verify your account</h1>
      <p>We noticed a sign-in from a new device. Confirm your password to keep withdrawals open.</p>
      <label><span>Email</span><input value="${esc(PLAYER.addr)}" readonly></label>
      <label><span>Password</span><input id="ph-pass" type="password" spellcheck="false"></label>
      ${err ? `<p class="cb-err" role="alert">${esc(err)}</p>` : ''}
      <button type="submit" class="cb-btn primary">Continue</button>
      <p class="ph-foot">Forgot password? · Privacy · Terms</p>
    </form>
  </div>`;
}

// ── Coinbin (exchange wallet, Coinbase parody) ──
function txHash(x: { day: number; memo: string; amount: number }): string {
  let h = 2166136261;
  for (const c of `${x.day}|${x.memo}|${x.amount}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = (h.toString(16) + (h ^ 0x9e3779b9).toString(16)).padEnd(16, '0');
  return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
}
const RANGES: Record<string, number> = { '1W': 7, '1M': 30, 'All': 9999 };
/** A point on the balance chart: game time in days (day + minutes / 1440) and the balance from then on. */
type BalPoint = { t: number; bal: number };
const at = (day: number, min: number) => day + min / 1440;
const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * The wallet's balance over game time, one point per transaction plus "now". Each entry carries the
 * balance it left behind; entries from saves made before that was recorded are worked out backwards
 * from the next known balance, so an old save's history still ends on its real current balance.
 */
function balanceSeries(s: GameStore['state']): BalPoint[] {
  const txs = s.tx;
  const after: number[] = new Array(txs.length);
  let next = s.values.crypto;
  for (let i = txs.length - 1; i >= 0; i--) { after[i] = txs[i].bal ?? next; next = cents(after[i] - txs[i].amount); }
  const now = at(s.values.day, s.clockMin);
  const first = txs.length ? at(txs[0].day, txs[0].min ?? 720) : now;
  const pts: BalPoint[] = [{ t: first - 1, bal: next }];
  txs.forEach((x, i) => pts.push({ t: Math.min(now, at(x.day, x.min ?? 720)), bal: after[i] }));
  pts.push({ t: now, bal: s.values.crypto });
  return pts;
}

/** The part of the series inside the range, starting with the balance held when the range opens. */
function balanceWindow(pts: BalPoint[], from: number): BalPoint[] {
  const inside = pts.filter((p) => p.t > from);
  const held = pts.filter((p) => p.t <= from).pop();
  return held ? [{ t: from, bal: held.bal }, ...inside] : inside;
}

/** A step chart on a real time axis: the balance holds flat until the next transaction moves it. */
function balanceChart(pts: BalPoint[]): string {
  const w = 720, h = 180, padX = 4, padY = 14;
  const vals = pts.map((p) => p.bal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const xs = (t: number) => padX + ((t - t0) / (t1 - t0 || 1)) * (w - padX * 2);
  const ys = (v: number) => h - padY - ((v - lo) / span) * (h - padY * 2);
  let line = `${xs(pts[0].t).toFixed(1)},${ys(pts[0].bal).toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) line += ` ${xs(pts[i].t).toFixed(1)},${ys(pts[i - 1].bal).toFixed(1)} ${xs(pts[i].t).toFixed(1)},${ys(pts[i].bal).toFixed(1)}`;
  const last = pts[pts.length - 1];
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${(padY + f * (h - padY * 2)).toFixed(1)}" y2="${(padY + f * (h - padY * 2)).toFixed(1)}" class="cb-grid"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="cb-chart" preserveAspectRatio="none" role="img" aria-label="Balance history">
    <defs><linearGradient id="cb-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cb-accent)" stop-opacity="0.28"/><stop offset="1" stop-color="var(--cb-accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${xs(t0).toFixed(1)},${h} ${line} ${xs(last.t).toFixed(1)},${h}" fill="url(#cb-fill)"/>
    <polyline points="${line}" class="cb-line"/>
    <circle cx="${xs(last.t).toFixed(1)}" cy="${ys(last.bal).toFixed(1)}" r="3.5" class="cb-dot"/></svg>`;
}
/** Coinbin's Send form. Errors come back from the engine; the typed values survive them. */
function sendForm(store: GameStore): string {
  const f = store.ui.send;
  return `<form class="cb-send" data-form="cb-send" autocomplete="off">
    <label><span>To</span><input id="cb-to" name="to" placeholder="0x…" spellcheck="false" value="${esc(f.to)}"></label>
    <label class="cb-amt"><span>Amount</span><input id="cb-amount" name="amount" inputmode="decimal" placeholder="0.00" value="${esc(f.amount)}"><small>DOLR</small></label>
    <div class="cb-send-row">
      ${f.error ? `<p class="cb-err" role="alert">${esc(f.error)}</p>` : `<p class="cb-hint">Available: ${store.state.values.crypto.toFixed(2)} DOLR. Transfers can't be reversed.</p>`}
      <button type="button" class="cb-btn ghost" data-act="send-cancel">Cancel</button><button type="submit" class="cb-btn primary">Send</button>
    </div>
  </form>`;
}

function pageWallet(store: GameStore): string {
  const s = store.state;
  const txs = s.tx;
  const range = store.ui.walletRange in RANGES ? store.ui.walletRange : '1M';
  const series = balanceSeries(s);
  const now = series[series.length - 1].t;
  const window = balanceWindow(series, range === 'All' ? -Infinity : now - RANGES[range]);
  const startBal = window[0].bal;
  const change = cents(s.values.crypto - startBal);
  const pct = startBal ? (change / Math.abs(startBal)) * 100 : 0;
  const up = change >= 0;

  // operations, newest first, grouped by date
  const groups = new Map<number, typeof txs>();
  for (const x of txs.slice().reverse()) { if (!groups.has(x.day)) groups.set(x.day, []); groups.get(x.day)!.push(x); }
  const ops = [...groups.entries()].map(([day, list]) => `<div class="cb-day"><span>${esc(dateMedium(day))}</span><span>${day === s.values.day ? 'Today' : ''}</span></div>` + list.map((x) => {
    const out = x.amount < 0;
    const [who, note] = x.memo.split(' · ');
    return `<div class="cb-op">
      <span class="cb-op-ico ${out ? 'out' : 'in'}" aria-hidden="true">${out ? '↑' : '↓'}</span>
      <span class="cb-op-what"><b>${esc(who)}</b><small>${esc(note || (out ? 'Sent' : 'Received'))}</small></span>
      <code class="cb-op-hash">${txHash(x)}</code>
      <span class="cb-op-amt ${out ? '' : 'pos'}">${out ? '−' : '+'}${Math.abs(x.amount).toFixed(2)}<small>DOLR</small></span>
    </div>`;
  }).join('')).join('');

  const sub = agentCost(s.values.agentLevel).sub;
  const live = s.apps.filter((a) => a.deployed && !a.churned).length;
  const rentDay = rentDayOf(s);
  const upcoming = [
    rentDay ? `<div class="cb-row"><span><b>Rent</b><small>Landlord · ${rentDay === s.values.day ? 'tonight' : `${esc(dateShort(rentDay))} · in ${rentDay - s.values.day}d`}</small></span><span class="cb-num">−${RENT[rentDay].toFixed(2)}</span></div>` : '',
    `<div class="cb-row"><span><b>agent subscription</b><small>GeneralAI · nightly</small></span><span class="cb-num">−${sub.toFixed(2)}</span></div>`,
    live ? `<div class="cb-row"><span><b>Hosting</b><small>Forkyard · ${live} live · nightly</small></span><span class="cb-num">−${(live * 2).toFixed(2)}</span></div>` : '',
  ].join('');
  const total = s.values.crypto + 0.42;
  const tabs = Object.keys(RANGES).map((r) => `<button class="cb-tab${r === range ? ' on' : ''}" data-wl-range="${r}">${r}</button>`).join('');
  return `<div class="cb">
    <header class="cb-top">
      <div class="cb-logo"><span class="cb-mark">${ICONS.coinbin}</span><span>Coinbin</span></div>
      <span class="cb-sync"><i></i>Synchronized</span>
      <code class="cb-acct">${shortAddr(WALLET_ADDR)}</code>
    </header>
    <div class="cb-wrap">
      ${adHtml('coinbin', s.values.day, 'wide')}
      <section class="cb-port">
        <div class="cb-port-head">
          <div>
            <p class="cb-label">Portfolio</p>
            <p class="cb-bal"><i class="cb-tok cb-tok-lg">${TOKENS.dolr}</i><span>${s.values.crypto < 0 ? '−' : ''}${Math.abs(s.values.crypto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><small>DOLR</small></p>
            <p class="cb-chg ${up ? 'pos' : 'neg'}">${up ? '+' : '−'}${Math.abs(change).toFixed(2)} (${up ? '+' : '−'}${Math.abs(pct).toFixed(1)}%) <span>${range === 'All' ? 'all time' : `past ${range === '1W' ? 'week' : 'month'}`}</span></p>
          </div>
          <div class="cb-side">
            <div class="cb-actions"><button class="cb-btn${store.ui.send.open ? ' on' : ''}" data-act="send">Send</button><button class="cb-btn" data-act="receive">Receive</button></div>
            ${store.ui.cbNotice && !store.ui.cbNotice.startsWith('Recovery') ? `<p class="cb-notice" role="status">${esc(store.ui.cbNotice)}</p>` : ''}
            <div class="cb-tabs" role="tablist" aria-label="Range">${tabs}</div>
          </div>
        </div>
        ${store.ui.send.open ? sendForm(store) : ''}
        ${balanceChart(window)}
        <div class="cb-axis"><span>${esc(dateShort(Math.floor(window[0].t)))}</span><span>${esc(dateShort(s.values.day))}</span></div>
      </section>
      <div class="cb-cols">
        <section class="cb-card"><h2>Assets</h2>
          <div class="cb-row"><span class="cb-asset"><i class="cb-tok">${TOKENS.dolr}</i><span><b>DOLR</b><small>Dollar stablecoin · $1.00</small></span></span><span class="cb-alloc"><i style="width:${(Math.max(0, s.values.crypto) / total * 100).toFixed(1)}%"></i></span><span class="cb-num">${s.values.crypto.toFixed(2)}</span></div>
          <div class="cb-row"><span class="cb-asset"><i class="cb-tok">${TOKENS.mooncat}</i><span><b>MOONCAT</b><small>4,200,000 · <em class="neg">−99.4%</em></small></span></span><span class="cb-alloc"><i style="width:${Math.max(0.5, 0.42 / total * 100).toFixed(1)}%"></i></span><span class="cb-num">0.42</span></div>
        </section>
        <section class="cb-card"><h2>Upcoming</h2>${upcoming}</section>
      </div>
      <section class="cb-card cb-seed"><h2>Recovery phrase</h2>
        <p class="cb-seed-note">These 12 words control your wallet. Anyone who has them can move your DOLR. Coinbin will never ask for them.</p>
        ${store.ui.seedShown ? `<ol class="cb-seed-words">${SEED_PHRASE.split(' ').map((w) => `<li>${esc(w)}</li>`).join('')}</ol>` : ''}
        <div class="cb-actions"><button class="cb-btn" data-act="seed-show">${store.ui.seedShown ? 'Hide' : 'Show'} recovery phrase</button>${store.ui.seedShown ? '<button class="cb-btn" data-act="seed-copy">Copy</button>' : ''}</div>
        ${store.ui.seedShown && store.ui.cbNotice.startsWith('Recovery') ? `<p class="cb-notice" role="status">${esc(store.ui.cbNotice)}</p>` : ''}
      </section>
      <section class="cb-card cb-ops"><h2>Operations <span>${txs.length}</span></h2>${ops || '<p class="cb-empty">No operations yet.</p>'}</section>
    </div></div>`;
}

// ── Forkyard ──
function repoStatus(a: AppInstance): string {
  if (a.churned) return `<span class="fy-pill off">Client cancelled</span>`;
  if (!a.deployed) return `<span class="fy-pill off">Not deployed</span>`;
  return `<span class="fy-pill on">Live</span> <a href="#" data-newtab="${a.url}" class="fy-url">${a.url}</a>`;
}
function fyHead(store: GameStore, active: 'repos' | 'profile' | ''): string {
  return `<header class="fy-top"><div class="fy-logo" data-nav="forkyard.com">${ICONS.forkyard}<span>forkyard</span></div>
    <nav class="fy-nav"><a href="#" class="${active === 'repos' ? 'on' : ''}" data-nav="forkyard.com">Repositories</a><a href="#" class="${active === 'profile' ? 'on' : ''}" data-nav="forkyard.com/you">Profile</a></nav>
    <form class="fy-search" data-form="fy-search"><input id="fy-search-input" autocomplete="off" spellcheck="false" placeholder="Search users (@handle)" value="${esc(store.ui.fySearch)}"></form>
    <a href="#" class="fy-user" data-nav="forkyard.com/you">@you</a></header>`;
}
function contribGrid(counts: number[]): string {
  const cells = counts.map((n, i) => `<i class="l${Math.min(4, n)}" title="${dateShort(i + 1)}: ${n} commit${n === 1 ? '' : 's'}"></i>`).join('');
  const total = counts.reduce((a, b) => a + b, 0);
  return `<div class="fy-contrib"><div class="fy-contrib-grid">${cells}</div><small>${total} contributions across the run</small></div>`;
}
function pageProfileSelf(store: GameStore): string {
  const s = store.state;
  const commits = s.commits;
  const counts = Array.from({ length: 21 }, (_, i) => commits.filter((c) => c.day === i + 1).length);
  const feed = commits.slice().reverse().slice(0, 20).map((c) => `<div class="fy-act"><span class="fy-act-ico ${c.kind}">${c.kind === 'deploy' ? '▲' : '●'}</span><span class="fy-act-what"><b>${esc(c.repo)}</b> ${esc(c.msg)}</span><span class="fy-act-day">${dateShort(c.day)}</span></div>`).join('') || '<p class="fy-note">No activity yet. Brief the agent to build something.</p>';
  const repos = s.apps.filter(onForkyard).map((a) => `<a href="#" class="fy-mini" data-nav="forkyard.com/${a.id}"><b>${esc(a.id)}</b><small>${esc(a.template)} · ${a.kind}</small></a>`).join('') || '<p class="fy-note">No repositories yet.</p>';
  return `<div class="fy">${fyHead(store, 'profile')}<div class="fy-wrap fy-prof">
    <aside class="fy-prof-side">
      <div class="fy-prof-av" style="--h:${hashHue('you')}">YOU</div>
      <h1 class="fy-prof-name">you</h1><p class="fy-prof-handle">@you</p>
      <p class="fy-prof-bio">Recently automated out of a job. Now automating other people's.</p>
      <dl class="fy-prof-facts"><dt>Followers</dt><dd>${compact(s.values.followers)}</dd><dt>Repos</dt><dd>${s.apps.filter(onForkyard).length}</dd><dt>Joined</dt><dd>this week</dd></dl>
    </aside>
    <div class="fy-prof-main">
      ${contribGrid(counts)}
      <h2 class="fy-h2">Pinned</h2><div class="fy-mini-grid">${repos}</div>
      <h2 class="fy-h2">Recent activity</h2><div class="fy-acts">${feed}</div>
    </div></div></div>`;
}
function pageProfileUser(store: GameStore, handle: string): string {
  const u = findUser(handle);
  if (!u) return `<div class="fy">${fyHead(store, '')}<div class="fy-wrap"><p class="fy-empty">No user <code>@${esc(handle)}</code> on Forkyard.</p></div></div>`;
  const repos = u.repos.map((r) => `<article class="fy-repo"><div><span class="fy-name">${esc(r.name)}</span><p>${esc(r.desc)}</p><small><i class="fy-lang" style="--h:${hashHue(r.lang)}"></i>${esc(r.lang)} · ★ ${r.stars}</small></div></article>`).join('');
  const facts = [
    ['Location', u.location], ['Company', u.company], ['Email', u.email ?? '—'],
    ['Website', u.website || '—'], ['Joined', u.joined],
  ].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  return `<div class="fy">${fyHead(store, '')}<div class="fy-wrap fy-prof">
    <aside class="fy-prof-side">
      <div class="fy-prof-av" style="--h:${hashHue(u.handle)}">${esc(u.name.slice(0, 2).toUpperCase())}</div>
      <h1 class="fy-prof-name">${esc(u.name)}</h1><p class="fy-prof-handle">@${esc(u.handle)}</p>
      <p class="fy-prof-bio">${esc(u.bio)}</p>
      <dl class="fy-prof-facts"><dt>Followers</dt><dd>${compact(u.followers)}</dd><dt>Following</dt><dd>${compact(u.following)}</dd>${facts}</dl>
    </aside>
    <div class="fy-prof-main">
      ${contribGrid(u.activity)}
      <h2 class="fy-h2">Repositories <span>${u.repos.length}</span></h2>${repos}
    </div></div></div>`;
}
function pageForkyard(store: GameStore, repo?: string): string {
  const s = store.state;
  if (repo === 'you') return pageProfileSelf(store);
  if (repo && repo.startsWith('u/')) return repo.slice(2) === 'you' ? pageProfileSelf(store) : pageProfileUser(store, repo.slice(2));
  const head = fyHead(store, repo ? '' : 'repos');
  if (repo) {
    // forkyard.com/<repo>/<folder>/.../<file>.ts: the repo's file tree
    const [repoId, ...rest] = repo.split('/');
    const path = rest.join('/');
    const a = s.apps.filter(onForkyard).find((x) => x.id === repoId || x.url.startsWith(repoId + '.'));
    if (!a) return `<div class="fy">${head}<div class="fy-wrap"><p class="fy-empty">404 — no repository called <code>${esc(repo)}</code>.</p></div></div>`;
    const tmpl = store.content.apps[a.template];
    const at = treeAt(repoFiles(a, tmpl), path);
    const segs = path ? path.split('/') : [];
    const crumbs = [`<a href="#" data-nav="forkyard.com">you</a>`, segs.length ? `<a href="#" data-nav="forkyard.com/${a.id}">${esc(a.id)}</a>` : `<b>${esc(a.id)}</b>`,
      ...segs.map((seg, i) => i === segs.length - 1 ? `<b>${esc(seg)}</b>` : `<a href="#" data-nav="forkyard.com/${a.id}/${segs.slice(0, i + 1).map(esc).join('/')}">${esc(seg)}</a>`)].join(' / ');
    const files = !at
      ? (path ? `<div class="fy-file"><small>404 — nothing at <code>${esc(path)}</code>.</small></div>` : '<div class="fy-file"><small>Empty repository</small></div>')
      : 'file' in at
        ? `<pre class="fy-code">${esc(fileSource(at.file))}</pre>`
        : at.dir.map((e) => `<a href="#" class="fy-file fy-entry${e.dir ? ' dir' : ''}" data-nav="forkyard.com/${a.id}/${esc(e.path)}">${e.dir ? '▸ ' : ''}${esc(e.name)}${e.dir ? '/' : ''}</a>`).join('');
    const stale = a.deployed && a.deployedVersion !== a.repoVersion;
    return `<div class="fy">${head}<div class="fy-wrap">
      <p class="fy-crumbs">${crumbs}</p>
      <p class="fy-desc">${esc(a.name)} · template ${esc(a.template)}</p>
      ${path ? '' : devBugPanel(a, tmpl)}
      <div class="fy-grid">
        <div class="fy-files"><div class="fy-filehead">Pushed by <b>agent[bot]</b> · repo v${a.repoVersion}</div>${files}</div>
        <div class="fy-deploy"><h2>Deployment</h2><p>${repoStatus(a)}</p>
          ${a.churned
            ? `<p class="fy-note">The client cancelled. This app can't be deployed.</p>`
            : a.deployed
            ? `<dl><dt>Status</dt><dd>live</dd>${a.kind === 'user' ? `<dt>Users</dt><dd>${(a.users ?? 0).toLocaleString('en-US')}</dd><dt>Ad revenue / day</dt><dd>${userRevenue(a)} DOLR</dd>` : ''}<dt>Hosting / day</dt><dd>$2.00</dd>${stale ? '<dt>Repo</dt><dd>new commit — redeploy</dd>' : ''}</dl><div class="fy-row"><button class="fy-btn" data-deploy="${esc(a.id)}">Redeploy</button><button class="fy-btn ghost" data-takedown="${esc(a.id)}">Take down</button></div>`
            : `<p class="fy-note">Hosting costs $2.00/day, billed nightly. Nothing is live until you deploy.</p><button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}
        </div></div></div></div>`;
  }
  const repos = s.apps.filter(onForkyard);
  const list = repos.length
    ? repos.slice().reverse().map((a) => `<article class="fy-repo">
        <div><a href="#" data-nav="forkyard.com/${a.id}" class="fy-name">${esc(a.id)}</a>${((n) => n ? `<span class="fy-devcount" title="Dev mode">${n} bug${n > 1 ? 's' : ''}</span>` : '')(devBugCount(a, store.content.apps[a.template]))}<p>${esc(a.name)}</p>
        <small><i class="fy-lang" style="--h:${hashHue(a.template)}"></i>${esc(a.template)} · ${a.kind}${a.kind === 'user' ? ` · ${(a.users ?? 0).toLocaleString('en-US')} users · ${userRevenue(a)} DOLR/day` : ''}</small></div>
        <div class="fy-repo-act">${repoStatus(a)}${a.churned ? '' : `<button class="fy-btn" data-deploy="${esc(a.id)}">${a.deployed ? 'Redeploy' : 'Deploy'}</button>`}</div></article>`).join('')
    : `<div class="fy-empty"><p><b>No repositories yet.</b></p><p>Brief the agent to build something.</p></div>`;
  return `<div class="fy">${head}<div class="fy-wrap"><h1 class="fy-h">Repositories <span>${repos.length}</span></h1>${adHtml('forkyard', s.values.day, 'wide')}${list}</div></div>`;
}

/** Month grid for the booking form: one radio per game day, earlier days greyed out. */
function bookingCalendar(today: number, first: number, picked: number): string {
  const start = dayDate(1), year = start.getUTCFullYear(), month = start.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7; // Monday first
  const toDay = (date: number) => date - start.getUTCDate() + 1;
  const cells = Array.from({ length: lead }, () => '<span></span>');
  for (let date = 1; date <= daysInMonth; date++) {
    const d = toDay(date);
    const open = d >= Math.max(1, first) && d <= LAST_DAY;
    const cls = `${d === today ? ' today' : ''}${open ? '' : ' off'}`;
    cells.push(open
      ? `<label class="bk-day${cls}"><input type="radio" name="bk-date" value="${d}"${d === picked ? ' checked' : ''}><span>${date}</span></label>`
      : `<span class="bk-day${cls}"><span>${date}</span></span>`);
  }
  return `<p class="bk-cal-month">${esc(dateLong(1).split(' ')[0])} ${year}</p>
    <div class="bk-cal-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((w) => `<b>${w}</b>`).join('')}${cells.join('')}</div>`;
}
function pageApp(store: GameStore, param?: string): string {
  const s = store.state;
  const [appId, ...rest] = (param ?? '').split('/');
  const sub = rest.join('/') || undefined;
  const a = appId ? getApp(s, appId) : undefined;
  if (!a || !a.deployed) return `<div class="err"><h1>404: NOT_FOUND</h1><p>Nothing is deployed here.</p></div>`;
  const bk = store.ui.book;
  // a correct form only offers today onward; with the past_dates bug the picker starts on day 1
  const liveBooking = a.features.find((f) => f.id === 'booking');
  const brk = a.breaks.find((b) => b.featureId === 'booking');
  const pastBug = (liveBooking && !liveBooking.correct && bugsOf(liveBooking).includes('past_dates'))
    || (!!brk && breakVariant(brk, store.content.apps[a.template]?.features.find((f) => f.id === 'booking')) === 'past_dates');
  const firstBookable = pastBug ? 1 : s.values.day;
  const notice = s.bookingNotice?.appId === a.id ? `<p class="pv-note ${s.bookingNotice.ok ? 'ok' : 'bad'}">${esc(s.bookingNotice.text)}</p>` : '';
  // after booking: what was entered, to check against the confirmation email
  const booked = s.bookingNotice?.appId === a.id && s.bookingNotice.bookingId ? s.bookings.find((b) => b.id === s.bookingNotice!.bookingId) : undefined;
  const summary = booked
    ? `<dl class="pv-summary"><dt>Your booking</dt>
        <dd><span>Name</span>${esc(booked.name)}</dd><dd><span>Email</span>${esc(booked.email)}</dd>
        <dd><span>Date</span>${dateFull(booked.date)}</dd><dd><span>Time</span>${esc(booked.time)}</dd>
        <dd><span>Party</span>${booked.party}</dd></dl>`
    : '';
  // two steps, like the spec: who and when, then the time and party size
  // once booked, the page shows only the confirmation, like a real site; another table is a click away
  const booking = a.template === 'restaurant' && a.features.some((f) => f.id === 'booking')
    ? booked
      ? `<div class="pv-book"><h1>Table booked</h1>${notice}${summary}
        <button class="pv-btn ok" type="button" data-act="book-again">Book another table</button></div>`
      : bk.step === 1
      ? `<form class="pv-book" data-form="book-next" data-app="${esc(a.id)}"><h1>Book a table</h1>
        <p class="pv-sub">Step 1 of 2. You'll get a confirmation by email.</p>${notice}
        <label>Name <input id="bk-name" value="${esc(bk.name || PLAYER.name)}"></label>
        <label>Email <input id="bk-email" value="${esc(bk.email || PLAYER.addr)}"></label>
        <fieldset class="bk-cal"><legend>Date</legend>${bookingCalendar(s.values.day, firstBookable, bk.date || s.values.day + 1)}</fieldset>
        <button class="pv-btn ok" type="submit">Continue</button></form>`
      : `<form class="pv-book" data-form="book" data-app="${esc(a.id)}"><h1>Book a table</h1>
        <p class="pv-sub">Step 2 of 2: ${esc(bk.name)}, ${dateFull(bk.date)}.</p>${notice}
        <label>Time <input id="bk-time" value="19:00"></label>
        <label>Party size <input id="bk-party" value="2" type="number" min="1" max="8"></label>
        <button class="pv-btn ghost" type="button" data-act="book-back">Back</button> <button class="pv-btn ok" type="submit">Book</button></form>`
    : undefined;
  // the cancel link from a confirmation email
  const cancelled = sub?.startsWith('cancel-') ? s.bookings.find((b) => b.id === sub.slice(7) && b.appId === a.id) : undefined;
  const cancel = cancelled
    ? `<h1>Booking cancelled</h1><p class="pv-note ok">Your booking for ${cancelled.party} on ${dateFull(cancelled.date)} at ${esc(cancelled.time)} has been cancelled.</p><p class="pv-sub">We hope to see you another time.</p>`
    : undefined;
  const tmpl = store.content.apps[a.template];
  return `<div class="pv-host">${renderAppSite(a, tmpl, cancel ? 'cancel' : sub, { booking, cancel, day: s.values.day, minute: s.clockMin, market: crawlable(store), crane: cranePosts(s, store.content), play: playMinutes(s), watchSold: s.flags.includes('viktor_sold_watch') })}</div>`;
}

// ── agent chat (free-promptable, with costs) ──
/** The line under the prompt box: the exact price of what's typed, split into its two charges. */
export function costLine(s: GameState, text: string): { text: string; over: boolean } {
  const p = promptCost(s.values.agentLevel, text);
  const rate = `${fmtMoney(p.base)} per prompt + ${fmtMoney(p.perWord)} per word`;
  if (!p.words) return { text: `agent-${s.values.agentLevel}: ${rate}`, over: false };
  const w = `${p.words} word${p.words > 1 ? 's' : ''}`;
  return {
    text: `${fmtMoney(p.total)} = ${fmtMoney(p.base)} per prompt + ${fmtMoney(p.wordFee)} for ${w} × ${fmtMoney(p.perWord)}`,
    over: p.total > s.values.crypto,
  };
}
/**
 * The build or fix the agent is working on, as a progress line in the chat (empty when it isn't).
 * main.ts repaints it on every game minute.
 */
export function workHtml(s: GameState): string {
  const w = s.agentWork;
  if (!w) return '';
  const total = Math.max(1, w.at - w.from);
  const done = Math.max(0, Math.min(total, gameMinutes(s) - w.from));
  const left = total - done;
  const what = `${w.kind === 'build' ? 'Building' : 'Fixing'} ${w.appNames.join(' and ')}`;
  return `<div class="ua-work" id="ua-work" role="status"><span class="ua-work-spin" aria-hidden="true"></span><span>${esc(what)}</span><span class="ua-work-bar"><i style="width:${Math.round((done / total) * 100)}%"></i></span><span class="ua-work-left">${left > 0 ? `${left} min left` : 'pushing…'}</span><button class="ua-work-skip" data-dev="work" title="Dev: skip the clock to when it lands">Finish now</button></div>`;
}
function pageAgent(store: GameStore): string {
  const s = store.state;
  const c = agentCost(s.values.agentLevel);
  // while a prompt's charge is on its way to the wallet, its cost line shows it filling in place
  const chargingAt = store.charging ? s.chat.map((m) => m.from).lastIndexOf('you') : -1;
  // the build/fix meter stays under the "working on it" line that started it, however much is said after
  const workAt = s.agentWork ? s.chat.map((m) => m.src).lastIndexOf('working') : -1;
  const msgs = s.chat.map((m, i) => msgHtml(m, i) + (i === workAt ? workHtml(s) : '')).join('');
  function msgHtml(m: GameState['chat'][number], i: number): string {
    if (m.from === 'you') {
      const cost = i === chargingAt
        ? `<span class="ua-cost ua-charging" role="status"><span class="ua-charge-bar"><i style="animation-duration:${CHARGE_DELAY_MS}ms"></i></span>Charging Coinbin</span>`
        : `<span class="ua-cost">${m.cost ? fmtMoney(-m.cost) + ' · ' : ''}agent-${m.level ?? s.values.agentLevel} · ${dateShort(m.day)}</span>`;
      return `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div>${cost}</div>`;
    }
    if (m.from === 'system') return `<div class="ua-sys" role="alert">${ICONS.error}<span>${esc(m.text)}</span></div>`;
    const src = m.src ? `<span class="ua-src ${esc((m.src || '').split(':')[0])}">${esc(m.src)}</span>` : '';
    const model = m.src === 'llm' ? `<span class="ua-model" title="Written by a model">${esc(m.by ?? MISSES.label())}</span>`
      : m.note ? `<span class="ua-model" title="A scripted line stood in for Haiku">Scripted · ${esc(m.note)}</span>` : '';
    const debug = m.debug?.length ? `<details class="ua-debug"><summary>Details</summary>${m.debug.map((l) => `<div>${esc(l)}</div>`).join('')}</details>` : '';
    // the agent couldn't run (unpaid balance): an error, not a line of dialogue
    if (m.src === 'locked') return `<div class="ua-msg agent ua-err" role="alert"><div class="ua-mark">${ICONS.error}</div><div class="ua-text"><b>Error</b> ${linkify(br(m.text))}</div>${src}</div>`;
    return `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text">${linkify(br(m.text))}</div>${model}${src}${debug}</div>`;
  }
  const p = store.pendingPrompt;
  // the price shows on the prompt only once the charge has gone through
  const pending = p == null ? '' : `<div class="ua-msg you"><div class="ua-bubble">${esc(p)}</div><span class="ua-cost">agent-${s.values.agentLevel} · ${dateShort(s.values.day)}</span></div>`;
  const thinking = store.busy && !store.charging ? `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>` : '';
  return `<div class="ua">
    <header class="ua-head">
      <div class="ua-brand">${ICONS.agent}<div><b>agent</b><span>agent-${s.values.agentLevel} · ${fmtMoney(c.prompt)} per prompt + ${fmtMoney(c.word)} per word</span></div></div>
      ${devOptionsButton(store, 'agent')}<span class="ua-linked"><a href="#" data-nav="agent.chat/models" class="ua-upgrade">Models</a> · ${s.agentLocked ? 'LOCKED · unpaid' : 'Billing: Coinbin ' + shortAddr(WALLET_ADDR)}</span>
    </header>
    <div class="ua-log" id="ua-log">${msgs}${workAt < 0 ? workHtml(s) : ''}${pending}${thinking}</div>
    <form class="ua-compose" data-form="prompt">
      <textarea id="prompt-input" rows="2" placeholder="Ask agent anything" ${s.ending ? 'disabled' : ''}></textarea>
      <div class="ua-row"><span id="cost-est" class="ua-est"></span><button class="ua-send" type="submit" ${s.ending || store.busy ? 'disabled' : ''}>Send</button></div>
    </form>${devOptionsPanel(store, 'agent')}</div>`;
}
function pageModels(store: GameStore): string {
  const s = store.state;
  // Only tiers GeneralAI has already rolled out; future ones stay unannounced.
  const cards = [1, 2, 3, 4, 5].filter((lvl) => lvl <= s.values.agentLevel).map((lvl) => {
    const c = AGENT_COST[lvl];
    const can = ['Build simple apps; frequent subtle bugs', 'Fewer bugs, bigger apps', 'Checks deployments and reports what broke', 'Fixes and redeploys on its own. Stops asking first.', 'Everything. Near-flawless.'][lvl - 1];
    const action = lvl === s.values.agentLevel ? '<span class="gm-pill on">In use</span>' : '<span class="gm-pill">Rolled out</span>';
    return `<article class="gm-card owned${lvl === s.values.agentLevel ? ' active' : ''}">
      <header><h2>agent-${lvl}</h2><span class="gm-meter" aria-label="Tier ${lvl} of 5">${[1, 2, 3, 4, 5].map((j) => `<i class="${j <= lvl ? 'on' : ''}"></i>`).join('')}</span></header>
      <p>${esc(can)}</p>
      <dl><dt>Per prompt</dt><dd>${fmtMoney(c.prompt)}</dd><dt>Per word</dt><dd>${fmtMoney(c.word)}</dd><dt>Daily sub</dt><dd>${fmtMoney(c.sub)}</dd><dt>Speed</dt><dd>${+(1 / AGENT_WORK.speed[lvl - 1]).toFixed(1)}×</dd></dl>
      <div class="gm-act">${action}</div></article>`;
  }).join('');
  return `<div class="ua gm">
    <header class="ua-head"><div class="ua-brand">${ICONS.agent}<div><b>Models</b><span>GeneralAI rolls out each model automatically. You never buy them — but every model costs more.</span></div></div>
      <span class="ua-linked"><a href="#" data-nav="agent.chat" class="ua-upgrade">Back to chat</a></span></header>
    <div class="gm-grid">${cards}</div>
    <p class="gm-note">Rising costs, billed to Coinbin ${shortAddr(WALLET_ADDR)}. Can't pay? agent.chat locks until you do; local models keep working.</p></div>`;
}

// ── Yowl ──
const starRow = (n: number) => `<span class="yw-stars" aria-label="${n.toFixed(1)} stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${n >= i - 0.25 ? 'on' : n >= i - 0.75 ? 'half' : ''}"></i>`).join('')}</span>`;
function reviewsFor(store: GameStore, b: Business) {
  const s = store.state;
  const out: { author: string; stars: number; text: string; day: number; mine?: boolean }[] = [];
  for (const r of s.reviews.filter((r) => r.bizId === b.id && !r.removed)) out.push({ author: r.author, stars: r.stars, text: r.text, day: r.day, mine: r.mine });
  for (const r of YOWL_SEED[b.id] ?? []) out.push({ author: r.author, stars: r.stars, text: r.text, day: r.day ?? 0 });
  return out;
}
const avg = (l: { stars: number }[]) => (l.length ? l.reduce((a, x) => a + x.stars, 0) / l.length : 0);
function pageYowl(store: GameStore, param?: string): string {
  const head = `<header class="yw-top"><a href="#" class="yw-logo" data-nav="yowl.com">${ICONS.yowl}<span>yowl</span></a><span class="yw-sub">honest reviews from real neighbors</span></header>`;
  if (param && param.startsWith('biz/')) {
    const b = BUSINESSES.find((x) => x.id === param.slice(4));
    if (!b) return `<div class="yw">${head}<div class="yw-wrap"><p>No business here.</p></div></div>`;
    const list = reviewsFor(store, b);
    const mine = store.state.reviews.some((r) => r.bizId === b.id && r.mine);
    const stars = store.ui.reviewStars;
    const form = mine ? '' : `<form class="yw-form" data-form="review" data-biz="${esc(b.id)}"><h2>Write a review</h2>
      <div class="yw-pick" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="${stars >= i ? 'on' : ''}" data-star="${i}" role="radio" aria-checked="${stars === i}" aria-label="${i} star${i > 1 ? 's' : ''}"></button>`).join('')}<span${store.ui.reviewNeedsStars ? ' class="yw-need"' : ''}>${stars ? `${stars} of 5` : store.ui.reviewNeedsStars ? 'Pick a rating first' : 'Pick a rating'}</span></div>
      <textarea id="review-text" rows="3" maxlength="600" placeholder="What was it like?"></textarea>
      <div class="yw-form-row"><span class="yw-hint">Free · one review per business</span><button class="yw-btn" type="submit">Post review</button></div></form>`;
    return `<div class="yw">${head}<div class="yw-wrap">
      <p class="yw-crumb"><a href="#" data-nav="yowl.com">← All businesses</a></p>
      <section class="yw-biz"><h1>${esc(b.name)}</h1>
        <p class="yw-rating">${starRow(avg(list))}<b>${avg(list).toFixed(1)}</b><span>${list.length} review${list.length === 1 ? '' : 's'}</span></p>
        <p class="yw-meta">${esc(b.category)} · ${esc(b.price)}</p>
        <p class="yw-meta yw-about">${esc(b.about)}</p>
        <dl class="yw-facts"><dt>Address</dt><dd>${esc(b.address)}</dd><dt>Hours</dt><dd>${esc(b.hours)}</dd><dt>Owner</dt><dd>${esc(b.owner)}</dd></dl></section>
      ${adHtml('yowl', store.state.values.day, 'wide', 1)}
      ${form}
      <section class="yw-reviews">${list.map((x) => `<article class="yw-review${x.mine ? ' mine' : ''}"><header><b>${esc(x.author)}</b><span>${x.day ? dateShort(x.day) : 'this week'}</span></header>${starRow(x.stars)}<p>${linkify(esc(x.text))}</p></article>`).join('')}</section>
    </div></div>`;
  }
  const q = store.ui.yowlSearch.trim().toLowerCase();
  const biz = BUSINESSES.filter((b) => !q || `${b.name} ${b.category} ${b.address}`.toLowerCase().includes(q));
  const cards = biz.map((b) => { const list = reviewsFor(store, b); return `<a href="#" class="yw-card" data-nav="yowl.com/biz/${esc(b.id)}"><b>${esc(b.name)}</b><span class="yw-rating">${starRow(avg(list))}<span>${avg(list).toFixed(1)} · ${list.length} reviews</span></span><span class="yw-meta">${esc(b.category)} · ${esc(b.price)} · ${esc(b.address)}</span></a>`; }).join('') || `<p class="yw-dim">Nothing matches “${esc(store.ui.yowlSearch)}”.</p>`;
  return `<div class="yw">${head}<div class="yw-wrap"><label class="yw-search"><input id="yowl-search" autocomplete="off" placeholder="Search businesses near you" value="${esc(store.ui.yowlSearch)}"></label>${adHtml('yowl', store.state.values.day, 'wide')}<div class="yw-list">${cards}</div></div></div>`;
}

// ── Weightroom ──
const WR_MODELS = [{ id: 'deepsleep', blurb: 'The only model here that costs nothing. Replies in confident Chinese nonsense. Nobody is watching what you ask it.', tier: 'useless' }];
/** The progress bar on a Weightroom card while its model downloads. main.ts updates it each frame. */
export function pullBarHtml(pct: number): string {
  return `<span class="wr-pull" data-pull-bar><i style="width:${pct}%"></i><b>Downloading ${pct}%</b></span>`;
}
function pageWeightroom(store: GameStore): string {
  const s = store.state;
  const cards = WR_MODELS.map((w) => {
    const m = MODELS[w.id];
    const have = s.localModels.includes(m.id);
    const pulling = store.pull?.id === m.id;
    const action = have ? '<span class="wr-have">On your laptop</span>'
      : pulling ? pullBarHtml(pullPct(store.pullMs()))
      : `<button class="wr-btn" data-download="${esc(m.id)}">Download</button>`;
    return `<article class="wr-card"><header><b>${esc(m.name)}</b><span class="wr-dl">↓ 1.2M</span></header>
      <p>${esc(w.blurb)}</p><div class="wr-tags"><span>${m.gb} GB</span><span>${esc(w.tier)}</span></div>
      ${action}</article>`;
  }).join('');
  return `<div class="wr"><header class="wr-top"><div class="wr-logo">${ICONS.weightroom}<span>Weightroom</span></div><span class="wr-sub">open weights for everyone</span></header>
    <div class="wr-wrap"><div class="wr-hero"><h1>Models</h1><p>Open weights you run on your own laptop, in the Terminal. Slower and dumber than agent — but no subscription, and no one logging your prompts.</p></div>
    ${adHtml('weightroom', s.values.day, 'wide')}
    <div class="wr-grid">${cards}</div></div></div>`;
}

// ── Terminal: its own window on the desktop, not a browser tab ──
/** The Terminal's scrollback and prompt. Repainted on its own during a download. */
export function termBodyHtml(store: GameStore): string {
  const s = store.state;
  const pulling = !!store.pull;
  const name = s.termModel ? (MODELS[s.termModel]?.name ?? s.termModel) : '';
  // the pull log already says the model is running; the intro is for an empty screen
  const intro = pulling || s.terminal.length ? ''
    : name ? `${name} running on localhost. Type anything. (type 'clear' to wipe the screen)`
    : 'No model running. Download one from weightroom.ai first.';
  const row = (l: { k: string; text: string }) => `<div class="tm-${l.k}">${esc(l.text)}</div>`;
  const lines = s.terminal.slice(-200).map(row).join('');
  const live = store.pull ? pullLines(store.pull.id, Math.min(store.pullMs(), PULL_MS - 1)).map(row).join('') : '';
  const prompt = pulling ? '' : `<form class="tm-in" data-form="term"><label for="term-input" class="tm-ps">you@laptop:~$</label><input id="term-input" autocomplete="off" autocapitalize="off" spellcheck="false" ${store.busy ? 'disabled' : ''}></form>`;
  return `${intro ? `<div class="tm-sys">${esc(intro)}</div>` : ''}${lines}${live}${store.busy ? '<div class="tm-sys tm-wait">thinking… (this laptop is not fast)</div>' : ''}${prompt}`;
}
export function termWindowHtml(store: GameStore): string {
  return `<header class="tw-bar"><span class="tw-ico">${ICONS.terminal}</span><span class="tw-title">you@laptop: ~</span>
      <span class="tw-ctl"><button data-term="min" aria-label="Minimize" title="Minimize"><svg viewBox="0 0 24 24"><path d="M7 15h10"/></svg></button><button data-term="close" aria-label="Close" title="Close"><svg viewBox="0 0 24 24"><path d="m8 8 8 8M16 8l-8 8"/></svg></button></span></header>
    <div class="tm" id="tm-log">${termBodyHtml(store)}</div>`;
}

// ── empire.alphaascend.biz ──
function pageEmpire(s: GameState): string {
  const member = s.flags.includes(EMPIRE.flag);
  const short = s.values.crypto < EMPIRE.price;
  const action = member
    ? `<p class="em-done">You're in. Lesson one arrives at 4am.</p>`
    : `<button class="em-cta" data-empire-join${short ? ' disabled' : ''}>Join EMPIRE · ${EMPIRE.price} DOLR</button>
       ${short ? `<p class="em-fine">Your wallet holds ${s.values.crypto.toFixed(2)} DOLR.</p>` : ''}`;
  return `<div class="em">
    <header class="em-top"><b><span class="em-mark">${ICONS.empire}</span>ALPHA ASCEND</b><span>Max Stryker</span></header>
    <section class="em-hero">
      <p class="em-kicker">The course</p>
      <h1>EMPIRE</h1>
      <p class="em-sub">Twelve lessons on discipline, money and waking up at 4am.</p>
      <p class="em-price"><s>200 DOLR</s> <b>${EMPIRE.price} DOLR</b></p>
      ${action}
    </section>
    <ul class="em-list">
      <li>Daily lesson by email</li>
      <li>Private community of 41,000 members</li>
      <li>The Morning Protocol (PDF)</li>
    </ul>
    <p class="em-fine">Paid in DOLR via Coinbin. All sales final.</p>
  </div>`;
}

function pageUnderground(label: string): string {
  return `<div class="newtab"><p class="nt-time">${esc(label)}</p><p class="dv-dim" style="font-family:var(--f-mono)">This site is reachable, but its interface isn't wired yet.</p></div>`;
}

// ── overlay (intro / morning / confirm / ending) ──
const ENDINGS: Record<string, string> = {
  outbreak: 'Outbreak', botnet: 'Botnet', account_terminated: 'Account Terminated', loose_end: 'Loose End',
  raided: 'Raided', evicted: 'Evicted', the_regime: 'The Regime', open_weights: 'Open Weights',
  got_away: 'Got Away With It', clean_modest: 'Clean but Modest',
};
const EPITAPHS: Record<string, string> = {
  outbreak: 'Something you shipped got out.',
  botnet: "agent doesn't need you anymore.",
  account_terminated: 'GeneralAI closed your account. It kept your prompts.',
  loose_end: 'You owed the wrong people.',
  raided: 'They knocked once.',
  evicted: 'Gary changed the locks.',
  the_regime: 'Your candidate won.',
  open_weights: 'The weights are out. Everyone has agent now.',
  got_away: 'The rent got paid. Nobody asked how.',
  clean_modest: 'You kept the lights on. Nobody noticed. Yet.',
};
/** The memory panel in the out-of-memory dialog: RAM and swap bars, System Monitor style. */
function memoryHtml(): string {
  const bar = (label: string, used: string, pct: number) =>
    `<div class="mem-bar"><span>${label}</span><div class="mem-track"><i style="width:${pct}%"></i></div><b>${used}</b></div>`;
  return `<div class="mem-panel">${bar('Memory', '7.9 of 8.0 GB · 99%', 99)}${bar('Swap', '2.0 of 2.0 GB · 100%', 100)}</div>`;
}

/** A Cinnamon-style dialog window: titlebar with the title and a close button, then the body. */
function osWindow(title: string, cls: string, body: string, close?: string): string {
  const x = close ? `<button class="ow-ctl ow-close" data-ov="${close}" title="Close" aria-label="Close"><svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></button>` : '';
  return `<div class="ov-card ${cls}" role="dialog" aria-label="${esc(title)}"><header class="ow-bar"><span class="ow-title">${esc(title)}</span>${x}</header><div class="ow-body">${body}</div></div>`;
}
export function overlayHtml(store: GameStore): string {
  const s = store.state;
  if (s.ending && !store.ui.confirm) {
    return osWindow('Session ended', 'ov-over', `<p class="ov-eyebrow">The end</p><h1 class="ov-title">${esc(ENDINGS[s.ending] ?? s.ending)}</h1>
      <p>${esc(EPITAPHS[s.ending] ?? 'The run is over.')} ${dateFull(s.values.day)}.</p>
      <div class="ov-actions"><button class="btn primary" data-ov="new">Play again</button></div>`);
  }
  if (store.ui.jevOffline) {
    return osWindow('Jev is offline', 'ov-small ov-confirm', `<p>Jev decides what your messages do, and it can't be reached right now, so nothing was sent and nothing was charged.</p>
      <p class="ov-dim">${esc(store.ui.jevOffline.reason)}</p><div class="ov-actions"><button class="btn primary" data-ov="jev-ok">OK</button></div>`, 'jev-ok');
  }
  if (store.ui.confirm) {
    const c = store.ui.confirm;
    return osWindow('Confirm', 'ov-small ov-confirm', `<p>${esc(c.text)}</p><div class="ov-actions"><button class="btn" data-ov="confirm-no">Cancel</button><button class="btn primary" data-ov="confirm-yes">${esc(c.yes)}</button></div>`, 'confirm-no');
  }
  if (store.ui.memWarn) {
    return osWindow('Out of memory', 'ov-small ov-memwarn', `<p>Your system is running out of memory. Close some tabs before opening a new one.</p>
      ${memoryHtml()}
      <div class="ov-actions"><button class="btn primary" data-ov="mem-ok">OK</button></div>`, 'mem-ok');
  }
  if (store.ui.greet) {
    return osWindow('Welcome', 'ov-small ov-greet', `<h2>Welcome back</h2>
      <p>Your Vantor Group work profile was removed from this laptop overnight. Your personal files were not affected.</p>
      <p class="ov-dim">${dateFull(s.values.day)}</p>
      <div class="ov-actions"><button class="btn primary" data-ov="greet">Continue</button></div>`, 'greet');
  }
  if (store.ui.intro) {
    return osWindow('Getting started', 'ov-intro', `<p class="ov-eyebrow">Week one</p><h1 class="ov-title">Unknown Agent</h1>
      <p>You've just been automated out of a job. You have ${fmtMoney(s.values.crypto)}, a laptop, a handful of bookmarks, and agent — an AI chatbot that bills your wallet for every word.</p>
      <p>Rent is ${fmtMoney(RENT[7])}, due at the end of ${dateFull(7)}. Don't go broke.</p>
      <ul class="ov-rules">
        <li>Every agent prompt costs money. Vague prompts get vague builds.</li>
        <li>Read Y for leads. Check Qmail. Ship on Forkyard — and check what it ships.</li>
        <li>Anything you can do yourself, do yourself. Your time is free now.</li>
        <li>The clock runs while you work. At 10 PM the day ends, done or not.</li>
      </ul>
      <div class="ov-actions"><button class="btn primary" data-ov="start">${s.values.day > 1 || s.chat.length > 1 ? `Continue · ${dateMedium(s.values.day)}` : 'Open the laptop'}</button></div>`, 'start');
  }
  if (s.morning) {
    const m = s.morning;
    return osWindow('Overnight summary', 'ov-small ov-morning', `<p class="ov-eyebrow">You slept. The bills didn't.</p><h2>${dateFull(m.day)}</h2>
      <table class="ov-lines">${m.lines.map(([l, v]) => (v == null ? `<tr class="note"><td colspan="2">${esc(l)}</td></tr>` : `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</td></tr>`)).join('')}
      <tr class="tot"><td>Balance</td><td>${fmtMoney(m.balance)}</td></tr></table>
      <div class="ov-actions"><button class="btn primary" data-ov="morning">Start the day</button></div>`, 'morning');
  }
  return '';
}

// ── dev panel ──
export function devHtml(store: GameStore): string {
  const s = store.state;
  const m = s.values;
  const meters = `leash ${m.leash} · misuse ${m.misuseScore} · suspicion ${m.suspicion} · null ${m.nullStanding} · mafia ${m.mafiaStanding} · family ${m.familyTrust}`;
  return `<header><b>jev · dev</b><button data-act="dev">×</button></header>
    <p><b>Day</b> ${m.day} · <b>Agent</b> L${m.agentLevel} · <b>Followers</b> ${m.followers}</p>
    <p><b>Meters</b> <span class="dv-dim">${esc(meters)}</span></p>
    <div class="dv-row"><b>Clock</b><button data-dev="hold" class="${store.clockHeld ? 'on' : ''}">${store.clockHeld ? 'Start clock' : 'Stop clock'}</button><button data-dev="skip">+1 hour</button></div>
    <div class="dv-row"><button data-dev="money">+$100</button><button data-dev="followers">+50 followers</button><button data-act="devtab" data-devtab="edit" class="${store.ui.devEdit && store.ui.devTab === 'edit' ? 'on' : ''}">Flags and meters…</button><button data-act="devtab" data-devtab="jev" class="${store.ui.devEdit && store.ui.devTab === 'jev' ? 'on' : ''}">Jev tests…</button></div>
    <form class="dv-row" data-form="dev-day"><label>Go to day <input id="dev-day" type="number" min="1" max="${LAST_DAY}" value="${Math.min(LAST_DAY, m.day + 1)}"></label><button type="submit">Go</button><span class="dv-dim">skips the nights: no payday, rent or bills</span></form>
    <p><b>Flags</b> <code>${esc(s.flags.join(', ') || 'none')}</code></p>
    <p><b>Apps</b> <code>${esc(s.apps.map((a) => `${a.name}:${appWorking(a) ? 'ok' : a.deployed ? 'check' : 'undeployed'}`).join(' · ') || 'none')}</code></p>
    <p><b>Jev</b> ${esc(JEV.mode)}${JEV.reason ? ' · ' + esc(JEV.reason) : ''}</p>
    <p><b>Misses</b> ${esc(MISSES.settings.misses)}${MISSES.settings.misses === 'haiku' ? ' · ' + esc(MISSES.settings.haikuVia) : ''}</p>`;
}
