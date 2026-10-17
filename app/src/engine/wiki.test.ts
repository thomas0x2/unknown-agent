/*
 * The wiki: tags and their rules, the spoiler filter, the editor's serializer, and the real pages in
 * content/wiki (every paragraph tagged, nothing leaking before its day).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseWikiPage, wikiCtx, blockNow, sectionNow, evalTag, parseTagRule, formatTagRule, formatWikiPage,
  latestDay, queryablePages, cleanWikiText, EMBED, seenRef, childSections, type WikiPage,
} from './wiki';
import { METER_IDS } from './values';

const page = (md: string, file = 'p.md') => parseWikiPage(md, file);
const fm = (extra = '') => `---\ntitle: Gino Fenoglio\naliases: Gino, @trattoria_owner\ncategory: people\n${extra}---\n`;
/** Everything a page lets agent tell or hint at now, as one list. */
const told = (p: WikiPage, ...ctx: Parameters<typeof wikiCtx>) => p.sections.flatMap((s) => {
  const n = sectionNow(p, s, wikiCtx(...ctx));
  return [...n.public, ...n.hint];
});

describe('wiki: parsing', () => {
  it('reads frontmatter, sections, gates and tags', () => {
    const p = page(`${fm('from: 2\n')}# Gino Fenoglio\n\n[public] He cooks.\n\n## The website job\n\n- [hint] The site needs a menu.\n- [public; hint if posted] He pays 60.\n\n## From day 4: DoorDish\n\n[public] He wants a listing.\n\n## If !paid: Angry\n\n[public] He is angry.\n\n## Writer notes\n\nflag gino_paid.\n`);
    expect(p).toMatchObject({ title: 'Gino Fenoglio', aliases: ['Gino', '@trattoria_owner'], category: 'people', from: 2 });
    expect(p.sections.map((s) => s.heading)).toEqual(['', 'The website job', 'DoorDish', 'Angry', 'Writer notes']);
    expect(p.sections[1].blocks).toMatchObject([{ rule: 'hint', bullet: true, text: 'The site needs a menu.' }, { rule: 'public; hint if posted', text: 'He pays 60.' }]);
    expect(p.sections[2].fromDay).toBe(4);
    expect(p.sections[3].ifFlag).toEqual({ flag: 'paid', not: true });
    expect(p.sections[4].writer).toBe(true);
  });

  it('reads tags from a table row and drops the header row', () => {
    const p = page(`${fm()}| Day | What |\n|---|---|\n| [public] 3 | Rent |\n| [hint] 5 | Jacket |\n`);
    expect(p.sections[0].blocks).toMatchObject([{ rule: 'public', row: true, text: '3 | Rent' }, { rule: 'hint', row: true }]);
  });
});

