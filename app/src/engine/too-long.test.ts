/*
 * Emails and agent prompts over MAX_INPUT_CHARS get a scripted reply: no Jev, no Haiku.
 */
import { startGame } from './day';
import { replyToEvent, composeEmail, TOO_LONG_MAIL, TOO_LONG_PROMPT } from './actions';
import { promptCost } from './agent';
import { makeContent, promptDone } from './_fixtures';
import { noJev } from './jev';
import { MAX_INPUT_CHARS } from './config';
import type { Writer } from './writer';

const noWriter: Writer = { async write() { throw new Error('Haiku called'); } };
const wall = 'word '.repeat(Math.ceil(MAX_INPUT_CHARS / 5) + 1);
const content = makeContent({
  events: [{ id: 'mom_a', site: 'qmail', from: 'Mom', addr: 'mom@test', subject: 'Are you eating?', trigger: { dayMin: 1 }, outcomes: [{ id: 'warm', when: 'the player replies warmly', reply: 'Love you.' }] }],
  contacts: [{ key: 'gary@test', name: 'Gary', character: 'gary' }],
});

describe('input over the character cap', () => {
  it('a reply to a thread gets a scripted line from the sender', async () => {
    const out = await replyToEvent(startGame(content, 1), content, noJev, 'mom_a', wall, noWriter);
    expect(TOO_LONG_MAIL).toContain(out.reply);
    expect(out.state.delivered.find((d) => d.eventId === 'mom_a')!.answered).toBe(false);
    expect(out.state.mail.some((m) => m.folder === 'sent' && m.body === wall)).toBe(true);
  });

  it('a fresh email to a contact gets a scripted line', async () => {
    const out = await composeEmail(startGame(content, 1), content, noJev, 'gary@test', wall, noWriter, 'hi');
    expect(out.sent).toBe(true);
    expect(TOO_LONG_MAIL).toContain(out.reply);
  });

  it('an email to nobody gets no reply', async () => {
    const out = await composeEmail(startGame(content, 1), content, noJev, 'nobody@test', wall, noWriter);
    expect(out.reply).toBe('');
  });

  it('an agent prompt gets a scripted reply and is still billed', async () => {
    const s = startGame(content, 1);
    s.values.crypto = 1000;
    const r = await promptDone(s, content, noJev, wall, noWriter);
    expect(TOO_LONG_PROMPT).toContain(r.reply);
    expect(r.state.chat.at(-1)!.src).toBe('too_long');
    expect(r.state.values.crypto).toBeCloseTo(1000 - promptCost(1, wall).total, 2);
  });

  it('input at the cap still goes to Jev', async () => {
    const s = startGame(content, 1);
    await expect(promptDone(s, content, noJev, 'x'.repeat(MAX_INPUT_CHARS), noWriter)).rejects.toThrow();
  });
});
