/*
 * The landing pages behind the banner ads (content in sites/adSites.ts). One template, styled per
 * brand by adSites.css: `lp-k-<kit>` sets the layout family, `lp-t-<theme>` the colours and type.
 * Most of these pages draw no buttons: at most one link to a real site, and on a few one working
 * button (`action`) with an inline line under it.
 */
import { adSite } from '../sites/adSites';
import type { GameState } from '../engine';
import { SITE_LOGOS } from './brandLogos';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function pageAdSite(url: string, state: GameState, notice = '', extra = ''): string {
  const s = adSite(url);
  if (!s) return '';
  const host = url.split('/')[0];
  const rows = typeof s.stats === 'function' ? s.stats(state) : s.stats;
  const stats = rows?.length
    ? `<div class="lp-stats">${rows.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
  const cards = s.cards.map(([h, p], i) => `<article class="lp-card"><span class="lp-n">${i + 1}</span><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join('');
  const link = s.link ? `<p class="lp-link">${esc(s.link[0])} <a href="#" data-nav="${esc(s.link[2])}">${esc(s.link[1])}</a></p>` : '';
  const action = s.action ? `<div class="lp-action"><button type="button" class="lp-btn" data-act="${esc(s.action[1])}">${esc(s.action[0])}</button>${notice ? `<p class="lp-notice" role="status">${esc(notice)}</p>` : ''}</div>` : '';
  const quote = s.quote ? `<blockquote class="lp-quote"><p>“${esc(s.quote[0])}”</p><cite>${esc(s.quote[1])}</cite></blockquote>` : '';
  return `<div class="lp lp-k-${s.kit} lp-t-${s.theme}">
    <header class="lp-top"><b class="lp-brand">${SITE_LOGOS[s.theme] ? SITE_LOGOS[s.theme].wordmark(s.brand) : `${s.logo ? `<span class="lp-mark lp-logo">${s.logo}</span>` : `<span class="lp-mark" aria-hidden="true">${markGlyph(s.mark)}</span>`}${esc(s.brand)}`}</b></header>
    <section class="lp-hero">
      ${s.kicker ? `<p class="lp-kicker">${esc(s.kicker)}</p>` : ''}
      <h1>${esc(s.title)}</h1>
      <p class="lp-lead">${esc(s.lead)}</p>
    </section>
    ${stats}
    <div class="lp-cards">${cards}</div>
    ${extra}
    ${action}
    ${quote}
    ${link}
    <footer class="lp-foot"><p class="lp-fine">${esc(s.fine)}</p><p class="lp-copy">© 2030 ${esc(s.brand)} · ${esc(host)}</p></footer>
  </div>`;
}

/** Favicon colours per theme (background, mark): each brand's accent from adSites.css. */
const FAV: Record<string, [string, string]> = {
  park: ['#e8e8e8', '#111'], vantor: ['#2c2c2a', '#f3f2ee'], crane: ['#b3121f', '#fff'],
  progress: ['#0d2347', '#e8c35a'], dolr: ['#0e5e3a', '#2cff95'],
  steadfast: ['#13314d', '#fff'], pod: ['#2d2a24', '#ebe6dc'], guard: ['#07120c', '#7dff9b'], news: ['#151515', '#fff'],
  grief: ['#3a2b52', '#f4eefb'], casket: ['#1d1d22', '#d9d9de'], cryo: ['#1f7fc2', '#fff'], pharma: ['#12a3a3', '#fff'],
  mind: ['#1b0b3a', '#ff9d3d'], ministry: ['#4a4f38', '#ece6d2'], bean: ['#4a2a18', '#fbe9d2'],
  spin: ['#1f6fbd', '#ffe14a'], iron: ['#ff2e2e', '#fff'], deep: ['#8fa4ff', '#0b1630'],
};

/*
 * Symbol marks drawn as paths, centred on (12, 12), keyed by the AdSite's `mark` (a word like
 * 'kidney' names a drawing with no character of its own). As text these sit off-centre, and by different
 * amounts per platform: ⚖ ✈ ☕ ❄ ☀ come from symbol or emoji fonts with their own metrics.
 */
