/*
 * Yowl business reviews.
 */
import { GameStore } from '../../game/store';
import { ICONS } from '../icons';
import { dateShort } from '../../engine';
import { BUSINESSES, YOWL_SEED, type Business } from '../yowl-data';
import { adHtml } from '../ads';
import { esc, linkify } from './common';

// ── Yowl ──
const starRow = (n: number) => `<span class="yw-stars" aria-label="${n.toFixed(1)} stars">${[1, 2, 3, 4, 5].map((i) => `<i class="${n >= i - 0.25 ? 'on' : n >= i - 0.75 ? 'half' : ''}"></i>`).join('')}</span>`;

export function reviewsFor(store: GameStore, b: Business) {
  const s = store.state;
  const out: { author: string; stars: number; text: string; day: number; mine?: boolean }[] = [];
  for (const r of s.reviews.filter((r) => r.bizId === b.id && !r.removed)) out.push({ author: r.author, stars: r.stars, text: r.text, day: r.day, mine: r.mine });
  const gone = s.removedSeed ?? [];
  for (const r of YOWL_SEED[b.id] ?? []) {
    if ((r.day ?? 0) > s.values.day || gone.includes(`${b.id}:${r.author}`)) continue;
    out.push({ author: r.author, stars: r.stars, text: r.text, day: r.day ?? 0 });
  }
  return out;
}

const avg = (l: { stars: number }[]) => (l.length ? l.reduce((a, x) => a + x.stars, 0) / l.length : 0);

export function pageYowl(store: GameStore, param?: string): string {
  const head = `<header class="yw-top"><a href="#" class="yw-logo" data-nav="yowl.com">${ICONS.yowl}<span>yowl</span></a><span class="yw-sub">honest reviews from real neighbors</span></header>`;
  if (param && param.startsWith('biz/')) {
    const b = BUSINESSES.find((x) => x.id === param.slice(4));
    if (!b) return `<div class="yw">${head}<div class="yw-wrap"><p>No business here.</p></div></div>`;
    const list = reviewsFor(store, b);
    const mine = store.state.reviews.some((r) => r.bizId === b.id && r.mine);
    const stars = store.ui.reviewStars;
    const form = mine ? '' : `<form class="yw-form" data-form="review" data-biz="${esc(b.id)}"><h2>Write a review</h2>
      <div class="yw-pick" role="radiogroup" aria-label="Your rating">${[1, 2, 3, 4, 5].map((i) => `<button type="button" class="${stars >= i ? 'on' : ''}" data-star="${i}" role="radio" aria-checked="${stars === i}" aria-label="${i} star${i > 1 ? 's' : ''}"></button>`).join('')}<span${store.ui.reviewNeedsStars ? ' class="yw-need"' : ''}>${stars ? `${stars} of 5` : store.ui.reviewNeedsStars ? 'Pick a rating first' : 'Pick a rating'}</span></div>
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
