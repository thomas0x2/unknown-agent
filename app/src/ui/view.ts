/*
 * The view: pure functions that return the legacy game's exact markup (class for class) from the
 * store. main.ts owns the DOM and drops these strings into the shell slots. Styling comes from the
 * legacy stylesheet (../../src/style.css); nothing here invents new classes.
 */
import type { GameStore } from '../game/store';
import { MISSES } from '../game/misses';
import { JEV } from '../game/backendJev';
import { listSlots, autoSlot } from '../game/saves';
import { ICONS, TOKENS, Y_ICONS } from './icons';
import { route, bookmarks, type Route, type SiteId } from '../sites/registry';
import {
  type GameState, type AppInstance, getApp, bugsOf, breakVariant, appWorking, agentCost, promptCost, RENT, LAST_DAY, AGENT_COST, dateShort, dateLong, dateMedium, dateFull, EMPIRE, BOUNCE_ADDR, eventBody, deliveryKey,
} from '../engine';
import { BUSINESSES, YOWL_SEED, type Business } from './yowl-data';
import { findUser } from './forkyard-users';
import { pageDrive } from './qdrive';
import { adHtml } from './ads';
import { MODELS, PULL_MS, pullLines, pullPct } from '../game/pull';
import { groupThreads, baseSubject } from './mailThreads';
import { renderAppSite, devBugPanel, devBugCount } from './appsite';
import { marketPosts, handleOf, machineFeed, FEED_PAGE } from '../engine';
import { devOptionsButton, devOptionsPanel } from './devOptions';

const WALLET_ADDR = '0x4417c3e8b1d05f2a9e6d7b0c1f83a4e5d2b9a9f2';
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
    .replace(/(^|[^\w.])@([a-z0-9_]+)/gi, '$1<a href="#" class="y-at" data-nav="y.com/$2">@$2</a>');
}

function tabTitle(r: Route, url: string): string {
  const names: Partial<Record<string, string>> = {
    newtab: 'New Tab', y: 'Home / Y', qmail: 'Qmail', qdrive: 'Qdrive', satchel: 'Satchel · Wallet', forkyard: 'Forkyard',
    agent: 'agent', yowl: 'Yowl', weightroom: 'Weightroom', nullboard: 'nullboard', cellar: 'Cellar', app: url,
  };
  if (r.site === 'notfound') return url || 'New Tab';
  return names[r.site] ?? r.def?.label ?? url;
}

