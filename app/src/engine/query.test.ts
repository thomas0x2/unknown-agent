/* What has reached the player, for wiki rules and embeds: delivered events, Y posts so far, live articles. */
import { startGame } from './day';
import { makeContent } from './_fixtures';
import { seenItems } from './query';
import type { GameEvent } from '../content/schema';

const mail = { id: 'q_mail', site: 'qmail', from: 'Gino', subject: 'Hi {{playerName}}', body: 'The password is gone.', trigger: { dayMin: 1 } } as unknown as GameEvent;
const post = { id: 'q_post', site: 'y', from: 'Randall Crane', body: 'Robots took your job.', trigger: { dayMin: 1 } } as unknown as GameEvent;
const content = makeContent({ events: [mail, post], yFiller: [{ id: 'fq', day: 1, from: 'doomscroll', handle: 'doomscroll', body: 'this is fine', at: '10:05' }] } as never);

describe('seenItems', () => {
  it('lists what has arrived, with its text, and nothing else', () => {
    const s = startGame(content, 1);
    s.delivered = [{ eventId: 'q_mail', site: 'qmail', day: 1, answered: false }];
    s.clockMin = 10 * 60;
    let seen = seenItems(s, content);
    expect(seen.get('q_mail')).toBe('Email from Gino, "Hi you": The password is gone.');
    expect(seen.has('q_post')).toBe(false);
    expect(seen.has('fq')).toBe(false);
    s.delivered.push({ eventId: 'q_post', site: 'y', day: 1, answered: false });
    s.clockMin = 10 * 60 + 5;
    seen = seenItems(s, content);
    expect(seen.get('q_post')).toBe('Y post by Randall Crane: Robots took your job.');
    expect(seen.get('fq')).toBe('Y post by doomscroll: this is fine');
  });
});

describe('hub pages', () => {
  it('naming one of its things is enough: its section answers, without naming the page', async () => {
    const { parseWikiPage } = await import('./wiki');
    const { matchQuery } = await import('./query');
    const hub = parseWikiPage('---\ntitle: Ad brands\naliases: ads\ncategory: companies\nhub: true\n---\n[public] Banner ads run everywhere.\n\n## LegacySEO\n\n[public] LegacySEO writes obituaries.\n\n## GriefGPT\n\n[public] GriefGPT keeps the dead texting.\n', 'ad-brands.md');
    expect(hub.hub).toBe(true);
    const asked: string[][] = [];
    const jev = {
      // Jev says yes to whatever description names LegacySEO
      matchFeatures: async (i: { features: { id: string; description: string }[] }) => { asked.push(i.features.map((f) => f.id)); return i.features.filter((f) => /LegacySEO/.test(f.description) && !f.description.startsWith('Ad brands')).map((f) => f.id); },
    } as never;
    const s = startGame(content, 1);
    const m = await matchQuery(jev, s, { ...content, wiki: [hub] }, 'what is LegacySEO?');
    expect(m).toMatchObject({ kind: 'answer', public: ['LegacySEO writes obituaries.'], where: ['Ad brands › LegacySEO'] });
    // one round: the section was matched as a topic, so no section question followed
    expect(asked).toHaveLength(1);
    expect(asked[0]).toEqual(['ad-brands.md', 'ad-brands.md#1', 'ad-brands.md#2']);
  });
});
