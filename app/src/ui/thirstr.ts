/*
 * thirstr.com: the creator directory, each creator's page (thirstr.com/<handle>) and Stryker Talent's
 * agency page (engine/thirstr.ts). Pictures are drawn like Matchless cards, so the women from the
 * client's deck look the same here. Nothing explicit: locked posts are blurred tiles, and a
 * subscription shows captions.
 */
import type { GameStore } from '../game/store';
import type { Profile } from '../engine/matchless';
import { creatorsNow, creatorOf, isAi, postCount, postsNow, strykerAutomated, subscribed, STRYKER_TALENT, type Creator } from '../engine/thirstr';
import { portraitOf } from './matchless';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (x: number) => x.toLocaleString('en-US');

/** A teal tile with a drop of water. */
export const THIRSTR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="#0d8f9c"/><path d="M12 4.5c3 4 5 6.6 5 9.2a5 5 0 0 1-10 0c0-2.6 2-5.2 5-9.2z" fill="#fff"/><path d="M10 14.4a2.2 2.2 0 0 0 2.2 2.2" fill="none" stroke="#0d8f9c" stroke-width="1.4" stroke-linecap="round"/></svg>';

const pic = (c: Creator) => portraitOf({ ...c, gender: 'woman' } as unknown as Profile);
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

function head(): string {
  return `<header class="th-head"><a href="#" class="th-logo" data-nav="thirstr.com"><span class="th-mark">${THIRSTR_ICON}</span>Thirstr</a><span class="th-tag">Support creators directly.</span></header>`;
}
const foot = '<footer class="th-foot">Thirstr takes 20% of every subscription. Creators set their own prices. 18+ only.</footer>';

function card(c: Creator, day: number): string {
  const fresh = (c.from ?? 1) > day - 3 && (c.from ?? 1) > 1 ? '<span class="th-new">New</span>' : '';
  return `<a href="#" class="th-card${isAi(c, day) ? ' ai' : ''}" data-nav="thirstr.com/${c.handle}">
    <span class="th-ph">${pic(c)}</span>
    <span class="th-who"><b>${esc(c.name)}</b>${fresh}<small>@${esc(c.handle)}</small></span>
    <span class="th-bio">${esc(isAi(c, day) ? c.ai!.bio : c.bio)}</span>
    <span class="th-price">${n(c.price)} DOLR / 30 days</span></a>`;
}

function directory(store: GameStore): string {
  const d = store.state.values.day;
  const list = creatorsNow(store.state).map((c) => card(c, d)).join('');
  return `<main class="th-main"><h1>Popular near you</h1><div class="th-grid">${list}</div></main>`;
}

function agency(store: GameStore): string {
  const d = store.state.values.day;
  const ours = creatorsNow(store.state).filter((c) => c.stryker);
  return `<main class="th-main"><section class="th-prof">
    <div class="th-prof-top"><div><h1>${esc(STRYKER_TALENT.name)}</h1><p class="th-handle">@${STRYKER_TALENT.handle} · Agency</p></div></div>
    <p class="th-pbio">${esc(strykerAutomated(d) ? STRYKER_TALENT.aiBio : STRYKER_TALENT.bio)}</p>
    <p class="th-stats"><b>${ours.length}</b> creators</p></section>
    <h2>Our creators</h2><div class="th-grid">${ours.map((c) => card(c, d)).join('')}</div></main>`;
}

function profile(store: GameStore, c: Creator): string {
  const s = store.state, d = s.values.day, ai = isAi(c, d), subbed = subscribed(s, c);
  const count = postCount(s, c);
  const by = c.stryker ? `<p class="th-agency">Managed by <a href="#" data-nav="thirstr.com/${STRYKER_TALENT.handle}">${esc(STRYKER_TALENT.name)}</a></p>` : '';
  const stats = `<p class="th-stats"><b>${n(count)}</b> posts · <b>${n(c.subscribers + (ai ? (d - c.ai!.from + 1) * 340 : 0))}</b> subscribers${ai ? ' · Replies in under a second' : ''}</p>`;
  const note = store.ui.adNotice ? `<p class="th-note" role="status">${esc(store.ui.adNotice)}</p>` : '';
  const action = subbed
    ? '<p class="th-subbed">Subscribed</p>'
    : `<button type="button" class="th-sub" data-act="thirstr-sub" data-handle="${c.handle}"${s.ending ? ' disabled' : ''}>Subscribe · ${n(c.price)} DOLR / 30 days</button>`;
  const posts = subbed
    ? postsNow(s, c).map((p) => `<li class="th-post"><span class="th-tile">${pic(c)}</span><div><p>${esc(p.text)}</p><small>${esc(p.ago)}</small></div></li>`).join('')
    : Array.from({ length: Math.min(6, count) }, () => `<li class="th-lock"><span class="th-tile blur">${pic(c)}</span><span class="th-lock-i">${LOCK}</span></li>`).join('');
  const fine = ai ? '<p class="th-fine">Creators may use assistive tools. Thirstr Terms, section 14.2.</p>' : '';
  return `<main class="th-main"><section class="th-prof${ai ? ' ai' : ''}">
    <div class="th-prof-top"><span class="th-ph big">${pic(c)}</span><div><h1>${esc(c.name)}</h1><p class="th-handle">@${esc(c.handle)}</p></div></div>
    <p class="th-pbio">${esc(ai ? c.ai!.bio : c.bio)}</p>${by}${stats}${note}${action}</section>
    ${subbed ? '' : `<p class="th-locked">Subscribe to see ${n(count)} posts.</p>`}
    <ul class="${subbed ? 'th-posts' : 'th-locks'}">${posts}</ul>${fine}</main>`;
}

export function pageThirstr(store: GameStore, param?: string): string {
  const h = (param ?? '').split('/')[0];
  const c = h ? creatorOf(h) : undefined;
  const body = !h ? directory(store)
    : h === STRYKER_TALENT.handle ? agency(store)
    : c && (c.from ?? 1) <= store.state.values.day ? profile(store, c)
    : `<main class="th-main"><div class="th-empty"><b>This page isn't available.</b><p>The creator may have left Thirstr.</p></div></main>`;
  return `<div class="th">${head()}${body}${foot}</div>`;
}

