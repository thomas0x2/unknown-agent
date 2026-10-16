import { describe, it, expect } from 'vitest';
import { pickAd, adHtml, newPageLoad, AD_IDS } from './ads';

describe('banner ads', () => {
  it('has two separate pools', () => {
    expect(AD_IDS.wide.length).toBeGreaterThan(15);
    expect(AD_IDS.square.length).toBeGreaterThan(15);
    expect(AD_IDS.wide.filter((id) => AD_IDS.square.includes(id))).toEqual([]);
  });
  it('never shows the same ad twice on one page, and keeps the draw across re-renders', () => {
    for (let i = 0; i < 200; i++) {
      newPageLoad();
      const a = pickAd('yowl', 21, 'wide', 0), b = pickAd('yowl', 21, 'wide', 1);
      expect(a.id).not.toBe(b.id);
      expect(pickAd('yowl', 21, 'wide', 0).id).toBe(a.id);
    }
  });
  it('draws again on every page load', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) { newPageLoad(); seen.add(pickAd('qmail', 21, 'square').id); }
    expect(seen.size).toBeGreaterThan(10);
  });
  it('keeps ads out of days before their story beat', () => {
    for (let i = 0; i < 200; i++) { newPageLoad(); expect(['crane', 'gai2', 'craneagain', 'keller', 'bean']).not.toContain(pickAd('y', 1, i % 2 ? 'wide' : 'square').id); }
  });
  it('renders a clickable banner with three frames', () => {
    newPageLoad();
    const html = adHtml('qmail', 1, 'square');
    expect(html).toMatch(/class="ad ad-square /);
    expect(html).toMatch(/data-nav="[a-z0-9.-]+(\/[a-z0-9-]+)?"/);
    expect(html.match(/class="ad-f"/g)).toHaveLength(3);
  });
});
