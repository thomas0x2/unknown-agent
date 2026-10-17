import { describe, expect, it } from 'vitest';
import { VANTOR_ICON, isVantorAddr, vantorWordmark } from './vantor';
import { adSiteIcon, pageAdSite } from './adSites';
import { WIDE } from './ads';
import { STEADFAST_ICON } from './steadfast';

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
    for (const a of vantor) expect(a.logo).toContain('vantor-wordmark');
  });
});

describe('Steadfast Mutual brand', () => {
  it('brands steadfast.insure, its tab icon and its ad', () => {
    expect(adSiteIcon('steadfast.insure')).toBe(STEADFAST_ICON);
    expect(pageAdSite('steadfast.insure', {} as never)).toContain('steadfast-wordmark');
    const ad = WIDE.find((a) => a.sponsor === 'Steadfast Mutual');
    expect(ad?.logo).toContain('steadfast-wordmark');
    expect(ad?.theme).toBe('ad-steadfast');
  });
});