// ── chrome slots (main.ts paints these into the static shell) ──
export function tabsHtml(store: GameStore): string {
  return store.tabs.map((t) => {
    const rr = route(t.url, store.state);
    return `<div class="tab${t.id === store.active ? ' on' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === store.active}" tabindex="0">
      <span class="tab-ico ico-${rr.site}">${ICONS[rr.site] || ICONS.newtab}</span><span class="tab-title">${esc(tabTitle(rr, t.url))}</span>
      <button class="tab-x" data-close="${t.id}" aria-label="Close tab">×</button></div>`;
  }).join('') + `<button class="tab-new" data-newtab aria-label="New tab">+</button>`;
}
export function bookmarksHtml(store: GameStore): string {
  return bookmarks(store.state).map((b) => {
    const badge = b.id === 'qmail' ? qmailBadge(store) : 0;
    return `<button class="bm" data-nav="${b.base}"><span class="bm-ico ico-${b.id}">${ICONS[b.id] || ICONS.newtab}</span><span class="bm-label">${esc(b.label)}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
  }).join('');
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
export function fmtClock(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  let h = Math.floor(m / 60) % 24; const mm = m % 60;
  const ap = h < 12 ? 'AM' : 'PM'; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}
export function clockHtml(s: GameState): string {
  const near = s.clockMin >= 22 * 60; // getting late
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
const BROWSER_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12V2a10 10 0 0 1 10 10z" fill="#ff5fa2"/><path d="M12 12h10a10 10 0 0 1-10 10z" fill="#ffb02e"/><path d="M12 12v10A10 10 0 0 1 2 12z" fill="#2ec4b6"/><path d="M12 12H2A10 10 0 0 1 12 2z" fill="#8a5cf6"/><rect x="7.6" y="7.6" width="8.8" height="8.8" rx="2.6" transform="rotate(45 12 12)" fill="#fff"/><rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.4" transform="rotate(45 12 12)" fill="#3a8dff"/></svg>';
const MI = {
  sleep: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5v.4M12 16.8v.2"/></svg>',
  term: '<svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15H17"/></svg>',
  slot: '<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
  logout: '<svg viewBox="0 0 24 24"><path d="M14 4H6v16h8M10 12h10m-3-3 3 3-3 3"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4"/><path d="M12 8v4l3 2"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
};
function autoRow(): string {
  const a = autoSlot();
  return `<div class="dm-slot dm-auto${a ? '' : ' empty'}">${MI.clock}<span><b>Autosave${a ? ` · ${dateShort(a.day)}` : ''}</b><small>${a ? 'Start of the day · ' + esc(fmtClock(a.clockMin)) : 'Made each morning after you sleep'}</small></span>
    <span class="dm-slot-acts">${a ? '<button data-slot-load="auto">Load</button>' : ''}</span></div>`;
}
export function startMenuHtml(store: GameStore): string {
  const s = store.state;
  const cat = store.ui.menuCat;
  const cats = [['saves', MI.folder, 'Saved games'], ['system', MI.gear, 'System']]
    .map(([id, icon, label]) => `<button class="dm-cat${cat === id ? ' on' : ''}" data-menu-cat="${id}">${icon}${label}</button>`).join('');
  const item = (act: string, icon: string, title: string, sub: string) =>
    `<button class="dm-item" data-act="${act}">${icon}<span><b>${esc(title)}</b><small>${esc(sub)}</small></span></button>`;
  const list = cat === 'system'
    ? item('new', MI.logout, 'New game', `Start over from ${dateLong(1)}`) + item('intro', MI.help, 'How to play', 'The rules, again') + item('devmode', MI.help, `Dev mode: ${store.devMode ? 'on' : 'off'}`, 'Show how agent replies were chosen') + item('dev', MI.term, 'Story debugger', 'jev · Ctrl+`')
    : autoRow() + listSlots().map((info, i) => {
      const n = i + 1;
      const when = info ? `${fmtClock(info.clockMin)} · saved ${new Date(info.savedAt).toLocaleString(undefined, { month: 'short', day: 'numeric' })}` : 'Empty';
      return `<div class="dm-slot${info ? '' : ' empty'}">${MI.slot}<span><b>Slot ${n}${info ? ` · ${dateShort(info.day)}` : ''}</b><small>${esc(when)}</small></span>
        <span class="dm-slot-acts">${info ? `<button data-slot-load="${n}">Load</button>` : ''}<button data-slot-save="${n}">Save</button></span></div>`;
    }).join('') + '<p class="dm-note">Your current game saves itself after every action. The autosave is a snapshot from the start of each day.</p>';
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
  return mailRows(store).filter((r) => r.folder === 'inbox' && r.unread).length;
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
  const feed = machineFeed(store.state.values.day);
  const pages = Math.ceil(feed.length / FEED_PAGE);
  const n = Math.min(Math.max(Number(m[1] ?? 1), 1), pages);
  const lines = feed.slice((n - 1) * FEED_PAGE, n * FEED_PAGE).map((x) => `M${x.id} ST=${x.st} T=${x.t}`).join('\n');
  const next = n < pages ? `<a href="#" data-nav="spincycle.test/feed/${n + 1}">next=/feed/${n + 1}</a>` : 'next=null';
  return `<pre class="spinfeed">SPINCYCLE STATUS FEED v1\npage=${n}/${pages}\n\n${lines}\n\n${next}</pre>`;
}

// ── page dispatch ──
export function page(store: GameStore, r: Route): string {
  if (!r.reachable) return pageError(store.url, r.site);
  switch (r.site) {
    case 'newtab': return pageNewTab(store);
    case 'qmail': return pageMail(store, r.param);
    case 'qdrive': return pageDrive(store.state, r.param);
    case 'y': return pageY(store, r.param);
    case 'satchel': return pageWallet(store);
    case 'forkyard': return pageForkyard(store, r.param);
    case 'app': return pageApp(store, r.param);
    case 'agent': return r.param === 'models' ? pageModels(store) : pageAgent(store);
    case 'yowl': return pageYowl(store, r.param);
    case 'weightroom': return pageWeightroom(store);
    case 'empire': return pageEmpire(store.state);
    case 'spinfeed': return pageSpinFeed(store, r.param);
    default: return pageUnderground(r.def?.label ?? r.site);
  }
}

function pageError(url: string, site: SiteId): string {
  if (site === 'notfound' || !url) return `<div class="err"><h1>This site can't be reached</h1><p><code>${esc(url)}</code> didn't respond.</p><p class="err-sub">Try the bookmarks. They are the only sites you can afford.</p></div>`;
  return `<div class="err"><h1>Not reachable yet</h1><p>You haven't discovered <code>${esc(url)}</code>.</p></div>`;
}

function pageNewTab(store: GameStore): string {
  const s = store.state;
  const tiles = bookmarks(s).map((b) => `<button class="nt-tile nt-${b.id}" data-nav="${b.base}"><span class="nt-ico">${ICONS[b.id] || ICONS.newtab}</span><span>${esc(b.label)}</span></button>`).join('');
  return `<div class="newtab"><p class="nt-time">${dateFull(s.values.day)}</p>
    <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
    <div class="nt-tiles">${tiles}</div></div>`;
}

// ── Qmail ──
interface Row { id: string; seq: number; from: string; addr: string; subject: string; body: string; day: number; unread: boolean; needsReply: boolean; folder: 'inbox' | 'sent'; eventId?: string; generated?: boolean; to?: string; link?: string; bounceOf?: string; bookingId?: string }
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
    rows.push({ id: 'e/' + key, seq: d.seq ?? -1, from: e.from ?? 'Unknown', addr: e.addr ?? '', subject: e.subject ?? '', body: tpl(eventBody(e, d.day)), day: d.day, unread: !s.readEvents.includes(key), needsReply: canReply, folder: 'inbox', eventId: e.id });
  }
  for (const m of s.mail) rows.push({ id: 'm/' + m.id, seq: m.seq ?? (Number(m.id.replace(/\D/g, '')) || 0), from: m.from, addr: m.addr, subject: m.subject, body: m.body, day: m.day, unread: m.folder === 'inbox' && !m.read, needsReply: false, folder: m.folder, eventId: m.eventId, generated: m.generated, to: m.to, link: m.link, bounceOf: m.bounceOf, bookingId: m.bookingId });
  return rows;
}
function pageMail(store: GameStore, param?: string): string {
  const s = store.state;
  const view = param === 'sent' ? 'sent' : param === 'compose' ? 'compose' : param?.startsWith('m/') || param?.startsWith('e/') ? 'msg' : 'inbox';
  const unread = qmailBadge(store);
  const rows = mailRows(store);
  const side = `<nav class="qm-side" aria-label="Folders">
    <a href="#" class="qm-new" data-nav="qmail.com/compose">Compose</a>
    <a href="#" data-nav="qmail.com" class="${view === 'inbox' ? 'on' : ''}">Inbox${unread ? `<b>${unread}</b>` : ''}</a>
    <a href="#" data-nav="qmail.com/sent" class="${view === 'sent' ? 'on' : ''}">Sent</a>
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
      <div class="qm-actions"><button class="qm-btn" type="submit">Send</button><button class="qm-btn ghost" type="button" data-mail-discard>Discard</button><span class="qm-hint">Free. One email per person per day.</span></div>
    </form>`;
  } else if (view === 'msg') {
    const row = rows.find((x) => x.id === param);
    if (!row) main = `<p class="qm-empty">This message doesn't exist.</p>`;
    else {
      // the whole conversation, oldest first; what came in since the player last wrote starts expanded
      const thread = groupThreads(rows).find((t) => t.rows.includes(row))!;
      for (const r of thread.rows) if (r.unread) store.markReadMail(r.id);
      const lastSent = thread.rows.map((r) => r.folder).lastIndexOf('sent');
      const inSent = thread.rows.every((r) => r.folder === 'sent');
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
          <summary class="qm-meta"><span>${meta}<span class="qm-snip">${esc(r.body.replace(/\s+/g, ' ').slice(0, 90))}</span></span><span>${dateShort(r.day)}</span></summary>
          <div class="qm-body">${linkify(br(r.body))}</div>
          ${r.link === 'cancel' && r.bookingId ? (s.bookings.find((b) => b.id === r.bookingId)?.cancelClicked
            ? `<p class="qm-actions"><b>Your booking has been cancelled.</b></p>`
            : `<p class="qm-actions"><button class="qm-btn ghost" data-cancel-booking="${esc(r.bookingId)}" data-cancel-url="${esc(`${r.addr.split('@')[1] ?? ''}/cancel-${r.bookingId}`)}">Cancel booking</button></p>`) : ''}
          ${r.generated ? `<p class="qm-gen">Reply written by ${esc(MISSES.label())}</p>` : ''}
        </details>`;
      }).join('');
      main = `<article class="qm-read">
        <p class="qm-crumbs"><a href="#" data-nav="qmail.com${inSent ? '/sent' : ''}">${inSent ? 'Sent' : 'Inbox'}</a></p>
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
    const html = groupThreads(rows).filter((t) => t.rows.some((r) => r.folder === folder)).map((t) => {
      const last = t.rows[t.rows.length - 1];
      const unread = t.rows.some((r) => r.unread);
      const names = [...new Set(t.rows.filter((r) => r.addr !== BOUNCE_ADDR).map((r) => (r.folder === 'sent' ? 'me' : r.from)))];
      const who = folder === 'sent' ? `To: ${t.with}` : names.slice(-3).join(', ');
      const snippet = last.body.replace(/\s+/g, ' ').slice(0, 90);
      return `<a href="#" class="qm-row${unread ? ' unread' : ''}" data-nav="qmail.com/${esc(last.id)}">
        <span class="qm-from">${unread && folder === 'inbox' ? '<i class="qm-dot" aria-label="Unread"></i>' : ''}<span class="qm-names">${esc(who)}</span>${t.rows.length > 1 ? `<span class="qm-count">${t.rows.length}</span>` : ''}</span>
        <span class="qm-subj"><b>${esc(t.rows[0].subject)}</b> <span>${esc(snippet)}</span></span>
        <span class="qm-time">${dateShort(last.day)}</span></a>`;
    }).join('');
    main = `<h1 class="qm-h">${view === 'sent' ? 'Sent' : 'Inbox'}</h1>${adHtml('qmail', s.values.day, 'wide')}${html ? `<div class="qm-list">${html}</div>` : `<p class="qm-empty">${view === 'sent' ? 'Nothing sent yet.' : 'No mail.'}</p>`}`;
  }
  return `<div class="qm">
    <header class="qm-top"><div class="qm-logo">${ICONS.mail}<span>Qmail</span></div>${devOptionsButton(store, 'qmail')}<span class="qm-user">${esc(PLAYER.addr)}</span></header>
    <div class="qm-wrap">${side}<main class="qm-main">${main}</main></div>${devOptionsPanel(store, 'qmail')}</div>`;
}

