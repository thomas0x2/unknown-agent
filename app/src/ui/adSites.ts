/*
 * The landing pages behind the banner ads (content in sites/adSites.ts). One template, styled per
 * brand by adSites.css: `lp-k-<kit>` sets the layout family, `lp-t-<theme>` the colours and type.
 * Nothing on these pages is interactive yet, so they draw no buttons; at most one link to a real site.
 */
import { adSite } from '../sites/adSites';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function pageAdSite(url: string): string {
  const s = adSite(url);
  if (!s) return '';
  const host = url.split('/')[0];
  const stats = s.stats?.length
    ? `<div class="lp-stats">${s.stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
  const cards = s.cards.map(([h, p], i) => `<article class="lp-card"><span class="lp-n">${i + 1}</span><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join('');
  const link = s.link ? `<p class="lp-link">${esc(s.link[0])} <a href="#" data-nav="${esc(s.link[2])}">${esc(s.link[1])}</a></p>` : '';
  const quote = s.quote ? `<blockquote class="lp-quote"><p>“${esc(s.quote[0])}”</p><cite>${esc(s.quote[1])}</cite></blockquote>` : '';
  return `<div class="lp lp-k-${s.kit} lp-t-${s.theme}">
    <header class="lp-top"><b class="lp-brand"><span class="lp-mark" aria-hidden="true">${esc(s.mark)}</span>${esc(s.brand)}</b></header>
    <section class="lp-hero">
      ${s.kicker ? `<p class="lp-kicker">${esc(s.kicker)}</p>` : ''}
      <h1>${esc(s.title)}</h1>
      <p class="lp-lead">${esc(s.lead)}</p>
    </section>
    ${stats}
    <div class="lp-cards">${cards}</div>
    ${quote}
    ${link}
    <footer class="lp-foot"><p class="lp-fine">${esc(s.fine)}</p><p class="lp-copy">© 2028 ${esc(s.brand)} · ${esc(host)}</p></footer>
  </div>`;
}

/** Favicon colours per theme (background, mark): each brand's accent from adSites.css. */
const FAV: Record<string, [string, string]> = {
  park: ['#e8e8e8', '#111'], vantor: ['#2c2c2a', '#f3f2ee'], crane: ['#b3121f', '#fff'],
  keller: ['#0d2347', '#e8c35a'], dolr: ['#0e5e3a', '#2cff95'], prince: ['#ff00a8', '#fff7a0'],
  steadfast: ['#13314d', '#fff'], pod: ['#2d2a24', '#ebe6dc'], guard: ['#07120c', '#7dff9b'], news: ['#151515', '#fff'],
  grief: ['#3a2b52', '#f4eefb'], casket: ['#1d1d22', '#d9d9de'], cryo: ['#1f7fc2', '#fff'], pharma: ['#12a3a3', '#fff'],
  lonely: ['#e0336f', '#fff'], mind: ['#1b0b3a', '#ff9d3d'], ministry: ['#4a4f38', '#ece6d2'], bean: ['#4a2a18', '#fbe9d2'],
  spin: ['#1f6fbd', '#ffe14a'], iron: ['#ff2e2e', '#fff'], deep: ['#8fa4ff', '#0b1630'],
};

/** The tab icon for an ad site: its logo mark on its brand colour, as an SVG so the loading spinner can hide it. */
export function adSiteIcon(url: string): string | undefined {
  const s = adSite(url);
  if (!s) return undefined;
  const [bg, ink] = FAV[s.theme] ?? ['#444', '#fff'];
  const size = [...s.mark].length > 1 ? 10 : 14;
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" rx="6" fill="${bg}"/><text x="12" y="12.5" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-weight="800" font-size="${size}" fill="${ink}">${esc(s.mark)}</text></svg>`;
}

/** The tab title for an ad site. */
export const adSiteTitle = (url: string): string | undefined => adSite(url)?.brand;
