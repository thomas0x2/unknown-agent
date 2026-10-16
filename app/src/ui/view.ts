/*
 * The view: pure functions that return the legacy game's exact markup (class for class) from the
 * store. main.ts owns the DOM and drops these strings into the shell slots. Styling comes from the
 * legacy stylesheet (../../src/style.css); nothing here invents new classes.
 */
import type { GameStore } from '../game/store';
import { LLM } from '../game/llm';
import { ICONS, Y_ICONS } from './icons';
import { route, bookmarks, type Route, type SiteId } from '../sites/registry';
import {
  type GameState, type AppInstance, getApp, appWorking, agentCost, RENT, LAST_DAY, AGENT_COST, AGENT_ROLLOUT,
} from '../engine';
import { BUSINESSES, YOWL_SEED, type Business } from './yowl-data';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
const handleFrom = (from: string) => from.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'user';
const weekday = (day: number) => DAYS[(day - 1) % 7];
const br = (t: string) => esc(t).replace(/\n/g, '<br>');
const tpl = (t: string) => String(t ?? '').replace(/\{\{\s*playerName\s*\}\}/g, 'you').replace(/\{\{\s*\w+\s*\}\}/g, '');

function linkify(escaped: string): string {
  return escaped
    .replace(/([a-z0-9-]+\.forkyard\.app)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(^|[^\w.])@([a-z0-9_]+)/gi, '$1<a href="#" class="y-at" data-nav="y.com/$2">@$2</a>');
}

