/*
 * The browser chrome and desktop: tabs, bookmarks, address bar, clock, taskbar and the home menu.
 */
import { SOUND } from '../sound';
import { GameStore } from '../../game/store';
import { MISSES } from '../../game/misses';
import { JEV } from '../../game/backendJev';
import { API_KEYS, DIRECT } from '../../game/apiKeys';
import { listSlots, autoSlot } from '../../game/saves';
import { ICONS } from '../icons';
import { route, bookmarks } from '../../sites/registry';
import { type GameState, getApp, RENT, dateShort, dateLong, dateMedium, dateFull } from '../../engine';
import { siteIcon } from '../siteIcons';
import { appLogo } from '../appsite';
import { CLOCK } from '../../engine';
import { PLAYER, esc, fmtClock, fmtMoney, rentDayOf, tabTitle } from './common';
import { qmailBadge } from './qmail';

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
    const logo = (app && appLogo(app.template)) || siteIcon(rr.site, rr.param).logo;
    const n = !badged.has(rr.site) ? counts[rr.site] ?? 0 : 0;
    badged.add(rr.site);
    return `<div class="tab${t.id === store.active ? ' on' : ''}${t.pinned ? ' pinned' : ''}" data-tab="${t.id}" role="tab" aria-selected="${t.id === store.active}" tabindex="0">
      <span class="tab-ico ico-${logo ? 'applogo' : rr.site}">${logo || ICONS[rr.site] || ICONS.newtab}</span><span class="tab-title">${esc(tabTitle(rr, t.url))}</span>${n ? `<i class="badge" aria-label="${n} unread">${n > 99 ? '99+' : n}</i>` : ''}
      ${t.pinned ? '' : `<button class="tab-x" data-close="${t.id}" aria-label="Close tab">×</button>`}</div>`;
  }).join('') + `<button class="tab-new" data-newtab aria-label="New tab">+</button>`;
}

export function bookmarksHtml(store: GameStore): string {
  return bookmarks(store.state).map((b) =>
{
    // a site with its own coloured mark (Matchless) shows it; the rest use their glyph
    const logo = siteIcon(b.id).logo;
    return `<button class="bm" data-nav="${b.base}"><span class="bm-ico ico-${logo ? 'applogo' : b.id}">${logo || ICONS[b.id] || ICONS.newtab}</span><span class="bm-label">${esc(b.label)}</span></button>`;
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

export function rentLine(s: GameState): string {
  const rentDay = rentDayOf(s);
  if (!rentDay) return 'Rent clear';
  const left = rentDay - s.values.day;
  return `Rent ${fmtMoney(RENT[rentDay])} ${left === 0 ? 'due tonight' : `in ${left}d`}`;
}

export function rentLow(s: GameState): boolean { const d = rentDayOf(s); return !!d && s.values.crypto < RENT[d]; }

export function clockHtml(s: GameState): string {
  const near = s.clockMin >= CLOCK.sleep - 60; // the last hour before bedtime
  return `<b class="${near ? 'late' : ''}">${fmtClock(s.clockMin)}</b><span>${dateMedium(s.values.day)}</span>`;
}

// ── desktop: taskbar window entry + home menu ──
export function taskTitle(store: GameStore): string {
  const r = route(store.url, store.state);
  return `Browser — ${r.site === 'newtab' ? 'New tab' : store.url}`;
}

/** The window list: the browser and the Terminal. */
export function tasksHtml(store: GameStore): string {
  const { termOpen, termShown } = store.ui;
  const browser = `<button class="dk-task${termShown ? ' open' : ' on'}" data-task="browser" title="${esc(taskTitle(store))}" aria-label="Browser">${BROWSER_ICON}</button>`;
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
  const st = MISSES.settings;
  const sel = (cur: string, v: string, l: string) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${l}</option>`;
  const modeRow = `<label class="dm-slot dm-ai" title="Online asks Jev and Claude Haiku over the network; Offline decides everything on this machine with a keyword matcher and scripted replies, no keys needed">${MI.gear}<span><b>Mode</b><small>${st.net === 'offline' ? 'Offline: keyword matcher, scripted replies, no network' : 'Online: Jev decides, Haiku writes the misses'}</small></span>
    <span class="dm-slot-acts"><select id="llm-net">${sel(st.net, 'online', 'Online')}${sel(st.net, 'offline', 'Offline')}</select></span></label>`;
  // Offline: no proxy, no Jev dot, no Haiku; everything below is the keyword matcher and scripted lines
  if (st.net === 'offline') {
    return modeRow +
      `<div class="dm-slot dm-jev"><i class="dm-dot"></i><span><b>Story decisions: keyword matcher</b><small>Runs on this machine, no network</small></span></div>
      <div class="dm-slot dm-ai">${MI.chat}<span><b>Misses</b><small>Scripted lines only</small></span></div>`;
  }
  const jev = JEV.mode === 'online' ? ['', 'Story decisions: Jev', 'Online'] as const
    : JEV.mode === 'checking' ? [' off', 'Story decisions: checking Jev…', 'Asking the proxy'] as const
    : [' off', 'Story decisions: Jev offline', JEV.reason || "Nothing gets decided until it's back"] as const;
  let missNote = st.misses === 'haiku' ? 'Haiku answers in character' : 'Scripted lines only';
  let err = false;
  if (st.misses === 'haiku' && st.haikuVia === 'api' && JEV.haikuKey === false) { missNote = DIRECT ? 'No Anthropic key, so misses use scripted lines' : 'ANTHROPIC_API_KEY is not set in app/.env, so misses use scripted lines'; err = true; }
  else if (st.misses === 'haiku' && JEV.haikuKey === null && JEV.mode !== 'checking') { missNote = 'Start the proxy (npm run proxy) for Haiku replies'; err = true; }
  return modeRow +
    `<div class="dm-slot dm-jev" title="${esc(JEV.reason)}"><i class="dm-dot${jev[0]}"></i><span><b>${esc(jev[1])}</b><small>${esc(jev[2])}</small></span></div>
    <label class="dm-slot dm-ai" title="What agent and email contacts say when Jev finds nothing in your message">${MI.chat}<span><b>Misses</b><small${err ? ' class="dm-err"' : ''}>${esc(missNote)}</small></span>
      <span class="dm-slot-acts"><select id="llm-misses">${sel(st.misses, 'haiku', 'Haiku (API)')}${sel(st.misses, 'scripted', 'Scripted lines')}</select></span></label>` +
    (st.misses === 'haiku' && !DIRECT ? `<label class="dm-slot dm-ai" title="Subscription runs the claude CLI on your machine (dev only, slow); API uses ANTHROPIC_API_KEY">${MI.key}<span><b>Haiku via</b><small>${st.haikuVia === 'api' ? 'ANTHROPIC_API_KEY' : 'The claude CLI (slow)'}</small></span>
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
    ? item('new', MI.logout, 'New game', `Start over from ${dateLong(1)}`) + item('devmode', MI.help, `Dev mode: ${store.devMode ? 'on' : 'off'}`, 'Show how agent replies were chosen') + item('dev', MI.term, 'Story debugger', 'jev · Ctrl+`')
      + (DIRECT ? item('keys', MI.key, 'API keys', API_KEYS.any ? 'Saved in this browser' : 'Not set: add yours to play online') : '') + aiRows() + soundRows()
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