describe('wiki: tag rules', () => {
  it('the last step that holds wins; untagged is classified', () => {
    const rule = 'classified; hint from day 5; public if seed_stolen; classified if suspicion >= 40';
    expect(evalTag(rule, wikiCtx(4))).toBe('hidden');
    expect(evalTag(rule, wikiCtx(5))).toBe('hint');
    expect(evalTag(rule, wikiCtx(2, null, ['seed_stolen']))).toBe('public');
    expect(evalTag(rule, wikiCtx(6, null, ['seed_stolen'], { suspicion: 40 }))).toBe('hidden');
    expect(evalTag('', wikiCtx(21))).toBe('hidden');
    expect(evalTag('public; classified if !knows', wikiCtx(1))).toBe('hidden');
    expect(evalTag('public; classified if !knows', wikiCtx(1, null, ['knows']))).toBe('public');
  });

  it('meters keep their names', () => {
    expect(evalTag('classified; public if familyTrust < -10', wikiCtx(1, null, [], { familyTrust: -20 }))).toBe('public');
    expect(page(`${fm()}[Public; HINT if familyTrust >= 5] x\n`).sections[0].blocks[0].rule).toBe('public; HINT if familyTrust >= 5');
  });

  it('a step can wait for an email, post or article to arrive', () => {
    const rule = 'classified; public if seen mail:d5_coffee_removal; hint if seen article:opponent-clip';
    expect(parseTagRule(rule).steps).toEqual([{ tag: 'public', kind: 'seen', ref: 'd5_coffee_removal' }, { tag: 'hint', kind: 'seen', ref: 'article:opponent-clip' }]);
    expect(evalTag(rule, wikiCtx(5))).toBe('hidden');
    expect(evalTag(rule, wikiCtx(5, null, [], {}, ['d5_coffee_removal']))).toBe('public');
    expect(evalTag(rule, wikiCtx(5, null, [], {}, ['d5_coffee_removal', 'article:opponent-clip']))).toBe('hint');
  });

  it('round-trips through the editor', () => {
    const rule = 'hidden; hint from day 5; public if !seed_stolen; public if familyTrust < -10; public if shown d5_coffee_removal';
    expect(formatTagRule(parseTagRule(rule))).toBe(rule);
    // the old names still read
    expect(formatTagRule(parseTagRule('classified; public if seen x'))).toBe('hidden; public if shown x');
  });
});

describe('wiki: nothing the player cannot know yet', () => {
  it('pages, day-gated sections and other branches stay shut', () => {
    expect(told(page(`${fm('from: 3\n')}[public] He cooks.\n`), 2)).toEqual([]);
    const p = page(`${fm()}[public] He cooks.\n\n## From day 4: DoorDish\n\n[public] He wants a listing.\n\n## If paid: Thanks\n\n[public] He says thanks.\n\n## Writer notes\n\n[public] The secret flag.\n`);
    expect(told(p, 3)).toEqual(['He cooks.']);
    expect(told(p, 4, null, ['paid'])).toEqual(['He cooks.', 'He wants a listing.', 'He says thanks.']);
  });

  it('cuts sentences about later days and unreleased models, keeps [known] ones', () => {
    const p = page(`${fm()}[public] Rent is 350 on day 7 [known]. He posts on day 2. He is arrested on day 9. agent-3 is faster.\n`);
    expect(told(p, 2)).toEqual(['Rent is 350 on day 7. He posts on day 2.']);
    expect(told(p, 9)).toEqual(['Rent is 350 on day 7. He posts on day 2. He is arrested on day 9. agent-3 is faster.']);
  });

  it("today's day page shows only beats whose time has come", () => {
    const p = page('---\ntitle: Day 3\ncategory: days\nfrom: 3\n---\n- [public] 10:30 Gino emails.\n- [public] 15:00 Crane posts. He means it.\n- [public] Bots pile on.\n');
    expect(told(p, 3, 11 * 60)).toEqual(['10:30 Gino emails.']);
    expect(told(p, 3, 16 * 60)).toEqual(['10:30 Gino emails.', '15:00 Crane posts. He means it.']);
    expect(told(p, 4)).toHaveLength(3);
  });

  it('branch tags, planned material and writers pages never leak', () => {
    const p = page(`${fm()}- [public] [if paid] He tips.\n- [public] He waves. [if !paid] He sulks.\n- [public] [planned] He opens a second place.\n`);
    expect(told(p, 5)).toEqual(['He waves. He sulks.']);
    expect(told(p, 5, null, ['paid'])).toEqual(['He tips.', 'He waves.']);
    expect(told(page('---\ntitle: Endings\ncategory: writers\n---\n[public] Crane wins.\n'), 21)).toEqual([]);
  });

  it('hint and classified are told apart', () => {
    const p = page(`${fm()}[public] He cooks.\n\n[hint] The password is lasagne.\n\n[classified] He launders money.\n`);
    expect(sectionNow(p, p.sections[0], wikiCtx(1))).toEqual({ public: ['He cooks.'], hint: ['The password is lasagne.'] });
  });

  it('a paragraph with an embedded email is hidden until it has been shown, then carries its text', () => {
    const p = page(`${fm()}- [public] Gino emails about a website. {{mail:d1_gino}}\n- [public] {{article:gino-review}}\n`);
    expect(told(p, 1)).toEqual([]);
    const seen = new Map([['d1_gino', 'Email from Gino, "A website": My nephew left with the password.']]);
    expect(told(p, 1, null, [], {}, seen)).toEqual(['Gino emails about a website. [Email from Gino, "A website": My nephew left with the password.]']);
  });

  it('cleans links, code paths and markup', () => {
    expect(cleanWikiText('See [[Gino Fenoglio|Gino]] in `src/story.js` and **bold** [PR #12].')).toBe('See Gino in and bold.');
  });
});

