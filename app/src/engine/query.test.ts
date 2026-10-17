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
