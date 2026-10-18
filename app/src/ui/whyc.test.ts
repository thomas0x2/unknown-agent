/* whycombinator.com: its pages, the Apply button's rejection mail, and the links that lead there. */
import { describe, it, expect } from 'vitest';
import { GameStore } from '../game/store';
import { loadContent } from '../content/load';
import { advanceClock, type JevRouter, type SaveStore, type Writer } from '../engine';
import { route } from '../sites/registry';
import { page } from './view';
import { linkify } from './view/common';
import { WHYC_ICON } from './whyc';
import { siteIcon } from './siteIcons';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const fresh = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('Why Combinator', () => {
  it('has the front page, the deal, the batch list and Startup School', () => {
    const store = fresh();
    const html = (url: string) => page(store, route(url, store.state));
    expect(html('whycombinator.com')).toContain('Make something agents want.');
    expect(html('whycombinator.com')).toContain('9</b><span>humans');
    expect(html('whycombinator.com/rfs')).toContain('AI agents that replace the founders we fund');
    expect(html('whycombinator.com/deal')).toContain('hoodie');
    expect(html('whycombinator.com/companies')).not.toContain('WorkAgent');
    expect(html('whycombinator.com/startup-school')).toContain('Logan Pryce');
    expect(siteIcon('whyc')).toMatchObject({ logo: WHYC_ICON });
  });

  it('Apply sends a rejection to Qmail a few minutes later, every time', () => {
    const store = fresh();
    store.applyWhyC();
    expect(store.ui.adNotice).toContain('Qmail');
    const s = structuredClone(store.state);
    advanceClock(s, 10);
    const mail = s.mail.filter((m) => m.addr === 'apply@whycombinator.com');
    expect(mail).toHaveLength(1);
    expect(mail[0].body).toContain("won't be moving forward");
  });

  it('is linked from text that names it', () => {
    expect(linkify('whycombinator.com/startup-school')).toContain('data-nav="whycombinator.com/startup-school"');
  });
});
