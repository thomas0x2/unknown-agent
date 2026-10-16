import { describe, it, expect } from 'vitest';
import { pickAd, adHtml } from './ads';

const SITES = ['qmail', 'y', 'yowl', 'satchel', 'forkyard', 'weightroom'];

describe('banner ads', () => {
  it('never shows the same ad twice on one page', () => {
    for (const site of SITES) for (let day = 1; day <= 21; day++) for (let m = 0; m < 30; m++) {
      const now = m * 60_000;
      const ids = [pickAd(site, day, 'wide', 0, now).id, pickAd(site, day, 'tall', 0, now).id, pickAd(site, day, 'wide', 1, now).id];
      expect(new Set(ids).size, `${site} day ${day}`).toBe(3);
    }
  });
  it('keeps ads out of days before their story beat', () => {
    for (let m = 0; m < 30; m++) expect(['crane', 'gai2', 'bean']).not.toContain(pickAd('y', 1, 'wide', 0, m * 60_000).id);
  });
  it('renders a clickable banner that leads off the bookmarks', () => {
    const html = adHtml('qmail', 1, 'wide');
    expect(html).toMatch(/class="ad ad-wide /);
    expect(html).toMatch(/data-nav="[a-z0-9.-]+(\/[a-z0-9-]+)?"/);
    expect(html.match(/class="ad-f"/g)).toHaveLength(3);
  });
});
