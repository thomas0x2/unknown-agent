/*
 * The landing pages behind the banner ads (content in sites/adSites.ts). One template, styled per
 * brand by adSites.css: `lp-k-<kit>` sets the layout family, `lp-t-<theme>` the colours and type.
 * Nothing on these pages is interactive yet; the button is a drawn span.
 */
import { adSite } from '../sites/adSites';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function pageAdSite(url: string): string {
  const s = adSite(url);
  if (!s) return '';
  const host = url.split('/')[0];
  const nav = s.nav.map((n) => `<span>${esc(n)}</span>`).join('');
  const stats = s.stats?.length
    ? `<div class="lp-stats">${s.stats.map(([v, l]) => `<div><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>` : '';
  const cards = s.cards.map(([h, p], i) => `<article class="lp-card"><span class="lp-n">${i + 1}</span><h2>${esc(h)}</h2><p>${esc(p)}</p></article>`).join('');
  const quote = s.quote ? `<blockquote class="lp-quote"><p>“${esc(s.quote[0])}”</p><cite>${esc(s.quote[1])}</cite></blockquote>` : '';
  return `<div class="lp lp-k-${s.kit} lp-t-${s.theme}">
    <header class="lp-top"><b class="lp-brand"><span class="lp-mark" aria-hidden="true">${esc(s.mark)}</span>${esc(s.brand)}</b><nav class="lp-nav">${nav}</nav></header>
    <section class="lp-hero">
      ${s.kicker ? `<p class="lp-kicker">${esc(s.kicker)}</p>` : ''}
      <h1>${esc(s.title)}</h1>
      <p class="lp-lead">${esc(s.lead)}</p>
      ${s.cta ? `<span class="lp-cta" aria-disabled="true">${esc(s.cta)}</span>` : ''}
    </section>
    ${stats}
    <div class="lp-cards">${cards}</div>
    ${quote}
    <footer class="lp-foot"><p class="lp-fine">${esc(s.fine)}</p><p class="lp-copy">© 2028 ${esc(s.brand)} · ${esc(host)}</p></footer>
  </div>`;
}

/** The tab title for an ad site. */
export const adSiteTitle = (url: string): string | undefined => adSite(url)?.brand;
