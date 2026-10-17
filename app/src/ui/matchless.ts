/*
 * matchless.com: a landing page for everyone, and once the player swipes for Derek, his account with
 * one profile at a time (engine/matchless.ts). The site says nothing about his standards: the player
 * checks each profile against his emails.
 */
import type { GameStore } from '../game/store';
import { matchlessNow, showAttr, ATTRS, MATCHLESS_JOB, type Profile } from '../engine/matchless';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** A rose tile: a heart dropping into a filter funnel. */
export const MATCHLESS_ICON = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="2" y="2" width="36" height="36" rx="8" fill="#b4234f"/><path d="M20 15.5c-1.6-3.2-6.5-2.6-6.5 1 0 2.6 3.3 4.6 6.5 7 3.2-2.4 6.5-4.4 6.5-7 0-3.6-4.9-4.2-6.5-1z" fill="#ffd3df"/><path d="M8 9h24l-8.5 11v9l-7 3V20z" fill="none" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;

const SKIN = ['#f1d3bd', '#e0b391', '#c68a62', '#9a6545', '#6e4630'];
const HAIR = ['#2b2118', '#4a3020', '#8a5a2b', '#c99a5b', '#1c1c1c', '#7b3f2a'];
const BACK = ['#f6d5dc', '#d9e7f5', '#e3f0dc', '#f3e6cf', '#e6dcf3', '#d8efed'];
const TOPS = ['#c0567a', '#3f7cc4', '#3a9a7a', '#d08a2e', '#6d55b0', '#40464f'];

/** A flat head-and-shoulders picture, picked by `look`: long hair, a bob, a bun, curls or short. */
function portrait(p: Profile): string {
  const l = p.look;
  const skin = SKIN[l % SKIN.length], hair = HAIR[Math.floor(l / 5) % HAIR.length], back = BACK[Math.floor(l / 30) % BACK.length], top = TOPS[Math.floor(l / 7) % TOPS.length];
  const style = p.gender === 'man' ? 4 : Math.floor(l / 3) % (p.gender === 'nonbinary' ? 5 : 4);
  const behind = style === 0 ? `<path d="M19 30c0-13 26-13 26 0v20H19z" fill="${hair}"/>` : style === 3 ? `<circle cx="32" cy="27" r="15" fill="${hair}"/>` : '';
  const over = style === 1 ? `<path d="M20 31c0-12 24-12 24 0v6h-4v-7c-4 2-12 2-16 0v7h-4z" fill="${hair}"/>`
    : style === 2 ? `<circle cx="32" cy="13" r="5.5" fill="${hair}"/><path d="M21 28c1-9 21-9 22 0-6-3-16-3-22 0z" fill="${hair}"/>`
    : style === 4 ? `<path d="M22 25c1-7 19-7 20 0-5-2-15-2-20 0z" fill="${hair}"/>`
    : `<path d="M21 28c1-10 21-10 22 0-6-3-16-3-22 0z" fill="${hair}"/>`;
  return `<svg viewBox="-16 0 96 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="-16" width="96" height="64" fill="${back}"/>${behind}<path d="M12 64c2-12 10-17 20-17s18 5 20 17z" fill="${top}"/><rect x="28" y="38" width="8" height="9" rx="3" fill="${skin}"/><ellipse cx="32" cy="29" rx="10" ry="11.5" fill="${skin}"/>${over}</svg>`;
}

export function pageMatchless(store: GameStore): string {
  const s = store.state;
  const head = (right: string) => `<header class="mx-head"><span class="mx-logo">${MATCHLESS_ICON}</span><div><b>Matchless</b><span>Dating, with standards</span></div>${right}</header>`;
  if (!s.flags.includes(MATCHLESS_JOB)) {
    return `<div class="mx">${head('')}<main class="mx-land">
      <h1>Dating, with standards.</h1>
      <p>Other apps guess what you want. Matchless asks. Thirteen fields on every profile, all of them filled in.</p>
      <ul class="mx-facts"><li><b>1,284</b> profiles near you</li><li><b>13</b> fields per profile</li><li><b>3</b> matches made this year</li></ul>
      <p class="mx-fine">Members sign in through the Matchless app.</p></main></div>`;
  }
  const { profiles, next, done } = matchlessNow(s, store.content);
  const right = `<p class="mx-who">Signed in as Derek</p>`;
  if (!next) {
    return `<div class="mx">${head(right)}<main class="mx-main"><div class="mx-done"><b>That's everyone near you today.</b><p>New profiles tomorrow.</p></div></main></div>`;
  }
  const rows = ATTRS.map(([a, label]) => `<tr><th>${esc(label)}</th><td>${esc(showAttr(next, a))}</td></tr>`).join('');
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