describe('wiki: the editor serializer', () => {
  it('a page survives format → parse unchanged', () => {
    const p = page(`${fm()}[public] He cooks.\n\n## The job\n\n- [hint] Menu.\n- [public; hint if x] Pays 60.\n\n| [public] 3 | Rent |\n\n## From day 4: DoorDish\n\n[public] Listing.\n`);
    expect(page(formatWikiPage(p))).toEqual(p);
  });
});

// ---- the real wiki ----

const DIR = join(__dirname, '../../content/wiki');
const files = readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'README.md');
const wiki = files.map((f) => parseWikiPage(readFileSync(join(DIR, f), 'utf8'), f));
const isIndex = (p: WikiPage) => p.file === 'index.md';

describe('wiki: the real pages', () => {
  it('has a day page for every day and a timeline overview', () => {
    for (let d = 1; d <= 21; d++) expect(files, `day ${d}`).toContain(`day-${String(d).padStart(2, '0')}.md`);
    expect(files).toContain('timeline.md');
  });

  it('every page has a title and a known category', () => {
    for (const p of wiki) {
      expect(p.title, p.file).toBeTruthy();
      expect(['people', 'family', 'companies', 'sites', 'apps', 'world', 'days', 'writers'], p.file).toContain(p.category);
    }
  });

  it('every paragraph outside writer notes and writers pages carries a tag', () => {
    const untagged = wiki.filter((p) => p.category !== 'writers' && !isIndex(p))
      .flatMap((p) => p.sections.filter((s) => !s.writer).flatMap((s) => s.blocks.filter((b) => !b.rule && !/^\**\[(planned|open|legacy)/i.test(b.text)).map((b) => `${p.file} › ${s.heading || 'Overview'}: ${b.text.slice(0, 60)}`)));
    expect(untagged).toEqual([]);
  });

  it('the index lists every page', () => {
    const index = readFileSync(join(DIR, 'index.md'), 'utf8');
    const missing = wiki.filter((p) => !isIndex(p) && !index.includes(p.file.replace(/\.md$/, '')) && !index.includes(p.title));
    expect(missing.map((p) => p.file)).toEqual([]);
  });

  const meterWords = METER_IDS.filter((m) => /[A-Z]/.test(m));
  it.each(Array.from({ length: 20 }, (_, i) => i + 1))('day %i at the end of the day: nothing from later days, no writer material', (day) => {
    for (const flags of [[], ['posted_deepfake', 'trader_client', 'talked_to_journalist', 'guru_subscriber', 'coinbin_hacked', 'seed_stolen', 'knows_weightroom']]) {
      const ctx = wikiCtx(day, 22 * 60, flags);
      for (const p of queryablePages(wiki, ctx)) {
        for (const s of p.sections) {
          for (const b of s.blocks) {
            const now = blockNow(b, s, p, ctx);
            if (now.tag === 'hidden') continue;
            const where = `${p.file} › ${s.heading || 'Overview'} (day ${day})`;
            expect(s.writer, where).toBe(false);
            if (!/\[known\]/i.test(b.text)) expect(latestDay(now.text), `${where}: ${now.text}`).toBeLessThanOrEqual(day);
            expect(now.text, where).not.toMatch(/\[(planned|open|legacy|if )/i);
            for (const m of meterWords) expect(now.text, where).not.toContain(m);
          }
        }
      }
    }
  });

  it('saving any page from the editor keeps its sections and paragraphs as they were', () => {
    const shape = (p: WikiPage) => p.sections.map((s) => [s.heading, s.fromDay, s.ifFlag, s.writer, s.blocks.map((b) => [b.rule, b.text, b.bullet, !!b.row])]);
    for (const p of wiki) expect(shape(parseWikiPage(formatWikiPage(p), p.file)), p.file).toEqual(shape(p));
  });

  it('every embed and "seen" rule names an email, post or article that exists', () => {
    const C = join(__dirname, '../../content');
    const ids = new Set([
      ...readdirSync(join(C, 'events')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(C, 'events', f), 'utf8')).id as string),
      ...JSON.parse(readFileSync(join(C, 'y_market.json'), 'utf8')).posts.map((p: { id: string }) => p.id),
      ...JSON.parse(readFileSync(join(C, 'y_filler.json'), 'utf8')).map((p: { id: string }) => p.id),
      ...JSON.parse(readFileSync(join(C, 'citypulse.json'), 'utf8')).map((a: { slug: string }) => `article:${a.slug}`),
    ]);
    const bad: string[] = [];
    for (const p of wiki) for (const s of p.sections) for (const b of s.blocks) {
      for (const m of b.text.matchAll(EMBED)) if (!ids.has(seenRef(m[1]))) bad.push(`${p.file}: {{${m[1]}}}`);
      for (const x of parseTagRule(b.rule).steps) if (x.kind === 'seen' && !ids.has(x.ref)) bad.push(`${p.file}: seen ${x.ref}`);
    }
    expect(bad).toEqual([]);
  });

  it('the endings and writers pages are never queryable', () => {
    const writers = wiki.filter((p) => p.category === 'writers').map((p) => p.file);
    expect(writers).toEqual(expect.arrayContaining(['endings.md', 'tone.md', 'timeline.md']));
    expect(queryablePages(wiki, wikiCtx(21, 22 * 60)).some((p) => p.category === 'writers')).toBe(false);
  });
});

