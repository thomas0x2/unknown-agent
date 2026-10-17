/*
 * A site's logo, wherever the brand shows: the tab favicon (view.ts tabsHtml) and the banner ads that
 * point at it (ads.ts). Built-in sites use their ICONS glyph, coloured by `.ico-<site>`; ad landing
 * pages and the ad-born sites (prince, lonely, sorry) bring their own coloured mark.
 */
import { ICONS } from './icons';
import { SITES, type SiteId } from '../sites/registry';
import { adSite } from '../sites/adSites';
import { adSiteIcon } from './adSites';
import { PRINCE_ICON } from './prince';
import { LONELY_ICON } from './lonely';
import { SORRY_ICON } from './sorry';
import { MATCHLESS_ICON } from './matchless';
import { CURRENT_ICON } from './current';
import { CITYPULSE_ICON } from './citypulseIcon';
import { POLLY_ICON } from './pollymarketIcon';
import { STACK_ICON } from './stackIcon';

const OWN: Partial<Record<SiteId, string>> = { prince: PRINCE_ICON, lonely: LONELY_ICON, sorry: SORRY_ICON, current: CURRENT_ICON, citypulse: CITYPULSE_ICON, pollymarket: POLLY_ICON, stack: STACK_ICON, matchless: MATCHLESS_ICON };

/** `logo` is a self-coloured mark; `glyph` an ICONS entry coloured by the `.ico-<site>` class. */
export function siteIcon(site: SiteId, param?: string): { logo?: string; glyph?: string } {
  if (site === 'adsite') return { logo: adSiteIcon(param ?? '') };
  if (site === 'spinfeed') return { logo: adSiteIcon('spincycle.test') };
  if (OWN[site]) return { logo: OWN[site] };
  return { glyph: ICONS[site] };
}

/** The logo for an ad's href (normalized, as in ads.ts), or '' when the brand has none. */
export function adLogoHtml(href: string): string {
  if (adSite(href)) return `<span class="ad-logo ico-applogo">${adSiteIcon(href)}</span>`;
  const def = SITES.find((d) => href === d.base || href.startsWith(d.base + '/'));
  if (!def) return '';
  const i = siteIcon(def.id);
  return i.logo ? `<span class="ad-logo ico-applogo">${i.logo}</span>` : i.glyph ? `<span class="ad-logo ico-${def.id}">${i.glyph}</span>` : '';
}