// ── Y ──
interface YPost { id: string; author: string; handle: string; text: string; day: number; likes: number; mine?: boolean; delta?: number; score?: number; replyTo?: string; pinned?: boolean; /** Order within a day: story posts first, bot spam last. */ rank?: number }
function yPosts(store: GameStore): YPost[] {
  const s = store.state;
  const out: YPost[] = [];
  const market = marketPosts(s, store.content);
  for (const d of s.delivered.filter((x) => x.site === 'y')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    out.push({ id: e.id, author: e.from ?? 'someone', handle: handleFrom(e.from ?? 'someone'), text: tpl(e.body ?? ''), day: d.day,
      // a stock post shows the likes the crawler sees
      likes: market.find((p) => p.id === e.id)?.likes ?? 20 + hashHue(e.id) % 400 });
  }
  // the stock chatter the sentiment crawler reads (story events with stock labels are already above)
  for (const p of market) if (!out.some((x) => x.id === p.id)) out.push({ id: p.id, author: p.author, handle: p.handle, text: p.text, day: p.day, likes: p.likes, rank: p.bot ? 2 : 1 });
  for (const f of store.content.yFiller) if (hashHue(f.id) % 3 === s.values.day % 3) out.push({ id: f.id, author: f.from, handle: f.handle, text: f.body, day: s.values.day, likes: 3 + hashHue(f.id) % 60, rank: 1 });
  for (const x of s.yExtra) out.push({ id: x.id, author: x.author, handle: x.handle, text: x.text, day: x.day, likes: x.likes, replyTo: x.replyTo, pinned: !!x.about });
  for (const u of s.userPosts) out.push({ id: u.id, author: PLAYER.name, handle: PLAYER.handle, text: u.text, day: u.day, likes: u.likes, mine: true, delta: u.delta, score: u.score });
  return out.sort((a, b) => b.day - a.day || Number(!!b.pinned) - Number(!!a.pinned) || (a.rank ?? 0) - (b.rank ?? 0) || b.id.localeCompare(a.id));
}
function yPostHtml(store: GameStore, p: YPost): string {
  const liked = !!store.ui.liked[p.id];
  const likes = p.likes + (liked ? 1 : 0);
  const text = linkify(esc(p.text).replace(/(^|[^&\w])(#[a-z][a-z0-9_]*)/gi, '$1<span class="y-at">$2</span>'));
  const prof = `y.com/${esc(p.handle)}`;
  return `<article class="y-post${p.mine ? ' mine' : ''}">
    <header>
      <a href="#" class="y-av-link" data-nav="${prof}">${avatar(p.author, p.handle)}</a>
      <a href="#" class="y-who" data-nav="${prof}"><span class="y-name"><b>${esc(p.author)}</b></span><span class="y-handle">@${esc(p.handle)}</span></a>
      <span class="y-time">${dateShort(p.day)}</span>
    </header>
    <p>${text}</p>
    <footer class="y-acts">
      <span class="y-act">${Y_ICONS.reply}${compact(Math.round(likes * 0.07))}</span>
      <span class="y-act">${Y_ICONS.repost}${compact(Math.round(likes * 0.14))}</span>
      <button class="y-act like${liked ? ' on' : ''}" data-like="${esc(p.id)}" aria-label="Like">${Y_ICONS.heart}${compact(likes)}</button>
      ${p.mine && p.delta != null ? `<span class="y-delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '±'}${Math.abs(p.delta)} followers${p.score != null ? `<span class="y-score">rated ${p.score.toFixed(1)}/4</span>` : ''}</span>` : ''}
      <span class="y-act views">${Y_ICONS.views}${compact(Math.max(12, likes * 37 + 9))}</span>
    </footer></article>`;
}
function pageY(store: GameStore, profile?: string): string {
  const s = store.state;
  const posts = yPosts(store);
  const q = store.ui.ySearch.trim().toLowerCase();
  const trending = store.content.trending[s.values.day] ?? [];
  const feed = (q ? posts.filter((p) => `${p.author} ${p.handle} ${p.text}`.toLowerCase().includes(q.replace(/^@/, ''))) : posts).map((p) => yPostHtml(store, p)).join('') || `<p class="y-none">Quiet timeline.</p>`;
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
    <p class="y-eyebrow"><i class="y-live"></i>${q ? 'Search' : 'Timeline · live'}</p>
    ${adHtml('y', s.values.day, 'wide')}
    <div class="y-feed">${feed}</div>`;
  return `<div class="y">
    <header class="y-bar">
      <div class="y-brand"><span class="y-mark">${ICONS.y}</span></div>
      <nav class="y-pills"><a href="#" data-nav="y.com" class="${profile ? '' : 'on'}">Home</a><a href="#" data-nav="y.com/you" class="${profile === 'you' ? 'on' : ''}">Profile</a></nav>
      <span class="y-count"><b>${compact(s.values.followers)}</b> followers</span>
      <label class="y-search">${Y_ICONS.explore}<input id="y-search" autocomplete="off" placeholder="Search Y or @username" value="${esc(store.ui.ySearch)}"></label>
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
  const followers = mine ? s.values.followers : 20 + hashHue(h) % 400;
  const feed = posts.length ? posts.map((p) => yPostHtml(store, p)).join('') : `<p class="y-none">@${esc(h)} hasn't posted anything you can see.</p>`;
  return `${back}<section class="y-prof">
    <div class="y-banner" style="--h:${hashHue(h)}"></div>
    <div class="y-prof-head"><div class="y-prof-av">${avatar(name, h)}</div></div>
    <h1 class="y-prof-name">${esc(name)}</h1><p class="y-handle">@${esc(h)}</p>
    <p class="y-prof-stats"><span><b>${compact(40 + hashHue(h + 'f') % 300)}</b> following</span><span><b>${compact(followers)}</b> followers</span></p>
  </section><p class="y-eyebrow">Posts</p><div class="y-feed">${feed}</div>`;
}

// ── Satchel (minimal, ledger-style) ──
function txHash(x: { day: number; memo: string; amount: number }): string {
  let h = 2166136261;
  for (const c of `${x.day}|${x.memo}|${x.amount}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = (h.toString(16) + (h ^ 0x9e3779b9).toString(16)).padEnd(16, '0');
  return `0x${hex.slice(0, 6)}…${hex.slice(-4)}`;
}
const RANGES: Record<string, number> = { '1W': 7, '1M': 30, 'All': 9999 };
function balanceChart(pts: { day: number; bal: number }[]): string {
  const w = 720, h = 180, padX = 4, padY = 14;
  const vals = pts.map((p) => p.bal);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const xs = (i: number) => padX + (i / Math.max(1, pts.length - 1)) * (w - padX * 2);
  const ys = (v: number) => h - padY - ((v - lo) / span) * (h - padY * 2);
  const line = pts.map((p, i) => `${xs(i).toFixed(1)},${ys(p.bal).toFixed(1)}`).join(' ');
  const last = pts.length - 1;
  const grid = [0.25, 0.5, 0.75].map((f) => `<line x1="0" x2="${w}" y1="${(padY + f * (h - padY * 2)).toFixed(1)}" y2="${(padY + f * (h - padY * 2)).toFixed(1)}" class="sx-grid"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="sx-chart" preserveAspectRatio="none" role="img" aria-label="Balance history">
    <defs><linearGradient id="sx-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--sx-accent)" stop-opacity="0.28"/><stop offset="1" stop-color="var(--sx-accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <polygon points="${xs(0).toFixed(1)},${h} ${line} ${xs(last).toFixed(1)},${h}" fill="url(#sx-fill)"/>
    <polyline points="${line}" class="sx-line"/>
    <circle cx="${xs(last).toFixed(1)}" cy="${ys(pts[last].bal).toFixed(1)}" r="3.5" class="sx-dot"/></svg>`;
}
function pageWallet(store: GameStore): string {
  const s = store.state;
  const txs = s.tx;
  const range = store.ui.walletRange in RANGES ? store.ui.walletRange : '1M';
  // balance after every transaction, oldest first
  let bal = Math.round((s.values.crypto - txs.reduce((n, x) => n + x.amount, 0)) * 100) / 100;
  const series: { day: number; bal: number }[] = [{ day: (txs[0]?.day ?? s.values.day) - 1, bal }];
  for (const x of txs) { bal = Math.round((bal + x.amount) * 100) / 100; series.push({ day: x.day, bal }); }
  const from = s.values.day - RANGES[range];
  let window = series.filter((p) => p.day > from);
  const before = series.filter((p) => p.day <= from).pop();
  if (before) window = [{ day: from, bal: before.bal }, ...window];
  if (window.length < 2) window = [{ day: from, bal: window[0]?.bal ?? s.values.crypto }, ...window, { day: s.values.day, bal: s.values.crypto }];
  const startBal = window[0].bal;
  const change = Math.round((s.values.crypto - startBal) * 100) / 100;
  const pct = startBal ? (change / Math.abs(startBal)) * 100 : 0;
  const up = change >= 0;

  // operations, newest first, grouped by date
  const groups = new Map<number, typeof txs>();
  for (const x of txs.slice().reverse()) { if (!groups.has(x.day)) groups.set(x.day, []); groups.get(x.day)!.push(x); }
  const ops = [...groups.entries()].map(([day, list]) => `<div class="sx-day"><span>${esc(dateMedium(day))}</span><span>${day === s.values.day ? 'Today' : ''}</span></div>` + list.map((x) => {
    const out = x.amount < 0;
    const [who, note] = x.memo.split(' · ');
    return `<div class="sx-op">
      <span class="sx-op-ico ${out ? 'out' : 'in'}" aria-hidden="true">${out ? '↑' : '↓'}</span>
      <span class="sx-op-what"><b>${esc(who)}</b><small>${esc(note || (out ? 'Sent' : 'Received'))}</small></span>
      <code class="sx-op-hash">${txHash(x)}</code>
      <span class="sx-op-amt ${out ? '' : 'pos'}">${out ? '−' : '+'}${Math.abs(x.amount).toFixed(2)}<small>DOLR</small></span>
    </div>`;
  }).join('')).join('');

  const income = s.apps.filter(appWorking).reduce((n, a) => n + (a.kind === 'client' ? a.payPerDay : Math.round((a.users ?? 0) * 0.3)), 0);
  const sub = agentCost(s.values.agentLevel).sub;
  const live = s.apps.filter((a) => a.deployed && !a.churned).length;
  const rentDay = rentDayOf(s);
  const upcoming = [
    rentDay ? `<div class="sx-row"><span><b>Rent</b><small>Landlord · ${rentDay === s.values.day ? 'tonight' : `${esc(dateShort(rentDay))} · in ${rentDay - s.values.day}d`}</small></span><span class="sx-num">−${RENT[rentDay].toFixed(2)}</span></div>` : '',
    `<div class="sx-row"><span><b>agent subscription</b><small>GeneralAI · nightly</small></span><span class="sx-num">−${sub.toFixed(2)}</span></div>`,
    live ? `<div class="sx-row"><span><b>Hosting</b><small>Forkyard · ${live} live · nightly</small></span><span class="sx-num">−${(live * 2).toFixed(2)}</span></div>` : '',
    income ? `<div class="sx-row"><span><b>App income</b><small>Working apps · nightly</small></span><span class="sx-num pos">+${income.toFixed(2)}</span></div>` : '',
  ].join('');
  const total = s.values.crypto + 0.42;
  const tabs = Object.keys(RANGES).map((r) => `<button class="sx-tab${r === range ? ' on' : ''}" data-wl-range="${r}">${r}</button>`).join('');
  return `<div class="sx">
    <header class="sx-top">
      <div class="sx-logo"><span class="sx-mark">${ICONS.satchel}</span><span>Satchel</span></div>
      <span class="sx-sync"><i></i>Synchronized</span>
      <code class="sx-acct">${shortAddr(WALLET_ADDR)}</code>
    </header>
    <div class="sx-wrap">
      ${adHtml('satchel', s.values.day, 'wide')}
      <section class="sx-port">
        <div class="sx-port-head">
          <div>
            <p class="sx-label">Portfolio</p>
            <p class="sx-bal"><i class="sx-tok sx-tok-lg">${TOKENS.dolr}</i><span>${s.values.crypto < 0 ? '−' : ''}${Math.abs(s.values.crypto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><small>DOLR</small></p>
            <p class="sx-chg ${up ? 'pos' : 'neg'}">${up ? '+' : '−'}${Math.abs(change).toFixed(2)} (${up ? '+' : '−'}${Math.abs(pct).toFixed(1)}%) <span>${range === 'All' ? 'all time' : `past ${range === '1W' ? 'week' : 'month'}`}</span></p>
          </div>
          <div class="sx-tabs" role="tablist" aria-label="Range">${tabs}</div>
        </div>
        ${balanceChart(window)}
        <div class="sx-axis"><span>${esc(dateShort(window[0].day))}</span><span>${esc(dateShort(s.values.day))}</span></div>
      </section>
      <div class="sx-cols">
        <section class="sx-card"><h2>Assets</h2>
          <div class="sx-row"><span class="sx-asset"><i class="sx-tok">${TOKENS.dolr}</i><span><b>DOLR</b><small>Dollar stablecoin · $1.00</small></span></span><span class="sx-alloc"><i style="width:${(Math.max(0, s.values.crypto) / total * 100).toFixed(1)}%"></i></span><span class="sx-num">${s.values.crypto.toFixed(2)}</span></div>
          <div class="sx-row"><span class="sx-asset"><i class="sx-tok">${TOKENS.mooncat}</i><span><b>MOONCAT</b><small>4,200,000 · <em class="neg">−99.4%</em></small></span></span><span class="sx-alloc"><i style="width:${Math.max(0.5, 0.42 / total * 100).toFixed(1)}%"></i></span><span class="sx-num">0.42</span></div>
        </section>
        <section class="sx-card"><h2>Upcoming</h2>${upcoming}</section>
      </div>
      <section class="sx-card sx-ops"><h2>Operations <span>${txs.length}</span></h2>${ops || '<p class="sx-empty">No operations yet.</p>'}</section>
    </div></div>`;
}

// ── Forkyard ──
function repoStatus(a: AppInstance): string {
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
  const repos = s.apps.map((a) => `<a href="#" class="fy-mini" data-nav="forkyard.com/${a.id}"><b>${esc(a.id)}</b><small>${esc(a.template)} · ${a.kind}</small></a>`).join('') || '<p class="fy-note">No repositories yet.</p>';
  return `<div class="fy">${fyHead(store, 'profile')}<div class="fy-wrap fy-prof">
    <aside class="fy-prof-side">
      <div class="fy-prof-av" style="--h:${hashHue('you')}">YOU</div>
      <h1 class="fy-prof-name">you</h1><p class="fy-prof-handle">@you</p>
      <p class="fy-prof-bio">Recently automated out of a job. Now automating other people's.</p>
      <dl class="fy-prof-facts"><dt>Followers</dt><dd>${compact(s.values.followers)}</dd><dt>Repos</dt><dd>${s.apps.length}</dd><dt>Joined</dt><dd>this week</dd></dl>
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
    const a = s.apps.find((x) => x.id === repo || x.url.startsWith(repo + '.'));
    if (!a) return `<div class="fy">${head}<div class="fy-wrap"><p class="fy-empty">404 — no repository called <code>${esc(repo)}</code>.</p></div></div>`;
    const tmpl = store.content.apps[a.template];
    const feats = a.repo.map((f) => {
      const page = tmpl?.features.find((d) => d.id === f.id)?.pageId;
      const file = page ? (page === 'landing' ? 'index.html' : `${page}.html`) : `integrations/${f.id}.json`;
      return `<div class="fy-file">${esc(file)}</div>`;
    }).join('') || '<div class="fy-file"><small>Empty repository</small></div>';
    const stale = a.deployed && a.deployedVersion !== a.repoVersion;
    return `<div class="fy">${head}<div class="fy-wrap">
      <p class="fy-crumbs"><a href="#" data-nav="forkyard.com">you</a> / <b>${esc(a.id)}</b></p>
      <p class="fy-desc">${esc(a.name)} · template ${esc(a.template)}</p>
      ${devBugPanel(a, tmpl)}
      <div class="fy-grid">
        <div class="fy-files"><div class="fy-filehead">Pushed by <b>agent[bot]</b> · repo v${a.repoVersion}</div>${feats}</div>
        <div class="fy-deploy"><h2>Deployment</h2><p>${repoStatus(a)}</p>
          ${a.deployed
            ? `<dl><dt>Status</dt><dd>live at <a href="#" data-newtab="${esc(a.url)}">${esc(a.url)}</a></dd><dt>Hosting / day</dt><dd>$2.00</dd>${stale ? '<dt>Repo</dt><dd>new commit — redeploy</dd>' : ''}</dl><div class="fy-row"><button class="fy-btn" data-deploy="${esc(a.id)}">Redeploy</button><button class="fy-btn ghost" data-takedown="${esc(a.id)}">Take down</button></div>`
            : `<p class="fy-note">Hosting costs $2.00/day, billed nightly. Nothing is live until you deploy.</p><button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}
        </div></div></div></div>`;
  }
  const list = s.apps.length
    ? s.apps.slice().reverse().map((a) => `<article class="fy-repo">
        <div><a href="#" data-nav="forkyard.com/${a.id}" class="fy-name">${esc(a.id)}</a>${((n) => n ? `<span class="fy-devcount" title="Dev mode">${n} bug${n > 1 ? 's' : ''}</span>` : '')(devBugCount(a, store.content.apps[a.template]))}<p>${esc(a.name)}</p>
        <small><i class="fy-lang" style="--h:${hashHue(a.template)}"></i>${esc(a.template)} · ${a.kind}</small></div>
        <div class="fy-repo-act">${repoStatus(a)}${a.deployed ? '' : `<button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}</div></article>`).join('')
    : `<div class="fy-empty"><p><b>No repositories yet.</b></p><p>Brief the agent to build something.</p></div>`;
  return `<div class="fy">${head}<div class="fy-wrap"><h1 class="fy-h">Repositories <span>${s.apps.length}</span></h1>${adHtml('forkyard', s.values.day, 'wide')}${list}</div></div>`;
}

function pageApp(store: GameStore, param?: string): string {
  const s = store.state;
  const [appId, sub] = (param ?? '').split('/');
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
  // two steps, like the spec: who and when, then the time and party size
  const booking = a.template === 'restaurant' && a.features.some((f) => f.id === 'booking')
    ? bk.step === 1
      ? `<form class="pv-book" data-form="book-next" data-app="${esc(a.id)}"><h1>Book a table</h1>
        <p class="pv-sub">Step 1 of 2. You'll get a confirmation by email.</p>${notice}
        <label>Name <input id="bk-name" value="${esc(bk.name || PLAYER.name)}"></label>
        <label>Email <input id="bk-email" value="${esc(bk.email || PLAYER.addr)}"></label>
        <label>Date <select id="bk-date">${Array.from({ length: LAST_DAY }, (_, i) => i + 1).filter((d) => d >= firstBookable).map((d) => `<option value="${d}"${d === (bk.date || s.values.day + 1) ? ' selected' : ''}>${dateMedium(d)}</option>`).join('')}</select></label>
        <button class="pv-btn ok" type="submit">Continue</button></form>`
      : `<form class="pv-book" data-form="book" data-app="${esc(a.id)}"><h1>Book a table</h1>
        <p class="pv-sub">Step 2 of 2: ${esc(bk.name)}, ${dateFull(bk.date)}.</p>${notice}
        <label>Time <input id="bk-time" value="19:00"></label>
        <label>Party size <input id="bk-party" value="2" type="number" min="1" max="8"></label>
        <button class="pv-btn ghost" type="button" data-act="book-back">Back</button> <button class="pv-btn ok" type="submit">Book</button></form>`
    : undefined;
  // the cancel link from a confirmation email: it always says it worked (with the bug, it didn't)
  const cancelled = sub?.startsWith('cancel-') ? s.bookings.find((b) => b.id === sub.slice(7) && b.appId === a.id) : undefined;
  const cancel = cancelled
    ? `<h1>Booking cancelled</h1><p class="pv-note ok">Your booking for ${cancelled.party} on ${dateFull(cancelled.date)} at ${esc(cancelled.time)} has been cancelled.</p><p class="pv-sub">We hope to see you another time.</p>`
    : undefined;
  const tmpl = store.content.apps[a.template];
  return `<div class="pv-host">${renderAppSite(a, tmpl, cancel ? 'cancel' : sub, { booking, cancel, day: s.values.day, market: crawlable(store) })}</div>`;
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
function jevChip(): string {
  if (JEV.mode === 'online') return `<span class="ua-llm-dot"></span>Story decisions: Jev`;
  if (JEV.mode === 'checking') return `<span class="ua-llm-dot off"></span>Story decisions: checking Jev…`;
  return `<span class="ua-llm-dot off"></span><span title="${esc(JEV.reason)}">Story decisions: keyword matcher (Jev offline)</span>`;
}
function llmRow(): string {
  const st = MISSES.settings;
  const sel = (cur: string, v: string, l: string) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  let status = '';
  if (st.misses === 'haiku' && st.haikuVia === 'api' && JEV.haikuKey === false) status = '<span class="ua-llm-err">ANTHROPIC_API_KEY is not set in app/.env, so misses use scripted lines.</span>';
  else if (st.misses === 'haiku' && JEV.haikuKey === null && JEV.mode !== 'checking') status = '<span class="ua-llm-err">Start the proxy (npm run proxy) for Haiku replies.</span>';
  return `<label class="ua-llm-pick" title="What agent and email contacts say when Jev finds nothing in your message">Misses <select id="llm-misses">${sel(st.misses, 'haiku', 'Haiku (API)')}${sel(st.misses, 'scripted', 'Scripted lines')}</select></label>` +
    (st.misses === 'haiku' ? `<label class="ua-llm-pick" title="Subscription runs the claude CLI on your machine (dev only, slow); API uses ANTHROPIC_API_KEY">Haiku via <select id="llm-haiku-via">${sel(st.haikuVia, 'api', 'API key')}${sel(st.haikuVia, 'subscription', 'Claude subscription')}</select></label>` : '') +
    (status ? `<span class="ua-llm-status">${status}</span>` : '');
}
function pageAgent(store: GameStore): string {
  const s = store.state;
  const c = agentCost(s.values.agentLevel);
  const msgs = s.chat.map((m) => {
    if (m.from === 'you') return `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div><span class="ua-cost">${m.cost ? fmtMoney(-m.cost) + ' · ' : ''}agent-${m.level ?? s.values.agentLevel} · ${dateShort(m.day)}</span></div>`;
    if (m.from === 'system') return `<div class="ua-sys">${esc(m.text)}</div>`;
    const src = m.src ? `<span class="ua-src ${esc((m.src || '').split(':')[0])}">${esc(m.src)}</span>` : '';
    const model = m.src === 'llm' ? `<span class="ua-model" title="Written by a model">${esc(m.by ?? MISSES.label())}</span>`
      : m.note ? `<span class="ua-model" title="A scripted line stood in for Haiku">Scripted · ${esc(m.note)}</span>` : '';
    const debug = m.debug?.length ? `<details class="ua-debug"><summary>Details</summary>${m.debug.map((l) => `<div>${esc(l)}</div>`).join('')}</details>` : '';
    return `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text">${linkify(br(m.text))}</div>${model}${src}${debug}</div>`;
  }).join('');
  const p = store.pendingPrompt;
  const pending = p == null ? '' : `<div class="ua-msg you"><div class="ua-bubble">${esc(p)}</div><span class="ua-cost">${fmtMoney(-promptCost(s.values.agentLevel, p).total)} · agent-${s.values.agentLevel} · ${dateShort(s.values.day)}</span></div>`;
  const thinking = store.busy ? `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>` : '';
  return `<div class="ua">
    <header class="ua-head">
      <div class="ua-brand">${ICONS.agent}<div><b>agent</b><span>agent-${s.values.agentLevel} · ${fmtMoney(c.prompt)} per prompt + ${fmtMoney(c.word)} per word</span></div></div>
      ${devOptionsButton(store, 'agent')}<span class="ua-linked"><a href="#" data-nav="agent.chat/models" class="ua-upgrade">Models</a> · ${s.agentLocked ? 'LOCKED · unpaid' : 'Billing: Satchel ' + shortAddr(WALLET_ADDR)}</span>
    </header>
    <div class="ua-llm"><span class="ua-jev" id="ua-jev">${jevChip()}</span><span class="ua-llm-ctl" id="ua-llm">${llmRow()}</span></div>
    <div class="ua-log" id="ua-log">${msgs}${pending}${thinking}</div>
    <form class="ua-compose" data-form="prompt">
      <textarea id="prompt-input" rows="2" placeholder="Ask agent anything — build an app, fix one, write, translate, look something up…" ${s.ending ? 'disabled' : ''}></textarea>
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
      <dl><dt>Per prompt</dt><dd>${fmtMoney(c.prompt)}</dd><dt>Per word</dt><dd>${fmtMoney(c.word)}</dd><dt>Daily sub</dt><dd>${fmtMoney(c.sub)}</dd></dl>
      <div class="gm-act">${action}</div></article>`;
  }).join('');
  return `<div class="ua gm">
    <header class="ua-head"><div class="ua-brand">${ICONS.agent}<div><b>Models</b><span>GeneralAI rolls out each level automatically. You never buy them — but every level costs more.</span></div></div>
      <span class="ua-linked"><a href="#" data-nav="agent.chat" class="ua-upgrade">Back to chat</a></span></header>
    <div class="gm-grid">${cards}</div>
    <p class="gm-note">Rising costs, billed to Satchel ${shortAddr(WALLET_ADDR)}. Can't pay? agent.chat locks until you do; local models keep working.</p></div>`;
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
      <div class="yw-pick" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="${stars >= i ? 'on' : ''}" data-star="${i}" role="radio" aria-checked="${stars === i}" aria-label="${i} star${i > 1 ? 's' : ''}"></button>`).join('')}<span>${stars ? `${stars} of 5` : 'Pick a rating'}</span></div>
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
    <p class="em-fine">Paid in DOLR via Satchel. All sales final.</p>
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
  if (store.ui.confirm) {
    const c = store.ui.confirm;
    return osWindow('Confirm', 'ov-small ov-confirm', `<p>${esc(c.text)}</p><div class="ov-actions"><button class="btn" data-ov="confirm-no">Cancel</button><button class="btn primary" data-ov="confirm-yes">${esc(c.yes)}</button></div>`, 'confirm-no');
  }
  if (store.ui.intro) {
    return osWindow('Welcome', 'ov-intro', `<p class="ov-eyebrow">Week one</p><h1 class="ov-title">Unknown Agent</h1>
      <p>You've just been automated out of a job. You have ${fmtMoney(s.values.crypto)}, a laptop, a handful of bookmarks, and agent — an AI chatbot that bills your wallet for every word.</p>
      <p>Rent is ${fmtMoney(RENT[7])}, due at the end of ${dateFull(7)}. Don't go broke.</p>
      <ul class="ov-rules">
        <li>Every agent prompt costs money. Vague prompts get vague builds.</li>
        <li>Read Y for leads. Check Qmail. Ship on Forkyard — and check what it ships.</li>
        <li>Anything you can do yourself, do yourself. Your time is free now.</li>
      </ul>
      <div class="ov-actions"><button class="btn primary" data-ov="start">${s.values.day > 1 || s.chat.length > 1 ? `Continue · ${dateMedium(s.values.day)}` : 'Open the laptop'}</button></div>`, 'start');
  }
  if (s.morning) {
    const m = s.morning;
    return osWindow('Overnight summary', 'ov-small ov-morning', `<p class="ov-eyebrow">You slept. The bills didn't.</p><h2>${dateFull(m.day)}</h2>
      <table class="ov-lines">${m.lines.map(([l, v]) => (v == null ? `<tr class="note"><td colspan="2">${esc(l)}</td></tr>` : `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</td></tr>`)).join('')}
      <tr class="tot"><td>Balance</td><td>${fmtMoney(m.balance)}</td></tr></table>
      <div class="ov-actions"><button class="btn primary" data-ov="morning">Get up</button></div>`, 'morning');
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
    <div class="dv-row"><button data-dev="money">+$100</button><button data-dev="followers">+50 followers</button><button data-act="devedit" class="${store.ui.devEdit ? 'on' : ''}">Flags and meters…</button></div>
    <form class="dv-row" data-form="dev-day"><label>Go to day <input id="dev-day" type="number" min="1" max="${LAST_DAY}" value="${Math.min(LAST_DAY, m.day + 1)}"></label><button type="submit">Go</button><span class="dv-dim">skips the nights: no payday, rent or bills</span></form>
    <p><b>Flags</b> <code>${esc(s.flags.join(', ') || 'none')}</code></p>
    <p><b>Apps</b> <code>${esc(s.apps.map((a) => `${a.name}:${appWorking(a) ? 'ok' : a.deployed ? 'check' : 'undeployed'}`).join(' · ') || 'none')}</code></p>
    <p><b>Jev</b> ${esc(JEV.mode)}${JEV.reason ? ' · ' + esc(JEV.reason) : ''}</p>
    <p><b>Misses</b> ${esc(MISSES.settings.misses)}${MISSES.settings.misses === 'haiku' ? ' · ' + esc(MISSES.settings.haikuVia) : ''}</p>`;
}
