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

const SKIN = ['#efcfb3', '#e2b28c', '#c69070', '#9c6b4e', '#6f4b37'];
const HAIR: Record<Profile['hairColor'], string> = { black: '#2a2226', brown: '#5a3e2b', blonde: '#d2b06e', red: '#a8502c', grey: '#aeaaa3' };
const BACK = ['#8ea698', '#878c95', '#9e8a7a', '#7d8fa3', '#9a8f9e', '#8f9a86'];
const TOPS = ['#4a5566', '#6b5a49', '#5e6f64', '#7c6a7e', '#3e4f5e', '#8a7466'];
const NEON = ['#3dffa8', '#ff3fa4', '#2ef2ff', '#e6ff3a'];
const INK = '#1c1e24';
const SHADE = 'rgba(0,0,0,.16)';

/**
 * A head and shoulders in the Y avatars' house style (ui/y-avatars.ts): flat geometric shapes, a dark
 * outline, muted colours with one neon accent, one flat shade, a plain background. The hidden traits
 * decide what it must show: long hair hangs to the shoulders (short is a bob, curls or a crop), the hair
 * colour, glasses, earrings. `look` picks the rest. Hair in front always covers the top of the head.
 */
function portrait(p: Profile): string {
  const l = p.look;
  const skin = SKIN[l % SKIN.length], hair = HAIR[p.hairColor], back = BACK[Math.floor(l / 30) % BACK.length];
  const top = TOPS[Math.floor(l / 7) % TOPS.length], neon = NEON[Math.floor(l / 11) % NEON.length];
  // 0 long, 1 bob, 3 curls, 4 crop
  const style = p.hair === 'long' ? 0 : p.gender === 'man' ? 4 : [1, 3, 4][Math.floor(l / 3) % 3];
  // long hair falls over the shoulders, so it is drawn on top of them
  const long = style === 0 ? `<path d="M19 33 C17 17 25 12.5 32 12.5 C39 12.5 47 17 45 33 V54 Q42.2 56 39.5 54 V36 H24.5 V54 Q21.8 56 19 54Z" fill="${hair}"/>` : '';
  const behind = style === 1 ? `<path d="M19 33 C17 17 25 12.5 32 12.5 C39 12.5 47 17 45 33 V40 H19Z" fill="${hair}"/>`
    : style === 3 ? `<circle cx="32" cy="28" r="16.5" fill="${hair}"/>` : '';
  const front = style === 4 ? `<path d="M21 26 C20.5 15.5 27 13 33 13 C40 13 44 17 43 26 C40.5 19 31 16.5 21 26Z" fill="${hair}"/>`
    : `<path d="M20.8 27 C21.5 17 27.5 14.3 33 14.3 C39 14.3 43.5 18 43.2 27 C38 23.5 29 21 20.8 27Z" fill="${hair}"/>`;
  const v = Math.floor(l / 13) % 3;
  const neckline = v === 0 ? `<path d="M26 46.5 Q32 51 38 46.5" fill="none"/>` : `<path d="M26 46.5 L32 55 L38 46.5Z" fill="${SKIN[l % SKIN.length]}"/>`;
  const mouth = v === 2 ? '<path d="M28.5 35 Q32 39 35.5 35Z" fill="#f4f1ea" stroke-width="1.5"/>' : '<path d="M29.5 36.4 Q32 37.8 34.5 36.4" fill="none" stroke-width="1.5"/>';
  const accent = p.earrings === 'yes'
    ? `<circle cx="21" cy="35" r="1.7" fill="${neon}" stroke-width="1.2"/><circle cx="43" cy="35" r="1.7" fill="${neon}" stroke-width="1.2"/>`
    : `<path d="M26 46.5 Q32 51 38 46.5" fill="none" stroke="${neon}" stroke-width="2.4"/>`;
  const glasses = p.glasses === 'yes'
    ? '<circle cx="28" cy="30.3" r="3.3" fill="rgba(255,255,255,.22)" stroke-width="1.5"/><circle cx="36" cy="30.3" r="3.3" fill="rgba(255,255,255,.22)" stroke-width="1.5"/><path d="M31.3 30.1 H32.7" fill="none" stroke-width="1.4"/>'
    : '';
  const dot = (x: number) => `<circle cx="${x}" cy="30" r="1.3" fill="${INK}" stroke="none"/>`;
  return `<svg viewBox="-27 1 118 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect x="-40" y="-8" width="150" height="80" fill="${back}"/>`
    + `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${behind}`
    + `<path d="M6 66 C6 52 17 46 32 46 C47 46 58 52 58 66Z" fill="${top}"/>${neckline}${long}`
    + `<path d="M27 37 V48 H37 V37Z" fill="${skin}"/><path d="M27 41 H37 V45 Q32 47 27 45Z" fill="${SHADE}" stroke="none"/>`
    + `<ellipse cx="21" cy="30" rx="2.4" ry="3.4" fill="${skin}"/><ellipse cx="43" cy="30" rx="2.4" ry="3.4" fill="${skin}"/>`
    + `<ellipse cx="32" cy="29" rx="11" ry="13" fill="${skin}"/><path d="M32 16 A11 13 0 0 1 32 42 A8 13 0 0 0 32 16Z" fill="${SHADE}" stroke="none"/>`
    + `${front}<path d="M26.3 26.6 Q28 25.6 29.8 26.4 M34.2 26.4 Q36 25.6 37.7 26.6" fill="none" stroke-width="1.3"/>`
    + `${dot(28)}${dot(36)}${glasses}${mouth}${accent}</g></svg>`;
}

/** For tests: the card's picture. */
export const portraitOf = portrait;

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
