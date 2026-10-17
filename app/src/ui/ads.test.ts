import { describe, it, expect } from 'vitest';
import { pickAd, adHtml, newPageLoad, AD_IDS, AD_HREFS } from './ads';
import { route } from '../sites/registry';
import { AD_SITES } from '../sites/adSites';
import { pageAdSite } from './adSites';
import { newGame, citizenScore } from '../engine';

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
    expect(html).toMatch(/data-newtab="[a-z0-9.-]+(\/[a-z0-9-]+)?"/);
    expect(html.match(/class="ad-f"/g)).toHaveLength(3);
  });
  it('opens a real page for every ad: its landing page, or a site that already exists', () => {
    const s = newGame();
    for (const href of AD_HREFS) {
      const r = route(href, s);
      expect(r.reachable, href).toBe(true);
      expect(['adsite', 'empire', 'phish', 'prince', 'lonely', 'doordish', 'agent'], href).toContain(r.site);
    }
  });
  it('has no landing page without an ad', () => {
    for (const site of AD_SITES) expect(AD_HREFS, site.url).toContain(site.url);
  });
  it('draws each landing page with its brand, three cards and the fine print', () => {
    for (const site of AD_SITES) {
      const html = pageAdSite(site.url, newGame());
      expect(html).toContain(`lp-t-${site.theme}`);
      expect(html.match(/class="lp-card"/g)).toHaveLength(3);
      expect(html).toContain('class="lp-fine"');
      // no buttons but an optional working one; otherwise only an optional link to a site you can then reach
      expect(html).not.toMatch(/data-(newtab|form)|<(input|form)\b/);
      expect(html.match(/<button\b/g) ?? []).toHaveLength(site.action ? 1 : 0);
      expect(html.match(/data-act=/g) ?? []).toHaveLength(site.action ? 1 : 0);
      expect(html.match(/data-nav=/g) ?? []).toHaveLength(site.link ? 1 : 0);
      if (site.link) {
        const s = newGame();
        if (site.unlocks) s.flags.push(site.unlocks);
        expect(route(site.link[2], s).reachable, site.url).toBe(true);
      }
    }
  });
  it('citizenscore.gov shows the suspicion meter upside down', () => {
    const s = newGame();
    expect(citizenScore(0)).toBe(780);
    expect(citizenScore(100)).toBe(60);
    expect(pageAdSite('citizenscore.gov', s)).toContain('<b>780</b>');
    s.values.suspicion = 50;
    expect(pageAdSite('citizenscore.gov', s)).toContain('<b>420</b>');
  });
});
