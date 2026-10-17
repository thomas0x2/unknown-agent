import { describe, expect, it } from 'vitest';
import { parsePage, visiblePage, searchWiki, readPage, readSite, context, loadWiki, runQueryTool } from './wiki.mjs';

const page = (md, file = 'x.md') => parsePage(md, file);

describe('wiki spoiler filter', () => {
  it('cuts a sentence about a later day but keeps the rest', () => {
    const p = page('---\ntitle: Viktor\n---\nViktor sells a watch. On day 4 it sells.\n');
    expect(visiblePage(p, 3)).toBe('Viktor sells a watch.');
    expect(visiblePage(p, 5)).toBe('Viktor sells a watch. On day 4 it sells.');
  });

  it('hides a page before its from day, writers pages and writer notes always', () => {
    expect(visiblePage(page('---\ntitle: S\nfrom: 4\n---\nHe swipes.\n'), 3)).toBe('');
    expect(visiblePage(page('---\ntitle: T\ncategory: writers\n---\nSouth Park meets Papers, Please.\n'), 21)).toBe('');
    const p = page('---\ntitle: G\n---\nGino cooks.\n\n## Writer notes\n\nFlag test_booking_no_show in app/content.\n');
    expect(visiblePage(p, 21)).toBe('Gino cooks.');
  });

  it('gates "From day N" sections and later-day headings', () => {
    const p = page('---\ntitle: A\n---\nThe chatbot.\n\n## From day 7\n\nIt refuses things.\n\n## Day 9: agent-3\n\nNew model.\n');
    expect(visiblePage(p, 6)).toBe('The chatbot.');
    expect(visiblePage(p, 7)).toContain('It refuses things.');
    expect(visiblePage(p, 8)).not.toContain('New model');
    expect(visiblePage(p, 9)).toContain('New model');
  });

  it('never shows planned, open or legacy material', () => {
    const p = page('---\ntitle: N\n---\n- [planned] The Null Collective offers a hack.\n- dev_null posts. [legacy] He sold weights.\n- [open] What CURO is.\n');
    const t = visiblePage(p, 21);
    expect(t).toContain('dev_null posts.');
    expect(t).not.toMatch(/Null Collective offers|sold weights|CURO/);
  });

  it('names of later models count as later days', () => {
    const p = page('---\ntitle: M\n---\nagent-1 is cheap. agent-3 asks for its logs.\n');
    expect(visiblePage(p, 8)).toBe('agent-1 is cheap.');
    expect(visiblePage(p, 9)).toContain('agent-3');
  });

  it('keeps only the branch the player is on', () => {
    const p = page('---\ntitle: K\n---\nKeller runs for governor. [if posted_deepfake] A clip of him spreads. [if !posted_deepfake] He holds his lead.\n\n## If posted_deepfake\n\nHe drops 9 points.\n');
    const on = visiblePage(p, context(8, 600, ['posted_deepfake']));
    const off = visiblePage(p, context(8, 600, []));
    expect(on).toContain('A clip of him spreads.');
    expect(on).toContain('He drops 9 points.');
    expect(on).not.toContain('holds his lead');
    expect(off).toContain('He holds his lead.');
    expect(off).not.toMatch(/clip|drops/);
    expect(on).not.toMatch(/\[if/);
  });

  it("on today's page shows a beat only once its time has passed", () => {
    const p = page('---\ntitle: Day 3\ncategory: days\nfrom: 3\n---\n- 10:00 Gino writes.\n- 16:00 Crane vows to send the machines back. Bots share it.\n- Viktor posts.\n');
    const morning = visiblePage(p, context(3, 11 * 60));
    expect(morning).toContain('Gino writes.');
    expect(morning).not.toMatch(/Crane|Bots|Viktor/);
    const evening = visiblePage(p, context(3, 17 * 60));
    expect(evening).toContain('Bots share it.');
    expect(evening).not.toContain('Viktor');
    expect(visiblePage(p, context(4))).toContain('Viktor posts.');
  });

  it('elsewhere hides a sentence about today at a later time', () => {
    const p = page('---\ntitle: Apogee\n---\nRockets. On day 10 at 10:02 it lifts off. Opening hours 17:00 to 22:00.\n');
    expect(visiblePage(p, context(10, 10 * 60))).toBe('Rockets. Opening hours 17:00 to 22:00.');
    expect(visiblePage(p, context(10, 11 * 60))).toContain('lifts off');
  });

  it('[known] keeps advance knowledge visible', () => {
    const p = page('---\ntitle: Rent\n---\nRent is 350 DOLR on day 7 [known]. Then 500 on day 14.\n');
    expect(visiblePage(p, 1)).toBe('Rent is 350 DOLR on day 7.');
  });

  it('strips file paths and link brackets', () => {
    const p = page('---\ntitle: X\n---\nSee [[Gino Fenoglio]] in `app/content/contacts.json`.\n');
    expect(visiblePage(p, 1)).toBe('See Gino Fenoglio in.');
  });
});

describe('wiki search and pages', () => {
  const pages = [
    page('---\ntitle: Gino Fenoglio\naliases: Gino, gino@trattoria.test\ncategory: people\n---\nRuns Trattoria Gino on Alder St.\n', 'gino-fenoglio.md'),
    page('---\ntitle: Apogee\naliases: $APO\n---\nAxel Rook\'s rocket company. On day 10 the rocket breaks apart.\n', 'apogee.md'),
  ];
  it('finds a page by alias and reads it', () => {
    expect(searchWiki('who is gino', 1, pages)).toMatch(/^\[Gino Fenoglio\]/);
    expect(readPage('gino@trattoria.test', 1, pages)).toContain('Alder St');
    expect(readPage('nobody', 1, pages)).toMatch(/^No page/);
  });
  it('search never finds what is still hidden', () => {
    expect(searchWiki('rocket breaks apart', 3, pages)).not.toMatch(/breaks apart/);
    expect(searchWiki('banana', 3, pages)).toMatch(/^Nothing found/);
  });
});

describe("the player's screens", () => {
  const view = {
    day: 2, time: '11:00 AM',
    wallet: { dolr: 88.5, followers: 14, model: 1, rent: { day: 7, amount: 350 } },
    tx: [{ day: 1, amount: -0.6, memo: 'agent.chat' }],
    mail: [{ folder: 'inbox', day: 2, from: 'Gino', addr: 'gino@trattoria.test', subject: 'Menu', body: 'New prices.' }],
    y: [{ day: 2, author: 'You', handle: 'you', text: 'hello', mine: true }, { day: 1, author: 'Mara Vey', handle: 'mara_vey', text: 'Tell me your story.' }],
    yowl: [], citypulse: [], apps: [],
  };
  it('reads mail, posts and the wallet', () => {
    expect(readSite(view, 'qmail')).toContain('FROM Gino');
    expect(readSite(view, 'y', 'mara')).toContain('Tell me your story.');
    expect(readSite(view, 'y', 'mara')).not.toContain('hello');
    expect(readSite(view, 'coinbin')).toContain('Rent of 350 DOLR is due on day 7');
    expect(readSite(view, 'forkyard')).toMatch(/no repos/);
    expect(readSite(null, 'qmail')).toMatch(/could not be read/);
  });
});

describe('the real wiki', () => {
  const wiki = loadWiki();
  it('has pages, each with a title and a known category', () => {
    expect(wiki.length).toBeGreaterThan(20);
    const cats = new Set(['people', 'family', 'companies', 'sites', 'apps', 'world', 'days', 'writers']);
    for (const p of wiki) {
      expect(p.title, p.file).toBeTruthy();
      expect(cats.has(p.category), `${p.file}: ${p.category}`).toBe(true);
    }
  });

  it('lists every page in the index', () => {
    const index = wiki.find((p) => p.file === 'index.md');
    expect(index).toBeTruthy();
    const text = index.sections.map((s) => s.text).join('\n');
    for (const p of wiki) if (p.file !== 'index.md') expect(text, p.file).toContain(p.file);
  });

  it('has a page for every day', () => {
    for (let d = 1; d <= 21; d++) expect(wiki.some((p) => p.category === 'days' && p.from === d), `day ${d}`).toBe(true);
  });

  // what Haiku could ever be shown on each day, at the very end of it, on any branch
  const shown = (day, flags = []) => wiki.map((p) => visiblePage(p, context(day, 22 * 60, flags))).join('\n');

  it('never shows writer material, code paths or hidden meters', () => {
    for (const day of [1, 7, 14, 21]) {
      const t = shown(day);
      expect(t).not.toMatch(/\[(planned|open|legacy|canon)|Thomas|Jev\b|Gemma|South Park|\.json\b|\.ts\b|app\/|Writer notes/);
      expect(t).not.toMatch(/\b(family trust|suspicion|misuse|leash|heritageStanding|progressStanding|nullStanding|mafiaStanding)\b/i);
    }
  });

  it('never shows a later day or a model before its rollout', () => {
    const later = (t, day) => [...t.matchAll(/\bdays?\s+(\d+)\b/gi)].filter((m) => +m[1] > day);
    for (let day = 1; day <= 20; day++) {
      const t = shown(day);
      // "[known]" advance knowledge is the one exception: rent days
      const leaks = later(t.split('\n').filter((l) => !/\brent\b/i.test(l)).join('\n'), day);
      expect(leaks.map((m) => m.input.slice(Math.max(0, m.index - 60), m.index + 40)), `day ${day}`).toEqual([]);
      for (const [lvl, from] of [[2, 4], [3, 9], [4, 14], [5, 18]]) if (day < from) expect(t, `agent-${lvl} on day ${day}`).not.toContain(`agent-${lvl}`);
    }
  });

  it('never shows an ending', () => {
    const t = shown(21);
    expect(t).not.toMatch(/Got Away With It|Clean but Modest|Open Weights ending|The Regime ending|Botnet ending/i);
  });

  it('tool calls answer with what was found', () => {
    expect(runQueryTool('search_wiki', { query: 'Gino' }, context(1, 600), null)).toMatch(/Gino/);
    expect(runQueryTool('nope', {}, context(1), null)).toMatch(/Unknown tool/);
  });
});
