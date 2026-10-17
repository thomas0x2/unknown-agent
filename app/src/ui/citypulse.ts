/*
 * citypulse.news: the local news site. The front page lists every article published so far, newest
 * first (engine/citypulse.ts holds the timing); citypulse.news/<slug> opens one. Each article is
 * headed by a picture chosen by its `art` (ui/citypulseArt.ts). It's a tabloid: everything from today is BREAKING.
 */
import type { GameStore } from '../game/store';
import { liveArticles, findArticle, articleLive, articleMin, clockTime, dateShort, weekdayShort, dateFull, type Article } from '../engine';
import { adHtml } from './ads';
import { art } from './citypulseArt';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));


/** "Today, 4:55 PM" for today's articles, "Fri, Oct 6" for older ones. */
function when(a: Article, today: number): string {
  return a.day === today ? `Today, ${clockTime(articleMin(a))}` : `${weekdayShort(a.day)}, ${dateShort(a.day)}`;
}

function masthead(day: number): string {
  return `<header class="cp-top">
    <a href="#" class="cp-logo" data-nav="citypulse.news"><span class="cp-mark" aria-hidden="true">CP</span>CityPulse</a>
    <span class="cp-date">${esc(dateFull(day))}</span>
  </header>`;
}

const foot = `<footer class="cp-foot"><p>CityPulse is reader-funded. Comments are closed on every story.</p><p>© 2028 CityPulse · citypulse.news</p></footer>`;

/** Anything from today is BREAKING. */
const kicker = (a: Article, today: number) => `<p class="cp-kicker">${a.day === today ? '<span class="cp-tag">BREAKING</span>' : ''}<b>${esc(a.section)}</b> ${esc(when(a, today))}</p>`;
/** A headline with its shouty opener ("KABOOM!", "TERROR IN THE LAB:") picked out in red. */
function hed(title: string): string {
  const m = /^(.{3,48}?[:!?]"?)\s+(.+)$/.exec(title);
  return m && m[1] === m[1].toUpperCase() ? `<span class="cp-hot">${esc(m[1])}</span> ${esc(m[2])}` : esc(title);
}
const link = (a: Article, inner: string, cls = '') => `<a href="#" class="cp-a${cls ? ' ' + cls : ''}" data-nav="citypulse.news/${esc(a.slug)}">${inner}</a>`;

export function pageCityPulse(store: GameStore, param?: string): string {
  const s = store.state;
  const day = s.values.day;
  const slug = param?.split('/')[0];
  if (slug) {
    const a = findArticle(slug);
    return `<div class="cp">${masthead(day)}${a && articleLive(s, a) ? articlePage(store, a) : missing()}${foot}</div>`;
  }
  const list = liveArticles(s);
  const [lead, ...rest] = list;
  const top = rest.slice(0, 4);
  const older = rest.slice(4);
  const leadHtml = lead ? `<article class="cp-lead">${link(lead, art(lead.art, 'cp-art'))}<div>${kicker(lead, day)}<h1>${link(lead, hed(lead.title))}</h1><p class="cp-dek">${esc(lead.dek)}</p><p class="cp-by">By <b>${esc(lead.by)}</b></p></div></article>` : '<p class="cp-empty">No stories yet.</p>';
  const topHtml = top.length ? `<div class="cp-grid">${top.map((a) => `<article class="cp-card">${link(a, art(a.art, 'cp-art'))}${kicker(a, day)}<h2>${link(a, hed(a.title))}</h2><p class="cp-dek">${esc(a.dek)}</p></article>`).join('')}</div>` : '';
  const olderHtml = older.length ? `<section class="cp-older"><h3>Earlier</h3>${older.map((a) => `<article class="cp-row">${kicker(a, day)}<h4>${link(a, hed(a.title))}</h4><p class="cp-dek">${esc(a.dek)}</p></article>`).join('')}</section>` : '';
  return `<div class="cp">${masthead(day)}
    <div class="cp-wrap">${adHtml('citypulse', day, 'wide')}
      <div class="cp-cols"><main>${leadHtml}${topHtml}${olderHtml}</main>
        <aside>${mostRead(list, day)}${adHtml('citypulse', day, 'square')}</aside></div>
    </div>${foot}</div>`;
}

/** The sidebar list: the escaped robot never leaves it once it's out. */
function mostRead(list: Article[], day: number): string {
  if (list.length < 3) return '';
  const robot = list.find((a) => a.slug === 'robot');
  const picks = [...(robot ? [robot] : []), ...list.filter((a) => a !== robot && a.day >= day - 2)].slice(0, 5);
  return `<section class="cp-most"><h3>Most read</h3><ol>${picks.map((a) => `<li>${link(a, esc(a.title))}</li>`).join('')}</ol></section>`;
}

function articlePage(store: GameStore, a: Article): string {
  const day = store.state.values.day;
  const more = liveArticles(store.state).filter((x) => x.slug !== a.slug).slice(0, 4);
  return `<div class="cp-wrap cp-story">
    <article>${kicker(a, day)}<h1>${hed(a.title)}</h1><p class="cp-dek">${esc(a.dek)}</p>
      <p class="cp-by">By <b>${esc(a.by)}</b> · ${esc(dateShort(a.day))}, ${esc(clockTime(articleMin(a)))}</p>
      ${art(a.art, 'cp-art cp-hero')}
      <div class="cp-body">${a.body.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    </article>
    ${adHtml('citypulse', day, 'wide')}
    ${more.length ? `<section class="cp-more"><h3>More from CityPulse</h3>${more.map((x) => `<article class="cp-row">${kicker(x, day)}<h4>${link(x, esc(x.title))}</h4></article>`).join('')}</section>` : ''}
  </div>`;
}

function missing(): string {
  return `<div class="cp-wrap cp-story"><h1>Story not found</h1><p class="cp-dek">This story doesn't exist, or it hasn't been published yet.</p><p><a href="#" class="cp-a cp-home" data-nav="citypulse.news">Back to the front page</a></p></div>`;
}