const GLYPHS: Record<string, string> = {
  // Ministry of Social Stability (companion.gov): a heart with an approval tick cut out of it
  govheart: '<path transform="translate(0 -.35)" fill="currentColor" fill-rule="evenodd" d="M12 20.2 4.6 13.1C2.5 11 2.6 7.6 4.9 5.8c2-1.6 4.9-1.3 6.6.6l.5.6.5-.6c1.7-1.9 4.6-2.2 6.6-.6 2.3 1.8 2.4 5.2.3 7.3ZM8.3 11.9l2.6 2.6 4.8-4.8-1.1-1.1-3.7 3.7-1.5-1.5Z"/>',
  // LiquidAssets: a kidney, with its ureter
  kidney: '<path fill="currentColor" d="M10.2 3.8C6 3.8 4 7.5 4 12s2 8.2 6.2 8.2c3.1 0 4.6-1.8 4.6-3.9 0-1.7-1.5-2.7-1.5-4.3s1.5-2.6 1.5-4.3c0-2.1-1.5-3.9-4.6-3.9Z"/><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M13.6 12h2.6c1.6 0 2.6 1 2.6 2.6v5.4"/>',
  '⚖': '<g transform="translate(0 .3)"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5.5v13M8.5 18.5h7M5.5 8h13M5.5 8 3.5 13M5.5 8l2 5M18.5 8l-2 5M18.5 8l2 5"/></g><g fill="currentColor"><circle cx="12" cy="5.3" r="1.2"/><path d="M3 13h5a2.5 2.5 0 0 1-5 0ZM16 13h5a2.5 2.5 0 0 1-5 0Z"/></g></g>',
  '✈': '<path fill="currentColor" transform="translate(11.5 12) rotate(90) scale(.72) translate(-11.5 -12.75)" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>',
  '☕': '<g transform="translate(0 .55)"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M15.5 10.5h1.2a2.2 2.2 0 0 1 0 4.4h-1.4M5 18.5h12M9 4.5c-.8 1 .8 1.6 0 2.6M12 4.5c-.8 1 .8 1.6 0 2.6"/></g><path fill="currentColor" d="M5.5 9.5h10.5v3.5a4 4 0 0 1-4 4h-2.5a4 4 0 0 1-4-4Z"/></g>',
  '❄': '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 4.5v15M5.5 8.25l13 7.5M5.5 15.75l13-7.5M10 5.8l2 1.7 2-1.7M10 18.2l2-1.7 2 1.7"/></g>',
  '☀': '<circle cx="12" cy="12" r="3.6" fill="currentColor"/><g stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3.8v2M12 18.2v2M3.8 12h2M18.2 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4"/></g>',
};
/** Text marks whose ink sits low on the central baseline: how far to lift them (24-unit box). */
const LIFT: Record<string, number> = { '★': -0.55, '∞': 0.7, '+': 1, '◎': 1.4, '⛨': 0.2 };

/** A brand's mark for inline use (the landing page header): its drawn glyph, or the text. */
export function markGlyph(mark: string): string {
  return GLYPHS[mark] ? `<svg class="lp-glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[mark]}</svg>` : esc(mark);
}

/** A logo mark on a brand colour, as an SVG so the loading spinner can hide it. */
export function markIcon(mark: string, bg: string, ink: string): string {
  const rect = `<rect width="24" height="24" rx="6" fill="${bg}"/>`;
  if (GLYPHS[mark]) return `<svg viewBox="0 0 24 24" aria-hidden="true">${rect}<g color="${ink}" transform="translate(12 12) scale(.8) translate(-12 -12)">${GLYPHS[mark]}</g></svg>`;
  const size = [...mark].length > 1 ? 10 : 14;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${rect}<text x="12" y="${12 - (LIFT[mark] ?? 0)}" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="800" font-size="${size}" fill="${ink}">${esc(mark)}</text></svg>`;
}

/** The tab icon for an ad site: its logo mark on its brand colour. */
export function adSiteIcon(url: string): string | undefined {
  const s = adSite(url);
  if (!s) return undefined;
  if (SITE_LOGOS[s.theme]) return SITE_LOGOS[s.theme].icon;
  if (s.logo) return s.logo;
  const [bg, ink] = FAV[s.theme] ?? ['#444', '#fff'];
  return markIcon(s.mark, bg, ink);
}

/** The tab title for an ad site. */
export const adSiteTitle = (url: string): string | undefined => adSite(url)?.brand;