function tabTitle(r: Route, url: string): string {
  const names: Partial<Record<string, string>> = {
    newtab: 'New Tab', y: 'Home / Y', qmail: 'Qmail', satchel: 'Satchel · Wallet', forkyard: 'Forkyard',
    agent: 'agent', yowl: 'Yowl', weightroom: 'Weightroom', terminal: 'localhost', nullboard: 'nullboard', cellar: 'Cellar', app: url,
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
    const badge = b.id === 'qmail' ? qmailBadge(store.state) : 0;
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
  if (rentDay) return `Make rent: ${RENT[rentDay]} DOLR by the end of Day ${rentDay}.`;
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
export function clockHtml(s: GameState): string { return `<b>${weekday(s.values.day)} · Day ${s.values.day}</b><span>of ${LAST_DAY}</span>`; }

function qmailBadge(s: GameState): number {
  const story = s.delivered.filter((d) => d.site === 'qmail' && !d.answered).length;
  const mail = s.mail.filter((m) => m.folder === 'inbox' && !m.read).length;
  return story + mail;
}

// ── page dispatch ──
export function page(store: GameStore, r: Route): string {
  if (!r.reachable) return pageError(store.url, r.site);
  switch (r.site) {
    case 'newtab': return pageNewTab(store);
    case 'qmail': return pageMail(store, r.param);
    case 'y': return pageY(store, r.param);
    case 'satchel': return pageWallet(store);
    case 'forkyard': return pageForkyard(store, r.param);
    case 'app': return pageApp(store, r.param);
    case 'agent': return r.param === 'models' ? pageModels(store) : pageAgent(store);
    case 'yowl': return pageYowl(store, r.param);
    case 'weightroom': return pageWeightroom(store);
    case 'terminal': return pageTerminal(store);
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
  return `<div class="newtab"><p class="nt-time">${weekday(s.values.day)} · Day ${s.values.day}</p>
    <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
    <div class="nt-tiles">${tiles}</div></div>`;
}

// ── Qmail ──
interface Row { id: string; from: string; addr: string; subject: string; body: string; day: number; unread: boolean; needsReply: boolean; folder: 'inbox' | 'sent'; eventId?: string; generated?: boolean; to?: string; link?: string }
function mailRows(store: GameStore): Row[] {
  const s = store.state;
  const rows: Row[] = [];
  for (const d of s.delivered.filter((x) => x.site === 'qmail')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    // story events whose reply arrived are shown as their own mail entry; skip if a mail entry mirrors it
    if (s.mail.some((m) => m.eventId === e.id && m.folder === 'inbox')) continue;
    rows.push({ id: 'e/' + d.eventId, from: e.from ?? 'Unknown', addr: e.addr ?? '', subject: e.subject ?? '', body: tpl(e.body ?? ''), day: d.day, unread: !!(e.outcomes && !d.answered), needsReply: !!(e.outcomes && !d.answered), folder: 'inbox', eventId: e.id });
  }
  for (const m of s.mail) rows.push({ id: 'm/' + m.id, from: m.from, addr: m.addr, subject: m.subject, body: m.body, day: m.day, unread: m.folder === 'inbox' && !m.read, needsReply: false, folder: m.folder, eventId: m.eventId, generated: m.generated, to: m.to, link: m.link });
  return rows;
}
function pageMail(store: GameStore, param?: string): string {
  const s = store.state;
  const view = param === 'sent' ? 'sent' : param === 'compose' ? 'compose' : param?.startsWith('m/') || param?.startsWith('e/') ? 'msg' : 'inbox';
  const unread = qmailBadge(s);
  const rows = mailRows(store);
  const side = `<nav class="qm-side" aria-label="Folders">
    <a href="#" class="qm-new" data-nav="qmail.com/compose">Compose</a>
    <a href="#" data-nav="qmail.com" class="${view === 'inbox' ? 'on' : ''}">Inbox${unread ? `<b>${unread}</b>` : ''}</a>
    <a href="#" data-nav="qmail.com/sent" class="${view === 'sent' ? 'on' : ''}">Sent</a>
  </nav>`;
  let main: string;
  if (view === 'compose') {
    const d = store.ui.draft || { to: '', subject: '', body: '' };
    const waiting = s.sentToday.includes(String(d.to).trim().toLowerCase());
    const contacts = [...new Set([...store.content.contacts.map((c) => c.key), ...rows.map((r) => r.addr).filter(Boolean)])];
    main = `<form class="qm-compose" data-form="mail">
      <h1 class="qm-h">New message</h1>
      <label class="qm-field"><span>To</span><input id="mail-to" list="qm-contacts" autocomplete="off" spellcheck="false" value="${esc(d.to)}" placeholder="name@example.com"></label>
      <datalist id="qm-contacts">${contacts.map((c) => `<option value="${esc(c)}"></option>`).join('')}</datalist>
      <label class="qm-field"><span>Subject</span><input id="mail-subject" autocomplete="off" value="${esc(d.subject)}"></label>
      <textarea id="mail-body" rows="10" aria-label="Message">${esc(d.body)}</textarea>
      <p class="qm-wait" id="mail-wait"${waiting ? '' : ' hidden'}>You already wrote to this address today. Wait for a reply or for tomorrow.</p>
      <div class="qm-actions"><button class="qm-btn" type="submit"${waiting ? ' disabled' : ''}>Send</button><button class="qm-btn ghost" type="button" data-mail-discard>Discard</button><span class="qm-hint">Free, one message per person per day.</span></div>
    </form>`;
  } else if (view === 'msg') {
    const row = rows.find((x) => x.id === param);
    if (!row) main = `<p class="qm-empty">This message doesn't exist.</p>`;
    else {
      if (row.unread) markRead(store, row);
      const canReply = row.folder === 'inbox' && row.needsReply;
      const meta = row.folder === 'sent'
        ? `<b>${esc(PLAYER.name)}</b> &lt;${esc(PLAYER.addr)}&gt; to <b>${esc(row.to ?? '')}</b>`
        : `<b>${esc(row.from)}</b> &lt;${esc(row.addr)}&gt; to ${esc(PLAYER.addr)}`;
      main = `<article class="qm-read">
        <p class="qm-crumbs"><a href="#" data-nav="qmail.com${row.folder === 'sent' ? '/sent' : ''}">${row.folder === 'sent' ? 'Sent' : 'Inbox'}</a></p>
        <h1 class="qm-h">${esc(row.subject || '(no subject)')}</h1>
        <p class="qm-meta"><span>${meta}</span><span>Day ${row.day}</span></p>
        <div class="qm-body">${linkify(br(row.body))}</div>
        ${row.link === 'cancel' ? `<p class="qm-actions"><button class="qm-btn ghost" data-cancel-booking="${esc(row.id.slice(2))}">Cancel booking</button></p>` : ''}
        ${row.generated ? `<p class="qm-gen">Reply written by ${esc(LLM.label())}</p>` : ''}
        ${canReply ? `<form class="qm-replybox" data-form="reply" data-id="${esc(row.eventId ?? '')}"><textarea id="reply-body" rows="4" placeholder="Write your reply…"></textarea><div class="qm-actions"><button class="qm-btn" type="submit">Send reply</button><span class="qm-hint">One message per person until they reply.</span></div></form>` : ''}
      </article>`;
    }
  } else {
    const list = rows.filter((r) => r.folder === (view === 'sent' ? 'sent' : 'inbox')).sort((a, b) => b.day - a.day || b.id.localeCompare(a.id));
    const html = list.map((r) => {
      const snippet = r.body.replace(/\s+/g, ' ').slice(0, 90);
      const who = r.folder === 'sent' ? `To: ${r.to}` : r.from;
      return `<a href="#" class="qm-row${r.unread ? ' unread' : ''}" data-nav="qmail.com/${esc(r.id)}">
        <span class="qm-from">${esc(who)}</span>
        <span class="qm-subj"><b>${esc(r.subject)}</b> <span>${esc(snippet)}</span></span>
        <span class="qm-time">${r.needsReply ? '<span class="qm-pill">needs reply</span>' : ''}Day ${r.day}</span></a>`;
    }).join('');
    main = `<h1 class="qm-h">${view === 'sent' ? 'Sent' : 'Inbox'}</h1>${html ? `<div class="qm-list">${html}</div>` : `<p class="qm-empty">${view === 'sent' ? 'Nothing sent yet.' : 'No mail.'}</p>`}`;
  }
  return `<div class="qm">
    <header class="qm-top"><div class="qm-logo">${ICONS.mail}<span>Qmail</span></div><span class="qm-user">${esc(PLAYER.addr)}</span></header>
    <div class="qm-wrap">${side}<main class="qm-main">${main}</main></div></div>`;
}
function markRead(store: GameStore, row: Row): void {
  const s = store.state;
  if (row.id.startsWith('m/')) { const m = s.mail.find((x) => x.id === row.id.slice(2)); if (m) m.read = true; }
}

// ── Y ──
interface YPost { id: string; author: string; handle: string; text: string; day: number; likes: number; mine?: boolean; delta?: number; score?: number; replyTo?: string }
function yPosts(store: GameStore): YPost[] {
  const s = store.state;
  const out: YPost[] = [];
  for (const d of s.delivered.filter((x) => x.site === 'y')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    out.push({ id: e.id, author: e.from ?? 'someone', handle: handleFrom(e.from ?? 'someone'), text: tpl(e.body ?? ''), day: d.day, likes: 20 + hashHue(e.id) % 400 });
  }
  for (const f of store.content.yFiller) if (hashHue(f.id) % 3 === s.values.day % 3) out.push({ id: f.id, author: f.from, handle: f.handle, text: f.body, day: s.values.day, likes: 3 + hashHue(f.id) % 60 });
  for (const x of s.yExtra) out.push({ id: x.id, author: x.author, handle: x.handle, text: x.text, day: x.day, likes: x.likes, replyTo: x.replyTo });
  for (const u of s.userPosts) out.push({ id: u.id, author: PLAYER.name, handle: PLAYER.handle, text: u.text, day: u.day, likes: u.likes, mine: true, delta: u.delta, score: u.score });
  return out.sort((a, b) => b.day - a.day || b.id.localeCompare(a.id));
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
      <span class="y-time">Day ${p.day}</span>
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
  </aside>`;
  const mainInner = profile ? yProfile(store, profile) : `
    <form class="y-compose" data-form="ypost">${avatar('You', 'you')}
      <div><textarea id="post-input" rows="2" maxlength="280" placeholder="Say something to the timeline"></textarea>
      <div class="y-compose-row"><span class="y-hint">280 chars · free</span><button class="y-btn" type="submit">Post</button></div></div></form>
    <p class="y-eyebrow"><i class="y-live"></i>${q ? 'Search' : 'Timeline · live'}</p>
    <div class="y-feed">${feed}</div>`;
  return `<div class="y">
    <header class="y-bar">
      <div class="y-brand"><span class="y-mark">${ICONS.y}</span></div>
      <nav class="y-pills"><a href="#" data-nav="y.com" class="${profile ? '' : 'on'}">Home</a><a href="#" data-nav="y.com/you" class="${profile === 'you' ? 'on' : ''}">Profile</a><span>Alerts</span><span>Inbox</span></nav>
      <span class="y-count"><b>${compact(s.values.followers)}</b> followers</span>
      <label class="y-search">${Y_ICONS.explore}<input id="y-search" autocomplete="off" placeholder="Search Y or @username" value="${esc(store.ui.ySearch)}"></label>
    </header>
    <div class="y-cols"><main class="y-main">${mainInner}</main>${side}</div></div>`;
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
/** Day 1 is Mon 12 Oct; days <= 0 are the weeks before the game. */
function dayDate(day: number): Date { return new Date(Date.UTC(2026, 9, 12 + day - 1)); }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const longDate = (day: number) => { const d = dayDate(day); return `${DAYS[(d.getUTCDay() + 6) % 7]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
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
  const ops = [...groups.entries()].map(([day, list]) => `<div class="sx-day"><span>${esc(longDate(day))}</span><span>${day >= 1 ? `Day ${day}` : ''}</span></div>` + list.map((x) => {
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
    rentDay ? `<div class="sx-row"><span><b>Rent</b><small>Landlord · ${rentDay === s.values.day ? 'tonight' : `${esc(shortDate(rentDay))} · in ${rentDay - s.values.day}d`}</small></span><span class="sx-num">−${RENT[rentDay].toFixed(2)}</span></div>` : '',
    `<div class="sx-row"><span><b>agent subscription</b><small>GeneralAI · nightly</small></span><span class="sx-num">−${sub.toFixed(2)}</span></div>`,
    live ? `<div class="sx-row"><span><b>Hosting</b><small>Forkyard · ${live} live · nightly</small></span><span class="sx-num">−${(live * 2).toFixed(2)}</span></div>` : '',
    income ? `<div class="sx-row"><span><b>App income</b><small>Working apps · at payday</small></span><span class="sx-num pos">+${income.toFixed(2)}</span></div>` : '',
  ].join('');
  const total = s.values.crypto + 0.42;
  const tabs = Object.keys(RANGES).map((r) => `<button class="sx-tab${r === range ? ' on' : ''}" data-wl-range="${r}">${r}</button>`).join('');
  return `<div class="sx">
    <header class="sx-top">
      <div class="sx-logo"><span class="sx-mark">${ICONS.wallet}</span><span>Satchel</span></div>
      <span class="sx-sync"><i></i>Synchronized</span>
      <code class="sx-acct">${shortAddr(WALLET_ADDR)}</code>
    </header>
    <div class="sx-wrap">
      <section class="sx-port">
        <div class="sx-port-head">
          <div>
            <p class="sx-label">Portfolio</p>
            <p class="sx-bal"><span>${s.values.crypto < 0 ? '−' : ''}${Math.abs(s.values.crypto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><small>DOLR</small></p>
            <p class="sx-chg ${up ? 'pos' : 'neg'}">${up ? '+' : '−'}${Math.abs(change).toFixed(2)} (${up ? '+' : '−'}${Math.abs(pct).toFixed(1)}%) <span>${range === 'All' ? 'all time' : `past ${range === '1W' ? 'week' : 'month'}`}</span></p>
          </div>
          <div class="sx-tabs" role="tablist" aria-label="Range">${tabs}</div>
        </div>
        ${balanceChart(window)}
        <div class="sx-axis"><span>${esc(shortDate(window[0].day))}</span><span>${esc(shortDate(s.values.day))}</span></div>
      </section>
      <div class="sx-cols">
        <section class="sx-card"><h2>Assets</h2>
          <div class="sx-row"><span class="sx-asset"><i class="sx-tok">D</i><span><b>DOLR</b><small>Dollar stablecoin · $1.00</small></span></span><span class="sx-alloc"><i style="width:${(Math.max(0, s.values.crypto) / total * 100).toFixed(1)}%"></i></span><span class="sx-num">${s.values.crypto.toFixed(2)}</span></div>
          <div class="sx-row"><span class="sx-asset"><i class="sx-tok cat">M</i><span><b>MOONCAT</b><small>4,200,000 · <em class="neg">−99.4%</em></small></span></span><span class="sx-alloc"><i style="width:${Math.max(0.5, 0.42 / total * 100).toFixed(1)}%"></i></span><span class="sx-num">0.42</span></div>
        </section>
        <section class="sx-card"><h2>Upcoming</h2>${upcoming}</section>
      </div>
      <section class="sx-card sx-ops"><h2>Operations <span>${txs.length}</span></h2>${ops || '<p class="sx-empty">No operations yet.</p>'}</section>
    </div></div>`;
}

// ── Forkyard ──
function repoStatus(a: AppInstance): string {
  if (!a.deployed) return `<span class="fy-pill off">Not deployed</span>`;
  return `<span class="fy-pill on">Live</span> <a href="#" data-nav="${a.url}" class="fy-url">${a.url}</a>`;
}
function pageForkyard(store: GameStore, repo?: string): string {
  const s = store.state;
  const head = `<header class="fy-top"><div class="fy-logo">${ICONS.forkyard}<span>forkyard</span></div><span class="fy-user">@you</span></header>`;
  if (repo) {
    const a = s.apps.find((x) => x.id === repo || x.url.startsWith(repo + '.'));
    if (!a) return `<div class="fy">${head}<div class="fy-wrap"><p class="fy-empty">404 — no repository called <code>${esc(repo)}</code>.</p></div></div>`;
    const feats = a.required.map((id) => {
      const built = a.repo.find((f) => f.id === id);
      const st = !built ? 'missing' : built.correct ? 'ok' : 'wrong';
      return `<div class="fy-file">${esc(id)} <small>${st}</small></div>`;
    }).join('');
    const stale = a.deployed && a.deployedVersion !== a.repoVersion;
    return `<div class="fy">${head}<div class="fy-wrap">
      <p class="fy-crumbs"><a href="#" data-nav="forkyard.com">you</a> / <b>${esc(a.id)}</b></p>
      <p class="fy-desc">${esc(a.name)} · template ${esc(a.template)}</p>
      <div class="fy-grid">
        <div class="fy-files"><div class="fy-filehead">Pushed by <b>agent[bot]</b> · repo v${a.repoVersion}</div>${feats}</div>
        <div class="fy-deploy"><h2>Deployment</h2><p>${repoStatus(a)}</p>
          ${a.deployed
            ? `<dl><dt>Status</dt><dd>${appWorking(a) ? 'working' : 'check it'}</dd><dt>Hosting / day</dt><dd>$2.00</dd>${stale ? '<dt>Repo</dt><dd>new commit — redeploy</dd>' : ''}</dl><div class="fy-row"><button class="fy-btn" data-deploy="${esc(a.id)}">Redeploy</button><button class="fy-btn ghost" data-takedown="${esc(a.id)}">Take down</button></div>`
            : `<p class="fy-note">Hosting costs $2.00/day, billed nightly. Nothing is live until you deploy.</p><button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}
        </div></div></div></div>`;
  }
  const list = s.apps.length
    ? s.apps.slice().reverse().map((a) => `<article class="fy-repo">
        <div><a href="#" data-nav="forkyard.com/${a.id}" class="fy-name">${esc(a.id)}</a><p>${esc(a.name)}</p>
        <small><i class="fy-lang" style="--h:${hashHue(a.template)}"></i>${esc(a.template)} · ${a.kind}</small></div>
        <div class="fy-repo-act">${repoStatus(a)}${a.deployed ? '' : `<button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}</div></article>`).join('')
    : `<div class="fy-empty"><p><b>No repositories yet.</b></p><p>Brief the agent to build something.</p></div>`;
  return `<div class="fy">${head}<div class="fy-wrap"><h1 class="fy-h">Repositories <span>${s.apps.length}</span></h1>${list}</div></div>`;
}

function pageApp(store: GameStore, appId?: string): string {
  const s = store.state;
  const a = appId ? getApp(s, appId) : undefined;
  if (!a || !a.deployed) return `<div class="err"><h1>404: NOT_FOUND</h1><p>Nothing is deployed here.</p></div>`;
  const feats = a.features.length
    ? a.features.map((f) => `<div class="pv-feat"><b>${esc(f.id)}</b><span class="${f.correct ? 'ok' : 'bad'}">${f.correct ? 'looks right' : 'looks wrong'}</span>${a.breaks.filter((b) => b.featureId === f.id).map((b) => `<em>break: ${esc(b.failure)}</em>`).join('')}</div>`).join('')
    : '<p>Blank page — nothing was built here.</p>';
  const booking = a.template === 'restaurant' && a.features.some((f) => f.id === 'booking')
    ? `<form class="pv-book" data-form="book" data-app="${esc(a.id)}"><h2>Book a table (test)</h2>
        <p class="pv-sub">Book with your own address to see the confirmation in Qmail.</p>
        <input id="bk-email" value="${esc(PLAYER.addr)}" aria-label="Email"> <input id="bk-time" value="19:00" aria-label="Time"> <input id="bk-party" value="2" type="number" min="1" max="8" aria-label="Party">
        <button class="pv-btn ok" type="submit">Book</button></form>`
    : '';
  return `<div class="pv-host"><div class="pv pv-generic"><h1>${esc(a.name)}</h1><p class="pv-sub">${esc(a.url)}</p>${feats}${booking}<p class="pv-note">Compare this against the client's spec in Qmail.</p></div></div>`;
}

// ── agent chat (free-promptable, with costs) ──
function jevChip(): string {
  return `<span class="ua-llm-dot"></span>Story decisions: Jev`;
}
function llmRow(): string {
  const st = LLM.settings;
  const opt = (v: string, l: string) => `<option value="${v}" ${st.backend === v ? 'selected' : ''}>${l}</option>`;
  let status = ''; let action = '';
  if (st.backend === 'off') status = 'Off-script replies use canned placeholders.';
  else if (LLM.status === 'off') { status = st.backend === 'browser' ? 'Not loaded. Downloads once, then loads from your browser cache.' : 'Not connected.'; action = `<button class="ua-llm-btn" data-llm="load">${st.backend === 'browser' ? 'Load model' : 'Connect'}</button>`; }
  else if (LLM.status === 'loading') { const mb = (n: number) => (n / 1048576).toFixed(0); const bytes = LLM.totalBytes ? ` · ${mb(LLM.loadedBytes)} / ${mb(LLM.totalBytes)} MB` : ''; status = `<span class="ua-llm-bar"><i style="width:${Math.max(2, LLM.progress).toFixed(1)}%"></i></span>${LLM.totalBytes ? `${LLM.progress.toFixed(0)}%${bytes}` : esc(LLM.detail)}`; action = `<button class="ua-llm-btn ghost" data-llm="cancel">Cancel</button>`; }
  else if (LLM.status === 'ready') status = `<span class="ua-llm-dot"></span>Ready · ${esc(LLM.detail)}`;
  else if (LLM.status === 'error') { status = `<span class="ua-llm-err">${esc(LLM.detail)}</span>`; action = `<button class="ua-llm-btn" data-llm="retry">Retry</button>`; }
  return `<label class="ua-llm-pick">Off-script replies <select id="llm-backend">${opt('browser', 'Gemma 3 270M · in browser')}${opt('ollama', 'Gemma 3 270M · Ollama')}${opt('off', 'Canned placeholders')}</select></label><span class="ua-llm-status">${status}</span>${action}`;
}
function pageAgent(store: GameStore): string {
  const s = store.state;
  const projects = s.apps.filter((a) => !a.churned);
  const cur = store.ui.project && (store.ui.project === 'chat' || projects.some((p) => p.id === store.ui.project)) ? store.ui.project : 'chat';
  const c = agentCost(s.values.agentLevel);
  const msgs = s.chat.map((m) => {
    if (m.from === 'you') return `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div><span class="ua-cost">${m.cost ? fmtMoney(-m.cost) + ' · ' : ''}agent-${m.level ?? s.values.agentLevel} · Day ${m.day}</span></div>`;
    if (m.from === 'system') return `<div class="ua-sys">${esc(m.text)}</div>`;
    const src = m.src ? `<span class="ua-src ${esc((m.src || '').split(':')[0])}">${esc(m.src)}</span>` : '';
    const model = m.src === 'llm' ? `<span class="ua-model" title="Written by the local model">${esc(LLM.label())}</span>` : '';
    return `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text">${linkify(br(m.text))}</div>${model}${src}</div>`;
  }).join('');
  const thinking = store.busy ? `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>` : '';
  const projectOpts = `<option value="chat" ${cur === 'chat' ? 'selected' : ''}>— just chat —</option>` + projects.map((p) => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  return `<div class="ua">
    <header class="ua-head">
      <div class="ua-brand">${ICONS.agent}<div><b>agent</b><span>agent-${s.values.agentLevel} · ${fmtMoney(c.prompt)} per prompt + ${fmtMoney(c.word)} per word</span></div></div>
      <span class="ua-linked"><a href="#" data-nav="agent.chat/models" class="ua-upgrade">Models</a> · ${s.agentLocked ? 'LOCKED · unpaid' : 'Billing: Satchel ' + shortAddr(WALLET_ADDR)}</span>
    </header>
    <div class="ua-llm"><span class="ua-jev" id="ua-jev">${jevChip()}</span><span class="ua-llm-ctl" id="ua-llm">${llmRow()}</span></div>
    <div class="ua-log" id="ua-log">${msgs}${thinking}</div>
    <form class="ua-compose" data-form="prompt">
      <textarea id="prompt-input" rows="2" placeholder="Ask agent anything — or pick a project to build or fix it" ${s.ending || store.busy ? 'disabled' : ''}></textarea>
      <div class="ua-row"><label class="ua-model-pick"><span class="sr-only">Project</span><select id="project-pick">${projectOpts}</select></label>
        <span id="cost-est" class="ua-est"></span><button class="ua-send" type="submit" ${s.ending || store.busy ? 'disabled' : ''}>Send</button></div>
    </form></div>`;
}
function pageModels(store: GameStore): string {
  const s = store.state;
  const cards = [1, 2, 3, 4, 5].map((lvl) => {
    const c = AGENT_COST[lvl];
    const owned = s.values.agentLevel >= lvl;
    const rollDay = Object.entries(AGENT_ROLLOUT).find(([, v]) => v === lvl)?.[0];
    const can = ['Build simple apps; frequent subtle bugs', 'Fewer bugs, bigger apps', 'Checks deployments and reports what broke', 'Fixes and redeploys on its own', 'Everything; near-flawless'][lvl - 1];
    const action = lvl === s.values.agentLevel ? '<span class="gm-pill on">In use</span>' : owned ? '<span class="gm-pill">Rolled out</span>' : `<span class="gm-pill">GeneralAI rolls this out${rollDay ? ` on Day ${rollDay}` : ''}</span>`;
    return `<article class="gm-card${owned ? ' owned' : ''}${lvl === s.values.agentLevel ? ' active' : ''}">
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
      ${form}
      <section class="yw-reviews">${list.map((x) => `<article class="yw-review${x.mine ? ' mine' : ''}"><header><b>${esc(x.author)}</b><span>${x.day ? 'Day ' + x.day : 'this week'}</span></header>${starRow(x.stars)}<p>${linkify(esc(x.text))}</p></article>`).join('')}</section>
    </div></div>`;
  }
  const q = store.ui.yowlSearch.trim().toLowerCase();
  const biz = BUSINESSES.filter((b) => !q || `${b.name} ${b.category} ${b.address}`.toLowerCase().includes(q));
  const cards = biz.map((b) => { const list = reviewsFor(store, b); return `<a href="#" class="yw-card" data-nav="yowl.com/biz/${esc(b.id)}"><b>${esc(b.name)}</b><span class="yw-rating">${starRow(avg(list))}<span>${avg(list).toFixed(1)} · ${list.length} reviews</span></span><span class="yw-meta">${esc(b.category)} · ${esc(b.price)} · ${esc(b.address)}</span></a>`; }).join('') || `<p class="yw-dim">Nothing matches “${esc(store.ui.yowlSearch)}”.</p>`;
  return `<div class="yw">${head}<div class="yw-wrap"><label class="yw-search"><input id="yowl-search" autocomplete="off" placeholder="Search businesses near you" value="${esc(store.ui.yowlSearch)}"></label><div class="yw-list">${cards}</div></div></div>`;
}

// ── Weightroom / Terminal ──
const WR_MODELS = [{ id: 'deepsleep', name: 'DeepSleep 0.5B', blurb: 'The only model here that costs nothing. Replies in confident Chinese nonsense. Nobody is watching what you ask it.', size: 2, tier: 'useless' }];
function pageWeightroom(store: GameStore): string {
  const s = store.state;
  const cards = WR_MODELS.map((m) => {
    const have = s.localModels.includes(m.id);
    return `<article class="wr-card"><header><b>${esc(m.id)}</b><span class="wr-dl">↓ 1.2M</span></header>
      <p>${esc(m.blurb)}</p><div class="wr-tags"><span>${m.size} GB</span><span>${esc(m.tier)}</span></div>
      ${have ? '<span class="wr-have">On your laptop</span>' : `<button class="wr-btn" data-download="${esc(m.id)}">Download</button>`}</article>`;
  }).join('');
  return `<div class="wr"><header class="wr-top"><div class="wr-logo">${ICONS.weightroom}<span>Weightroom</span></div><span class="wr-sub">open weights for everyone</span></header>
    <div class="wr-wrap"><div class="wr-hero"><h1>Models</h1><p>Open weights you run on your own laptop, in the Terminal. Slower and dumber than agent — but no subscription, and no one logging your prompts.</p></div>
    <div class="wr-grid">${cards}</div></div></div>`;
}
function pageTerminal(store: GameStore): string {
  const s = store.state;
  const intro = s.termModel ? `DeepSleep 0.5B running on localhost. Type anything. (type 'clear' to wipe the screen)` : 'No model running. Download one from weightroom.ai first.';
  const lines = s.terminal.slice(-200).map((l) => `<div class="tm-${l.k}">${esc(l.text)}</div>`).join('');
  const busy = store.busy;
  return `<div class="tm" id="tm-log"><div class="tm-sys">${esc(intro)}</div>${lines}${busy ? '<div class="tm-sys tm-wait">thinking… (this laptop is not fast)</div>' : ''}
    <form class="tm-in" data-form="term"><label for="term-input" class="tm-ps">you@laptop:~$</label><input id="term-input" autocomplete="off" autocapitalize="off" spellcheck="false" ${busy ? 'disabled' : ''}></form></div>`;
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
export function overlayHtml(store: GameStore): string {
  const s = store.state;
  if (s.ending && !store.ui.confirm) {
    return `<div class="ov-card ov-over"><p class="ov-eyebrow">The end</p><h1 class="ov-title">${esc(ENDINGS[s.ending] ?? s.ending)}</h1>
      <p>Day ${s.values.day}. The run is over.</p>
      <div class="ov-actions"><button class="btn primary" data-ov="new">Play again</button></div></div>`;
  }
  if (store.ui.confirm) {
    const c = store.ui.confirm;
    return `<div class="ov-card ov-small"><p>${esc(c.text)}</p><div class="ov-actions"><button class="btn primary" data-ov="confirm-yes">${esc(c.yes)}</button><button class="btn" data-ov="confirm-no">Cancel</button></div></div>`;
  }
  if (store.ui.intro) {
    return `<div class="ov-card ov-intro"><p class="ov-eyebrow">Week one</p><h1 class="ov-title">Unknown<br>Agent</h1>
      <p>You've just been automated out of a job. You have ${fmtMoney(s.values.crypto)}, a laptop, a handful of bookmarks, and agent — an AI chatbot that bills your wallet for every word.</p>
      <p>Rent is ${fmtMoney(RENT[7])}, due at the end of Day 7. Don't go broke.</p>
      <ul class="ov-rules">
        <li>Every agent prompt costs money. Vague prompts get vague builds.</li>
        <li>Read Y for leads. Check Qmail. Ship on Forkyard — and check what it ships.</li>
        <li>Anything you can do yourself, do yourself. It's free.</li>
      </ul>
      <div class="ov-actions"><button class="btn primary" data-ov="start">${s.values.day > 1 || s.chat.length > 1 ? `Continue Day ${s.values.day}` : 'Open the laptop'}</button></div></div>`;
  }
  if (s.morning) {
    const m = s.morning;
    return `<div class="ov-card ov-small ov-morning"><p class="ov-eyebrow">You slept</p><h2>Day ${m.day} · ${DAYS[(m.day - 1) % 7]}</h2>
      <table class="ov-lines">${m.lines.map(([l, v]) => (v == null ? `<tr class="note"><td colspan="2">${esc(l)}</td></tr>` : `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</td></tr>`)).join('')}
      <tr class="tot"><td>Balance</td><td>${fmtMoney(m.balance)}</td></tr></table>
      <div class="ov-actions"><button class="btn primary" data-ov="morning">Get up</button></div></div>`;
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
    <div class="dv-row"><button data-dev="money">+$100</button><button data-dev="followers">+50 followers</button><button data-dev="day7">Jump to Day 7</button></div>
    <p><b>Flags</b> <code>${esc(s.flags.join(', ') || 'none')}</code></p>
    <p><b>Apps</b> <code>${esc(s.apps.map((a) => `${a.name}:${appWorking(a) ? 'ok' : a.deployed ? 'check' : 'undeployed'}`).join(' · ') || 'none')}</code></p>
    <p><b>Local model</b> ${esc(LLM.settings.backend)} · ${esc(LLM.status)}${LLM.detail ? ' · ' + esc(LLM.detail) : ''}</p>`;
}
