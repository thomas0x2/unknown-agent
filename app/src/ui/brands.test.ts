import { describe, expect, it } from 'vitest';
import { VANTOR_ICON, isVantorAddr, vantorWordmark } from './vantor';
import { adSiteIcon, pageAdSite } from './adSites';
import { WIDE } from './ads';
import { adLogoHtml } from './siteIcons';
import { STEADFAST_ICON } from './steadfast';
import { PERDURE_ICON } from './perdure';
import { STOCKS } from '../engine/stocks';

describe('Vantor brand', () => {
  it('names the division in the wordmark', () => {
    expect(vantorWordmark('People & Culture')).toContain('PEOPLE &amp; CULTURE');
  });
  it('signs only mail from Vantor', () => {
    expect(isVantorAddr('people@vantorgroup.test')).toBe(true);
    expect(isVantorAddr('gino@trattoria.test')).toBe(false);
  });
  it('brands the vantor.group pages and their tab icon', () => {
    for (const url of ['vantor.group/careers', 'vantor.group/next-chapter']) {
      expect(adSiteIcon(url)).toBe(VANTOR_ICON);
      expect(pageAdSite(url, {} as never)).toContain('vantor-wordmark');
    }
  });
  it('puts the logo on Vantor banner ads', () => {
    const vantor = WIDE.filter((a) => a.sponsor.startsWith('Vantor'));
    expect(vantor.length).toBeGreaterThan(1);
    for (const a of vantor) expect(adLogoHtml(a.href)).toContain(VANTOR_ICON);
  });
});

describe('Steadfast Mutual brand', () => {
  it('brands steadfast.insure, its tab icon and its ad', () => {
    expect(adSiteIcon('steadfast.insure')).toBe(STEADFAST_ICON);
    expect(pageAdSite('steadfast.insure', {} as never)).toContain('steadfast-wordmark');
    const ad = WIDE.find((a) => a.sponsor === 'Steadfast Mutual');
    expect(adLogoHtml(ad!.href)).toContain(STEADFAST_ICON);
    expect(ad?.theme).toBe('ad-steadfast');
  });
});

describe('Perdure Pharma brand', () => {
  it('brands perdure.com, its tab icon and its ad', () => {
    expect(adSiteIcon('perdure.com')).toBe(PERDURE_ICON);
    expect(pageAdSite('perdure.com', {} as never)).toContain('perdure-wordmark');
    expect(adLogoHtml('perdure.com')).toContain(PERDURE_ICON);
  });
  it('links its products to it, and trades on Sherwood', () => {
    for (const url of ['nodoze.max', 'ozempra.com', 'fluvera.com']) expect(pageAdSite(url, {} as never)).toContain('data-nav="perdure.com"');
    expect(STOCKS.find((x) => x.ticker === 'PDUR')?.name).toBe('Perdure Pharma');
  });
});
