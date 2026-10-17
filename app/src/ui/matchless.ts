/*
 * matchless.com: a landing page for everyone, and once the player swipes for the client, his account with
 * one profile at a time (engine/matchless.ts). The site says nothing about his standards: the player
 * checks each profile against his emails.
 */
import type { GameStore } from '../game/store';
import { matchlessNow, showAttr, shownAttrs, MATCHLESS_JOB, type Profile } from '../engine/matchless';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** A rose tile: a heart dropping into a filter funnel. */
export const MATCHLESS_ICON = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#b4234f"/><path d="M20 15.5c-1.6-3.2-6.5-2.6-6.5 1 0 2.6 3.3 4.6 6.5 7 3.2-2.4 6.5-4.4 6.5-7 0-3.6-4.9-4.2-6.5-1z" fill="#ffd3df"/><path d="M8 9h24l-8.5 11v9l-7 3V20z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

const SKIN = ['#e9cdb6', '#d6ad8e', '#b98a68', '#8f6a50', '#6b4f3c'];
const HAIR = ['#3a3430', '#5a4636', '#8a6a4c', '#b39a78', '#2e3036', '#7a5246'];
const BACK = ['#cfd8d6', '#d9d2c7', '#c9cfdc', '#d8cdd1', '#cdd6c8', '#d6d3cb'];
const TOPS = ['#5d6b78', '#7a6f86', '#6e8277', '#8a7766', '#566273', '#7b6a6a'];
const NEON = ['#39ff9f', '#ff3df2', '#2de2ff', '#d4ff3a'];
const LINE = '#262a33';

/**
 * A flat vector head and shoulders: geometric shapes, bold outlines, muted colours with one neon
 * accent (a collar or an earring), one soft shade. Picked by `look`: long hair, a bob, a bun, curls or short.
 */
function portrait(p: Profile): string {
  const l = p.look;
  const skin = SKIN[l % SKIN.length], hair = HAIR[Math.floor(l / 5) % HAIR.length], back = BACK[Math.floor(l / 30) % BACK.length];
  const top = TOPS[Math.floor(l / 7) % TOPS.length], neon = NEON[Math.floor(l / 11) % NEON.length];
  const style = p.gender === 'man' ? 4 : Math.floor(l / 3) % (p.gender === 'nonbinary' ? 5 : 4);
  const o = `stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"`;
  const shade = 'fill="#1b1f2a" fill-opacity="0.14"';
  const behind = style === 0 ? `<path d="M19.5 30c0-14 25-14 25 0v19h-25z" fill="${hair}" ${o}/>`
    : style === 3 ? `<circle cx="32" cy="27" r="14.5" fill="${hair}" ${o}/>` : '';
  const over = style === 1 ? `<path d="M20.5 32c0-13 23-13 23 0v5h-4v-7.5c-4.5 2.2-10.5 2.2-15 0V37h-4z" fill="${hair}" ${o}/>`
    : style === 2 ? `<circle cx="32" cy="13.5" r="5" fill="${hair}" ${o}/><path d="M21.5 28c1.5-9.5 19.5-9.5 21 0-6-3-15-3-21 0z" fill="${hair}" ${o}/>`
    : style === 4 ? `<path d="M22.5 25.5c1.5-7.5 17.5-7.5 19 0-5-2.2-14-2.2-19 0z" fill="${hair}" ${o}/>`
    : `<path d="M21.5 28c1.5-10.5 19.5-10.5 21 0-6-3-15-3-21 0z" fill="${hair}" ${o}/>`;
  const accent = style === 4 || style === 3
    ? `<path d="M26 47.5c3.5 2.5 8.5 2.5 12 0" fill="none" stroke="${neon}" stroke-width="2.4" stroke-linecap="round"/>`
    : `<circle cx="22.3" cy="33" r="1.7" fill="${neon}" stroke="${LINE}" stroke-width="0.9"/>`;
  return `<svg viewBox="-28 -2 120 66" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="-28" y="-2" width="120" height="66" fill="${back}"/>`
    + `<ellipse cx="32" cy="62" rx="24" ry="3" ${shade}/>${behind}`
    + `<path d="M13 64c1.5-11 9.5-16.5 19-16.5S49.5 53 51 64z" fill="${top}" ${o}/><path d="M32 47.5c7 0 13.5 4 16.5 11L51 64H40c0-7-3-13-8-16.5z" ${shade}/>`
    + `<rect x="28" y="37" width="8" height="11" rx="2.5" fill="${skin}" ${o}/><path d="M28.8 39.5h6.4v3.5c-2 1-4.4 1-6.4 0z" ${shade}/>`
    + `<ellipse cx="32" cy="29" rx="9.8" ry="11.3" fill="${skin}" ${o}/><path d="M32 17.7a9.8 11.3 0 0 1 0 22.6c3.5-3 5-7 5-11.3s-1.5-8.3-5-11.3z" ${shade}/>`
    + `${over}${accent}</svg>`;
}

export function pageMatchless(store: GameStore): string {
  const s = store.state;
  const head = (right: string) => `<header class="mx-head"><span class="mx-logo">${MATCHLESS_ICON}</span><div><b>Matchless</b><span>Dating, with standards</span></div>${right}</header>`;
  if (!s.flags.includes(MATCHLESS_JOB)) {
    return `<div class="mx">${head('')}<main class="mx-land">
      <h1>Dating, with standards.</h1>
      <p>Other apps guess what you want. Matchless asks, and every profile answers.</p>
      <ul class="mx-facts"><li><b>1,284</b> profiles near you</li><li><b>3</b> matches made this year</li></ul>
      <p class="mx-fine">Members sign in through the Matchless app.</p></main></div>`;
  }
  const { profiles, next, done, version } = matchlessNow(s, store.content);
  const right = `<p class="mx-who">Signed in as 6ft_sigma</p>`;
  if (!next) {
    return `<div class="mx">${head(right)}<main class="mx-main"><div class="mx-done"><b>That's everyone near you today.</b><p>New profiles tomorrow.</p></div></main></div>`;
  }
  const rows = shownAttrs(store.content, version).map(([a, label]) => `<tr><th>${esc(label)}</th><td>${esc(showAttr(next, a))}</td></tr>`).join('');
  return `<div class="mx">${head(right)}<main class="mx-main">
    <p class="mx-count">Profile ${done + 1} of ${profiles.length} today</p>
    <article class="mx-card">
      <span class="mx-ph">${portrait(next)}</span>
      <div class="mx-info"><h2>${esc(next.name)}, ${next.age}</h2><p>${esc(next.bio)}</p><table>${rows}</table></div>
      <div class="mx-acts">
        <form data-form="mx-swipe" data-pick="no"><button type="submit" class="mx-btn no"${s.ending ? ' disabled' : ''}>Reject</button></form>
        <form data-form="mx-swipe" data-pick="yes"><button type="submit" class="mx-btn yes"${s.ending ? ' disabled' : ''}>Accept</button></form>
      </div>
    </article></main></div>`;
}
