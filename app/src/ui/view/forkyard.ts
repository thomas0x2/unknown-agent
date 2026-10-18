/*
 * Forkyard repos and profiles, and the live app pages.
 */
import { GameStore } from '../../game/store';
import { ICONS } from '../icons';
import { type AppInstance, getApp, bugsOf, breakVariant, onForkyard, userRevenue, LAST_DAY, dateShort, dateLong, dateFull, dayDate } from '../../engine';
import { findUser } from '../forkyard-users';
import { adHtml } from '../ads';
import { renderAppSite, devBugPanel, devBugCount } from '../appsite';
import { cranePosts, playMinutes } from '../../engine';
import { repoFiles, treeAt, fileSource } from '../repoTree';
import { PLAYER, compact, esc, hashHue } from './common';
import { crawlable } from './y';

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
  const counts = Array.from({ length: LAST_DAY }, (_, i) => commits.filter((c) => c.day === i + 1).length);
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

export function pageForkyard(store: GameStore, repo?: string): string {
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

export function pageApp(store: GameStore, param?: string): string {
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
  return `<div class="pv-host">${renderAppSite(a, tmpl, cancel ? 'cancel' : sub, { booking, cancel, day: s.values.day, minute: s.clockMin, market: crawlable(store), crane: cranePosts(s, store.content), stakes: s.stakes, play: playMinutes(s), watchSold: s.flags.includes('viktor_sold_watch'), swap: s.swap, busy: store.busy })}</div>`;
}
