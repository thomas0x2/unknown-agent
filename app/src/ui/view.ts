/*
 * The view layer: renders the whole browser (window chrome, viewport, taskbar, overlay) as an HTML
 * string from the store, reusing the original markup and CSS. App.tsx sets it as innerHTML and wires
 * event delegation. Same architecture as the original game, driven by the new engine.
 */
import type { GameStore } from '../game/store';
import { ICONS, Y_ICONS } from './icons';
import { route, bookmarks, type Route, type SiteId } from '../sites/registry';
import {
  type GameState, type AppInstance, getApp, appWorking, agentCost, RENT, LAST_DAY,
} from '../engine';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WALLET_ADDR = '0x4417c3e8b1d05f2a9e6d7b0c1f83a4e5d2b9a9f2';
const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function fmtMoney(n: number) { return (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtCoin(n: number) { return `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DOLR`; }
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
const br = (t: string) => t.replace(/\n/g, '<br>');
const tpl = (t: string) => String(t ?? '').replace(/\{\{\s*playerName\s*\}\}/g, 'you').replace(/\{\{\s*\w+\s*\}\}/g, '');

function linkify(escaped: string): string {
  // link app URLs and @mentions; leave plain text otherwise
  return escaped
    .replace(/([a-z0-9-]+\.forkyard\.app)/g, '<a href="#" class="y-link" data-nav="$1">$1</a>')
    .replace(/(^|[^\w.])@([a-z0-9_]+)/gi, '$1<a href="#" class="y-at" data-nav="y.com/$2">@$2</a>');
}

function tabTitle(r: Route, url: string): string {
  const names: Partial<Record<string, string>> = { newtab: 'New Tab', y: 'Home / Y', qmail: 'Qmail', satchel: 'Satchel · Wallet', forkyard: 'Forkyard', agent: 'agent' };
  if (r.site === 'notfound') return url || 'New Tab';
  return names[r.site] ?? r.def?.label ?? url;
}

// ── chrome ──
export function renderApp(store: GameStore): string {
  const s = store.state;
  const r = route(store.url, s);
  const tabs = store.tabs.map((t) => {
    const rr = route(t.url, s);
    const ico = ICONS[rr.site] || ICONS.newtab;
    return `<div class="tab${t.id === store.active ? ' on' : ''}" data-tab="${t.id}" role="tab" tabindex="0">
      <span class="tab-ico ico-${rr.site}">${ico}</span><span class="tab-title">${esc(tabTitle(rr, t.url))}</span>
      <button class="tab-x" data-close="${t.id}" aria-label="Close tab">×</button></div>`;
  }).join('');

  const addr = r.site === 'newtab' ? '' : store.url;
  const bms = bookmarks(s).map((b) => {
    const badge = b.id === 'qmail' ? qmailBadge(s) : 0;
    return `<button class="bm" data-nav="${b.base}"><span class="bm-ico ico-${b.id}">${ICONS[b.id] || ICONS.newtab}</span><span class="bm-label">${esc(b.label)}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
  }).join('');

  return `<div class="desk"><div class="window" role="application" aria-label="Browser">
      <div class="tabstrip" id="tabs" role="tablist">${tabs}<button class="tab-new" data-newtab aria-label="New tab">+</button></div>
      <form class="toolbar" data-form="url">
        <span class="tb-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <label class="addr">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3h1v10H6V11h1zm2 0h6V8a3 3 0 0 0-6 0v3z" fill="currentColor"/></svg>
          <input id="address" autocomplete="off" spellcheck="false" aria-label="Address" value="${esc(addr)}">
        </label>
      </form>
      <nav class="bookmarks" aria-label="Bookmarks">${bms}</nav>
      <div class="viewport" id="viewport" data-site="${r.reachable ? r.site : 'error'}">${page(store, r)}</div>
    </div></div>
    <footer class="taskbar">
      <div class="tk-note" title="Objective"><span class="tk-pin" aria-hidden="true"></span><span id="objective">${esc(objective(s))}</span></div>
      <div class="tk-right">
        <span class="tk-rent${rentLow(s) ? ' neg' : ''}">${esc(rentLine(s))}</span>
        <span class="tk-wallet${s.values.crypto < 20 ? ' neg' : ''}" title="Balance">${fmtMoney(s.values.crypto)}</span>
        <span class="tk-clock"><b>${weekday(s.values.day)} · Day ${s.values.day}</b><span>of ${LAST_DAY}</span></span>
        <button class="tk-btn" data-act="endday"${s.ending ? ' disabled' : ''} title="End the day">End day</button>
        <button class="tk-btn ghost" data-act="new" title="New game">New</button>
        <button class="tk-btn ghost" data-act="dev" title="Debugger">jev</button>
      </div>
    </footer>
    ${store.ui.dev ? devPanel(s) : ''}
    ${s.ending ? overlay(s) : ''}`;
}

function qmailBadge(s: GameState): number {
  return s.delivered.filter((d) => d.site === 'qmail' && !d.answered).length;
}
function objective(s: GameState): string {
  if (s.ending) return 'Chapter over.';
  const rentDay = Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= s.values.day);
  if (rentDay) return `Make rent: ${RENT[rentDay]} DOLR by the end of Day ${rentDay}.`;
  return 'Keep the lights on.';
}
function rentLine(s: GameState): string {
  const rentDay = Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= s.values.day);
  if (!rentDay) return 'Rent clear';
  const left = rentDay - s.values.day;
  return `Rent ${fmtMoney(RENT[rentDay])} ${left === 0 ? 'tonight' : `in ${left}d`}`;
}
function rentLow(s: GameState): boolean {
  const rentDay = Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= s.values.day);
  return !!rentDay && s.values.crypto < RENT[rentDay];
}

const ENDINGS: Record<string, string> = {
  outbreak: 'Outbreak', botnet: 'Botnet', account_terminated: 'Account Terminated', loose_end: 'Loose End',
  raided: 'Raided', evicted: 'Evicted', the_regime: 'The Regime', open_weights: 'Open Weights',
  got_away: 'Got Away With It', clean_modest: 'Clean but Modest',
};
function overlay(s: GameState): string {
  return `<div id="overlay"><div class="ov-card ov-over">
    <p class="ov-eyebrow">The end</p>
    <h1 class="ov-title">${esc(ENDINGS[s.ending!] ?? s.ending)}</h1>
    <p>Day ${s.values.day}. The run is over.</p>
    <div class="ov-actions"><button class="btn primary" data-act="new">Play again</button></div>
  </div></div>`;
}

function devPanel(s: GameState): string {
  const m = s.values;
  const meters = `leash ${m.leash} · misuse ${m.misuseScore} · suspicion ${m.suspicion} · null ${m.nullStanding} · mafia ${m.mafiaStanding} · family ${m.familyTrust}`;
  return `<aside id="dev"><header><b>jev · dev</b><button data-act="dev">×</button></header>
    <p><b>Day</b> ${m.day} · <b>Agent</b> L${m.agentLevel} · <b>Followers</b> ${m.followers}</p>
    <p><b>Meters</b> <span class="dv-dim">${esc(meters)}</span></p>
    <p><b>Flags</b> <code>${esc(s.flags.join(', ') || 'none')}</code></p>
    <p><b>Apps</b> <code>${esc(s.apps.map((a) => `${a.name}:${appWorking(a) ? 'ok' : a.deployed ? 'check' : 'undeployed'}`).join(' · ') || 'none')}</code></p>
  </aside>`;
}

// ── page dispatch ──
function page(store: GameStore, r: Route): string {
  if (!r.reachable) return pageError(store.url, r.site);
  switch (r.site) {
    case 'newtab': return pageNewTab(store);
    case 'qmail': return pageMail(store, r.param);
    case 'y': return pageY(store, r.param);
    case 'satchel': return pageWallet(store);
    case 'forkyard': return pageForkyard(store, r.param);
    case 'app': return pageApp(store, r.param);
    case 'agent': return pageAgent(store);
    default: return pageUnderground(r.def?.label ?? r.site);
  }
}

function pageError(url: string, site: SiteId): string {
  if (site === 'notfound' || !url) {
    return `<div class="err"><h1>This site can't be reached</h1><p><code>${esc(url)}</code> didn't respond.</p><p class="err-sub">Try the bookmarks. They are the only sites you can afford.</p></div>`;
  }
  return `<div class="err"><h1>Not reachable yet</h1><p>You haven't discovered <code>${esc(url)}</code>.</p></div>`;
}

function pageNewTab(store: GameStore): string {
  const s = store.state;
  const tiles = bookmarks(s).map((b) => `<button class="nt-tile nt-${b.id}" data-nav="${b.base}"><span class="nt-ico">${ICONS[b.id] || ICONS.newtab}</span><span>${esc(b.label)}</span></button>`).join('');
  return `<div class="newtab">
    <p class="nt-time">${weekday(s.values.day)} · Day ${s.values.day}</p>
    <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
    <div class="nt-tiles">${tiles}</div>
  </div>`;
}

// ── Qmail ──
function pageMail(store: GameStore, param?: string): string {
  const s = store.state;
  const view = param === 'sent' ? 'sent' : param === 'compose' ? 'compose' : param?.startsWith('m/') ? 'msg' : 'inbox';
  const unread = qmailBadge(s);
  const side = `<nav class="qm-side" aria-label="Folders">
    <a href="#" class="qm-new" data-nav="qmail.com/compose">Compose</a>
    <a href="#" data-nav="qmail.com" class="${view === 'inbox' ? 'on' : ''}">Inbox${unread ? `<b>${unread}</b>` : ''}</a>
    <a href="#" data-nav="qmail.com/sent" class="${view === 'sent' ? 'on' : ''}">Sent</a>
  </nav>`;

  const ev = (id: string) => store.content.events.find((e) => e.id === id);
  let main: string;
  if (view === 'compose') {
    const d = store.ui.draft || { to: '', subject: '', body: '' };
    const waiting = s.sentToday.includes(String(d.to).trim().toLowerCase());
    main = `<form class="qm-compose" data-form="mail">
      <h1 class="qm-h">New message</h1>
      <label class="qm-field"><span>To</span><input id="mail-to" autocomplete="off" spellcheck="false" value="${esc(d.to)}" placeholder="name@example.com"></label>
      <label class="qm-field"><span>Subject</span><input id="mail-subject" autocomplete="off" value="${esc(d.subject)}"></label>
      <textarea id="mail-body" rows="10" aria-label="Message">${esc(d.body)}</textarea>
      <p class="qm-wait" id="mail-wait"${waiting ? '' : ' hidden'}>You already wrote to this address today. Wait for a reply or for tomorrow.</p>
      <div class="qm-actions"><button class="qm-btn" type="submit"${waiting ? ' disabled' : ''}>Send</button><button class="qm-btn ghost" type="button" data-mail-discard>Discard</button><span class="qm-hint">Free, one message per person per day.</span></div>
    </form>`;
  } else if (view === 'msg') {
    const id = param!.slice(2);
    const d = s.delivered.find((x) => x.eventId === id && x.site === 'qmail');
    const e = ev(id);
    if (!d || !e) main = `<p class="qm-empty">This message doesn't exist.</p>`;
    else {
      const canReply = !!e.outcomes && !d.answered;
      main = `<article class="qm-read">
        <p class="qm-crumbs"><a href="#" data-nav="qmail.com">Inbox</a></p>
        <h1 class="qm-h">${esc(e.subject ?? '(no subject)')}</h1>
        <p class="qm-meta"><span><b>${esc(e.from ?? 'Unknown')}</b> &lt;${esc(e.addr ?? '')}&gt;</span><span>Day ${d.day}</span></p>
        <div class="qm-body">${br(linkify(esc(tpl(e.body ?? ''))))}</div>
        ${canReply ? `<form class="qm-replybox" data-form="reply" data-id="${esc(id)}"><textarea id="reply-body" rows="4" placeholder="Write your reply…"></textarea><div class="qm-actions"><button class="qm-btn" type="submit">Send reply</button><span class="qm-hint">One message per person until they reply.</span></div></form>` : d.answered ? `<p class="qm-hint">Answered.</p>` : ''}
      </article>`;
    }
  } else if (view === 'sent') {
    main = `<h1 class="qm-h">Sent</h1><p class="qm-empty">Your sent mail isn't kept here.</p>`;
  } else {
    const rows = s.delivered.filter((d) => d.site === 'qmail').slice().reverse().map((d) => {
      const e = ev(d.eventId);
      if (!e) return '';
      const unreadRow = e.outcomes && !d.answered;
      const snippet = tpl(e.body || '').replace(/\s+/g, ' ').slice(0, 90);
      return `<a href="#" class="qm-row${unreadRow ? ' unread' : ''}" data-nav="qmail.com/m/${esc(d.eventId)}">
        <span class="qm-from">${esc(e.from ?? 'Unknown')}</span>
        <span class="qm-subj"><b>${esc(e.subject ?? '')}</b> <span>${esc(snippet)}</span></span>
        <span class="qm-time">${unreadRow ? '<span class="qm-pill">needs reply</span>' : ''}Day ${d.day}</span>
      </a>`;
    }).join('');
    main = `<h1 class="qm-h">Inbox</h1>${rows ? `<div class="qm-list">${rows}</div>` : `<p class="qm-empty">No mail.</p>`}`;
  }
  return `<div class="qm">
    <header class="qm-top"><div class="qm-logo">${ICONS.mail}<span>Qmail</span></div><span class="qm-user">you@qmail.com</span></header>
    <div class="qm-wrap">${side}<main class="qm-main">${main}</main></div>
  </div>`;
}

// ── Y ──
interface YPost { id: string; author: string; handle: string; text: string; day: number; likes: number; verified?: boolean; mine?: boolean; delta?: number; }
function yPosts(store: GameStore): YPost[] {
  const s = store.state;
  const out: YPost[] = [];
  for (const d of s.delivered.filter((x) => x.site === 'y')) {
    const e = store.content.events.find((x) => x.id === d.eventId);
    if (!e) continue;
    out.push({ id: e.id, author: e.from ?? 'someone', handle: handleFrom(e.from ?? 'someone'), text: tpl(e.body ?? ''), day: d.day, likes: 20 + hashHue(e.id) % 400 });
  }
  for (const u of s.userPosts) out.push({ id: u.id, author: 'You', handle: 'you', text: u.text, day: u.day, likes: u.likes, mine: true, delta: u.delta });
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
      ${p.mine && p.delta != null ? `<span class="y-delta ${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}">${p.delta > 0 ? '+' : p.delta < 0 ? '−' : '±'}${Math.abs(p.delta)} followers</span>` : ''}
      <span class="y-act views">${Y_ICONS.views}${compact(Math.max(12, likes * 37 + 9))}</span>
    </footer>
  </article>`;
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
    <form class="y-compose" data-form="ypost">
      ${avatar('You', 'you')}
      <div><textarea id="post-input" rows="2" maxlength="280" placeholder="Say something to the timeline"></textarea>
      <div class="y-compose-row"><span class="y-hint">280 chars · free</span><button class="y-btn" type="submit">Post</button></div></div>
    </form>
    <p class="y-eyebrow"><i class="y-live"></i>${q ? 'Search' : 'Timeline · live'}</p>
    <div class="y-feed">${feed}</div>`;
  return `<div class="y">
    <header class="y-bar">
      <div class="y-brand"><span class="y-mark">${ICONS.y}</span></div>
      <nav class="y-pills"><a href="#" data-nav="y.com" class="${profile ? '' : 'on'}">Home</a><a href="#" data-nav="y.com/you" class="${profile === 'you' ? 'on' : ''}">Profile</a><span>Alerts</span><span>Inbox</span></nav>
      <span class="y-count"><b>${compact(s.values.followers)}</b> followers</span>
      <label class="y-search">${Y_ICONS.explore}<input id="y-search" autocomplete="off" placeholder="Search Y or @username" value="${esc(store.ui.ySearch)}"></label>
    </header>
    <div class="y-cols"><main class="y-main">${mainInner}</main>${side}</div>
  </div>`;
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

// ── Satchel ──
function txHash(x: { day: number; memo: string; amount: number }): string {
  let h = 2166136261;
  for (const c of `${x.day}|${x.memo}|${x.amount}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = (h.toString(16) + (h ^ 0x9e3779b9).toString(16)).padEnd(16, '0');
  return `0x${hex.slice(0, 4)}…${hex.slice(-4)}`;
}
function identicon(addr: string): string {
  const hue = parseInt(addr.slice(2, 6), 16) % 360;
  let cells = '';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    if (parseInt(addr[2 + y * 3 + x], 16) % 2) {
      cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      if (x < 2) cells += `<rect x="${4 - x}" y="${y}" width="1" height="1"/>`;
    }
  }
  return `<svg viewBox="0 0 5 5" class="wl-ident" aria-hidden="true" style="--h:${hue}"><g fill="hsl(${hue} 70% 62%)">${cells}</g></svg>`;
}
function sparkline(pts: number[]): string {
  const w = 320, h = 90, pad = 6;
  const lo = Math.min(0, ...pts), hi = Math.max(...pts, 1);
  const xs = (i: number) => pad + (i / Math.max(1, pts.length - 1)) * (w - pad * 2);
  const ys = (v: number) => h - pad - ((v - lo) / (hi - lo || 1)) * (h - pad * 2);
  const line = pts.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const last = pts.length - 1;
  return `<svg viewBox="0 0 ${w} ${h}" class="wl-spark" preserveAspectRatio="none" role="img">
    <line x1="${pad}" x2="${w - pad}" y1="${ys(0).toFixed(1)}" y2="${ys(0).toFixed(1)}" class="wl-zero"/>
    <polygon points="${xs(0).toFixed(1)},${h - pad} ${line} ${xs(last).toFixed(1)},${h - pad}" class="wl-area"/>
    <polyline points="${line}" class="wl-line"/>
    <circle cx="${xs(last).toFixed(1)}" cy="${ys(pts[last]).toFixed(1)}" r="3.5" class="wl-dot"/>
  </svg>`;
}
function pageWallet(store: GameStore): string {
  const s = store.state;
  const txs = s.tx.slice();
  const sorted = txs.slice().reverse();
  const todayDelta = Math.round(txs.filter((x) => x.day === s.values.day).reduce((n, x) => n + x.amount, 0) * 100) / 100;
  let bal = Math.round((s.values.crypto - txs.reduce((n, x) => n + x.amount, 0)) * 100) / 100;
  const pts = [bal]; for (const x of txs) { bal = Math.round((bal + x.amount) * 100) / 100; pts.push(bal); }
  const rows = sorted.map((x) => {
    const out = x.amount < 0;
    const [who, note] = x.memo.split(' · ');
    return `<li class="wl-tx">
      <span class="wl-dir ${out ? 'out' : 'in'}" aria-hidden="true">${out ? '↗' : '↙'}</span>
      <span class="wl-what"><b>${esc(who)}</b><small>${note ? esc(note) : out ? 'Transfer out' : 'Transfer in'}</small></span>
      <span class="wl-meta"><code>${txHash(x)}</code><small>Day ${x.day}</small></span>
      <span class="wl-amt ${out ? 'neg' : 'pos'}">${out ? '' : '+'}${fmtCoin(x.amount)}<small class="wl-ok">Confirmed</small></span>
    </li>`;
  }).join('');
  const income = s.apps.filter(appWorking).reduce((n, a) => n + (a.kind === 'client' ? a.payPerDay : Math.round((a.users ?? 0) * 0.3)), 0);
  const sub = agentCost(s.values.agentLevel).sub;
  const nightly = Math.round((income - sub) * 100) / 100;
  const rentDay = Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= s.values.day);
  const rentLineHtml = rentDay ? `<div class="wl-up"><span>Rent · Landlord</span><b class="neg">${fmtCoin(-RENT[rentDay])}</b><small>${rentDay === s.values.day ? 'Executes tonight' : `End of Day ${rentDay} · T−${rentDay - s.values.day}d`}</small></div>` : '';
  const action = (id: string, icon: string, label: string) => `<button class="wl-action" data-wallet="${id}"><span>${icon}</span>${label}</button>`;
  return `<div class="wl">
    <header class="wl-top">
      <div class="wl-logo"><span class="wl-logo-tile">${ICONS.wallet}</span><span>Satchel</span></div>
      <span class="wl-net"><i></i>Mainnet · 14 gwei</span>
      <span class="wl-acct">${identicon(WALLET_ADDR)}<code>${shortAddr(WALLET_ADDR)}</code><button class="wl-copy" data-copy-addr aria-label="Copy address">Copy</button></span>
    </header>
    <div class="wl-wrap">
      <section class="wl-hero">
        <div class="wl-hero-top">
          <div>
            <p class="wl-label">Total balance</p>
            <p class="wl-balance ${s.values.crypto < 0 ? 'neg' : ''}">${fmtMoney(s.values.crypto)}</p>
            <p class="wl-sub">${fmtCoin(s.values.crypto)} <span class="${todayDelta < 0 ? 'neg' : 'pos'}">${todayDelta >= 0 ? '+' : ''}${fmtMoney(todayDelta)} today</span></p>
          </div>
          ${sparkline(pts.slice(-40))}
        </div>
        <div class="wl-actions">${action('receive', '↙', 'Receive')}${action('send', '↗', 'Send')}${action('swap', '⇄', 'Swap')}${action('buy', '+', 'Buy')}</div>
      </section>
      <section class="wl-panel wl-auto">
        <h2>Scheduled</h2>
        ${rentLineHtml}
        <div class="wl-up"><span>Nightly</span><b class="${nightly < 0 ? 'neg' : 'pos'}">${nightly >= 0 ? '+' : ''}${fmtCoin(nightly)}</b><small>Agent subscription ${fmtCoin(-sub)}${income ? ` · App income +${fmtCoin(income)}` : ''}</small></div>
      </section>
      <section class="wl-panel wl-activity">
        <h2>Activity <span>${txs.length} transactions</span></h2>
        <ul class="wl-list">${rows || '<li class="wl-tx"><span class="wl-what"><b>No activity yet</b></span></li>'}</ul>
      </section>
    </div>
  </div>`;
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
            ? `<dl><dt>Status</dt><dd>${appWorking(a) ? 'working' : 'check it'}</dd>${stale ? '<dt>Repo</dt><dd>new commit — redeploy</dd>' : ''}</dl><div class="fy-row"><button class="fy-btn" data-deploy="${esc(a.id)}">Redeploy</button><button class="fy-btn ghost" data-takedown="${esc(a.id)}">Take down</button></div>`
            : `<p class="fy-note">Nothing is live until you deploy.</p><button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}
        </div>
      </div>
    </div></div>`;
  }
  const list = s.apps.length
    ? s.apps.slice().reverse().map((a) => `<article class="fy-repo">
        <div><a href="#" data-nav="forkyard.com/${a.id}" class="fy-name">${esc(a.id)}</a><p>${esc(a.name)}</p>
        <small><i class="fy-lang" style="--h:${hashHue(a.template)}"></i>${esc(a.template)} · ${a.kind}</small></div>
        <div class="fy-repo-act">${repoStatus(a)}${a.deployed ? '' : `<button class="fy-btn" data-deploy="${esc(a.id)}">Deploy</button>`}</div>
      </article>`).join('')
    : `<div class="fy-empty"><p><b>No repositories yet.</b></p><p>Brief the agent to build something.</p></div>`;
  return `<div class="fy">${head}<div class="fy-wrap"><h1 class="fy-h">Repositories <span>${s.apps.length}</span></h1>${list}</div></div>`;
}

function pageApp(store: GameStore, appId?: string): string {
  const s = store.state;
  const a = appId ? getApp(s, appId) : undefined;
  if (!a || !a.deployed) return `<div class="err"><h1>404: NOT_FOUND</h1><p>Nothing is deployed here.</p></div>`;
  const feats = a.features.length ? a.features.map((f) => `<div class="pv-feat"><b>${esc(f.id)}</b><span class="${f.correct ? 'ok' : 'bad'}">${f.correct ? 'looks right' : 'looks wrong'}</span>${a.breaks.filter((b) => b.featureId === f.id).map((b) => `<em>break: ${esc(b.failure)}</em>`).join('')}</div>`).join('') : '<p>Blank page — nothing was built here.</p>';
  return `<div class="pv-host"><div class="pv pv-generic"><h1>${esc(a.name)}</h1><p class="pv-sub">${esc(a.url)}</p>${feats}<p class="pv-note">Compare this against the client's spec in Qmail.</p></div></div>`;
}

// ── agent chat ──
function pageAgent(store: GameStore): string {
  const s = store.state;
  const projects = s.apps.filter((a) => !a.churned);
  const cur = store.ui.project && projects.some((p) => p.id === store.ui.project) ? store.ui.project : projects[projects.length - 1]?.id ?? '';
  const c = agentCost(s.values.agentLevel);
  const msgs = s.chat.map((m) => {
    if (m.from === 'you') return `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div><span class="ua-cost">${m.cost ? fmtMoney(-m.cost) + ' · ' : ''}agent L${s.values.agentLevel} · Day ${m.day}</span></div>`;
    if (m.from === 'system') return `<div class="ua-sys">${esc(m.text)}</div>`;
    const src = m.src ? `<span class="ua-src ${esc(m.src)}">${esc(m.src)}</span>` : '';
    return `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text">${br(esc(m.text))}</div>${src}</div>`;
  }).join('');
  const picker = projects.length
    ? `<label class="ua-model-pick"><span class="sr-only">Project</span><select id="project-pick">${projects.map((p) => `<option value="${p.id}" ${p.id === cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>`
    : '<span class="ua-est">No project yet — take a gig in Qmail.</span>';
  return `<div class="ua">
    <header class="ua-head">
      <div class="ua-brand">${ICONS.agent}<div><b>agent</b><span>agent-${s.values.agentLevel} · ${fmtMoney(c.prompt)} per prompt + ${fmtMoney(c.word)} per word</span></div></div>
      <span class="ua-linked">${s.agentLocked ? 'LOCKED · unpaid' : 'Billing: Satchel ' + shortAddr(WALLET_ADDR)}</span>
    </header>
    <div class="ua-log" id="ua-log">${msgs}</div>
    <form class="ua-compose" data-form="prompt">
      <textarea id="prompt-input" rows="2" placeholder="Tell agent what to build or fix" ${s.ending ? 'disabled' : ''}></textarea>
      <div class="ua-row">${picker}<span class="ua-est"></span><button class="ua-send" type="submit" ${s.ending ? 'disabled' : ''}>Send</button></div>
    </form>
  </div>`;
}

function pageUnderground(label: string): string {
  return `<div class="newtab"><p class="nt-time">${esc(label)}</p><p class="dv-dim" style="font-family:var(--f-mono)">This site is reachable, but its interface isn't wired yet.</p></div>`;
}
