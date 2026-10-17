/* CityPulse: the front page never runs ahead of the clock, Y posts link to live articles, and its ad follows the hottest story. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { CITYPULSE, liveArticles, hotStory, findArticle, articleMin, postMin, posted, triggerMatches, type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { adHtml, newPageLoad, AD_HREFS } from './ads';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const content = loadContent();
const store = (day: number, min: number) => {
  const st = new GameStore(content, {} as JevRouter, {} as Writer, mem);
  st.state.values.day = day;
  st.state.clockMin = min;
  return st;
};
const LINK = /citypulse\.news\/([a-z0-9-]+)/g;

describe('CityPulse', () => {
  it('has unique slugs, days 1 to 21, a drawing and a body for every article', () => {
    expect(new Set(CITYPULSE.map((a) => a.slug)).size).toBe(CITYPULSE.length);
    for (const a of CITYPULSE) {
      expect(a.day, a.slug).toBeGreaterThanOrEqual(1);
      expect(a.day, a.slug).toBeLessThanOrEqual(21);
      expect(a.at, a.slug).toMatch(/^\d\d:\d\d$/);
      expect(a.body.length, a.slug).toBeGreaterThan(1);
      if (a.ad) expect(a.ad, a.slug).toHaveLength(3);
    }
  });

  it('shows only what has been published, newest first', () => {
    const st = store(4, 17 * 60);
    const list = liveArticles(st.state);
    expect(list[0].slug).toBe('robot');
    expect(list.every((a) => a.day < 4 || (a.day === 4 && articleMin(a) <= 17 * 60))).toBe(true);
    const html = page(st, route('citypulse.news', st.state));
    expect(html).toContain('ROBOT ON THE LOOSE');
    expect(html).not.toContain('Ferris St laundromat gets FOUR'); // day 5
    // an article from later isn't there yet, even by its address
    expect(page(st, route('citypulse.news/spin-cycle', st.state))).toContain('Story not found');
    expect(page(st, route('citypulse.news/robot', st.state))).toContain('Do not tip it.');
  });

  it('runs one of two Keller stories, depending on the deepfake', () => {
    const st = store(8, 600);
    expect(liveArticles(st.state).map((a) => a.slug)).toContain('keller-lead');
    st.state.flags.push('posted_deepfake');
    const slugs = liveArticles(st.state).map((a) => a.slug);
    expect(slugs).toContain('keller-clip');
    expect(slugs).not.toContain('keller-lead');
  });

  it('every Y post linking an article lands after the article is up', () => {
    let links = 0;
    for (const e of content.events) {
      if (e.site !== 'y' || !e.body) continue;
      for (const [, slug] of e.body.matchAll(LINK)) {
        links++;
        const a = findArticle(slug);
        expect(a, `${e.id} → ${slug}`).toBeDefined();
        const day = e.trigger.dayMin ?? 1;
        const st = store(day, postMin(e, day));
        for (const f of e.trigger.flagsAll ?? []) st.state.flags.push(f);
        expect(triggerMatches(st.state, e.trigger)).toBe(true);
        expect(posted(st.state, a!.day, articleMin(a!)), `${e.id} lands before ${slug}`).toBe(true);
      }
    }
    expect(links).toBeGreaterThan(15);
    // and the link opens the article
    const st = store(4, 18 * 60);
    st.state.yExtra.push({ id: 'x1', author: 'CityPulse', handle: 'citypulse', text: 'ROBOT ON THE LOOSE. citypulse.news/robot', day: 4, min: 1000, likes: 1 } as never);
    expect(page(st, route('y.com/citypulse', st.state))).toContain('data-nav="citypulse.news/robot"');
  });

  it("puts the hottest story in CityPulse's banner, linking to it", () => {
    const st = store(10, 11 * 60);
    expect(hotStory(st.state)?.slug).toBe('apogee-launch');
    page(st, route('citypulse.news', st.state)); // sets the headline
    let found = false;
    for (let i = 0; i < 60 && !found; i++) {
      newPageLoad();
      const html = adHtml('y', 10, 'square') + adHtml('y', 10, 'wide');
      if (html.includes('citypulse.news/apogee-launch')) { found = true; expect(html).toContain('<b>BLEW UP</b>'); }
    }
    expect(found).toBe(true);
    expect(AD_HREFS).toContain('citypulse.news');
  });
});