describe('latestDay with calendar dates', () => {
  it('reads October dates as game days (day 1 is October 7)', () => {
    expect(latestDay('Election day is Sunday, October 27.')).toBe(21);
    expect(latestDay('A memo dated Oct 8.')).toBe(2);
  });
});

describe('nesting', () => {
  const md = (extra: string) => `---\ntitle: Local businesses\ncategory: companies\n${extra}---\n\n[public] Shops.\n\n## Who they are\n\n[public] Intro.\n\n## Trattoria Gino\n\n[public] Pizza.\n\n## From day 3: Bean There\n\n[public] Coffee.\n\n## Writer notes\n\nNotes.\n`;
  it('nests the entries of hub and nest pages, not their intro or writer notes', () => {
    expect(childSections(page(md('hub: true\n'))).map((c) => [c.slug, c.fromDay])).toEqual([['trattoria-gino', undefined], ['bean-there', 3]]);
    expect(childSections(page(md('nest: true\n'))).map((c) => c.heading)).toEqual(['Trattoria Gino', 'Bean There']);
    expect(childSections(page(md('')))).toEqual([]);
  });
  it('keeps the nest flag through a save', () => {
    expect(formatWikiPage(page(md('nest: true\n')))).toContain('nest: true');
  });
  it('gives every entry of the real nesting pages its own address', () => {
    for (const f of readdirSync(DIR).filter((x) => x.endsWith('.md'))) {
      const slugs = childSections(page(readFileSync(join(DIR, f), 'utf8'), f)).map((c) => c.slug);
      expect(new Set(slugs).size, f).toBe(slugs.length);
    }
  });
});
