/*
 * Small pages: the Spin Cycle feed, the browser error page, the new tab, EMPIRE and the onion sites.
 */
import { GameStore } from '../../game/store';
import { ICONS } from '../icons';
import { bookmarks, type SiteId } from '../../sites/registry';
import { type GameState, dateFull, EMPIRE } from '../../engine';
import { machineFeed, FEED_PAGE } from '../../engine';
import { esc } from './common';

// ── Spin Cycle's raw machine feed: the ground truth for the laundromat app ──
export function pageSpinFeed(store: GameStore, param?: string): string {
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

const ERR_ICON = '<svg class="err-ico" viewBox="0 0 48 48" aria-hidden="true"><path d="M12 4h17l11 11v29H12z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M29 4v11h11" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M19 37c1.6-2.6 3.6-3.8 6-3.8s4.4 1.2 6 3.8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="26" r="2.2" fill="currentColor"/><circle cx="30" cy="26" r="2.2" fill="currentColor"/></svg>';

export function pageError(url: string, site: SiteId): string {
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

export function pageNewTab(store: GameStore): string {
  const s = store.state;
  const tiles = bookmarks(s).map((b) => `<button class="nt-tile nt-${b.id}" data-nav="${b.base}"><span class="nt-ico">${ICONS[b.id] || ICONS.newtab}</span><span>${esc(b.label)}</span></button>`).join('');
  return `<div class="newtab"><p class="nt-time">${dateFull(s.values.day)}</p>
    <form class="nt-search" data-form="url"><input id="nt-url" autocomplete="off" placeholder="Type a web address"></form>
    <div class="nt-tiles">${tiles}</div></div>`;
}

// ── empire.alphaascend.biz ──
export function pageEmpire(s: GameState): string {
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

export function pageUnderground(label: string): string {
  return `<div class="newtab"><p class="nt-time">${esc(label)}</p><p class="dv-dim" style="font-family:var(--f-mono)">This site is reachable, but its interface isn't wired yet.</p></div>`;
}
