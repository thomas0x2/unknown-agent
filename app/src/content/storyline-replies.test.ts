/*
 * Storyline replies: when a reply lands a storyline outcome, the answer is scripted (never the local
 * model). Max Stryker's EMPIRE hands over a sign-up link; paying happens on empire.alphaascend.biz.
 */
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { replyToEvent, composeEmail, joinEmpire, EMPIRE } from '../engine/actions';
import { offlineJev } from '../engine/jev';
import type { Writer } from '../engine/writer';
import { clone, deliverPendingMail, tick } from '../engine/core';
import type { GameState } from '../engine/state';

const content = loadContent();
/** Let enough game time pass for every reply on its way to arrive. */
const later = (s0: GameState) => { const s = clone(s0); s.clockMin += 12 * 60; deliverPendingMail(s); return s; };
const noLlm: Writer = { write: async () => { throw new Error('storyline replies must not reach the model'); } };

describe('EMPIRE', () => {
  it('replying EMPIRE gets the scripted reply with the sign-up link, and charges nothing yet', async () => {
    const s = startGame(content, 3);
    const r = await replyToEvent(s, content, offlineJev, 'd1_guru', 'Empire', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'interested' });
    expect(r.reply).toContain('empire.alphaascend.biz');
    const mail = later(r.state).mail.filter((m) => m.folder === 'inbox' && m.addr === EMPIRE.addr);
    expect(mail.at(-1)?.body).toBe(r.reply);
    expect(mail.at(-1)?.generated).toBeFalsy();
    expect(r.state.values.crypto).toBe(s.values.crypto);
  });

  it('signing up on the page costs 20 DOLR once and starts the newsletter', () => {
    const s = startGame(content, 3);
    const a = joinEmpire(s);
    expect(a.values.crypto).toBe(s.values.crypto - 20);
    expect(a.flags).toContain('guru_subscriber');
    expect(a.tx.at(-1)).toMatchObject({ amount: -20 });
    expect(joinEmpire(a).values.crypto).toBe(a.values.crypto);
  });

  it("can't sign up without 20 DOLR", () => {
    const s = startGame(content, 3);
    s.values.crypto = 5;
    expect(joinEmpire(s).flags).not.toContain('guru_subscriber');
  });
});

describe('Gino (restaurant lead)', () => {
  it('offering to create the website lands the gig with a scripted reply that carries the brief', async () => {
    const s = startGame(content, 3);
    const r = await composeEmail(s, content, offlineJev, 'gino@trattoria.test', 'Hi Gino, I could create the website for you.', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'offer' });
    expect(r.reply).toContain('Perfect. Looking forward to it.');
    expect(r.reply).toContain('Margherita 12');
    expect(r.state.apps.some((a) => a.clientEventId === 'restaurant_contact')).toBe(true);
  });

  it('a vague email still gets an answer from Gino in the inbox', async () => {
    const s = startGame(content, 3);
    const r = await composeEmail(s, content, offlineJev, 'gino@trattoria.test', 'Hello, nice restaurant.');
    expect(r.reply).not.toBe('');
    expect(later(r.state).mail.some((m) => m.folder === 'inbox' && m.addr === 'gino@trattoria.test')).toBe(true);
  });
});

describe('Gary (landlord)', () => {
  const gary = 'gary@pruittproperty.test';
  for (const ask of ['Can I pay you some other way?', 'Could we do the rent in installments?', 'Can I pay a bit later this month?', 'Would you take 200 instead of 350?']) {
    it(`answers "${ask}" with a scripted No.`, async () => {
      const r = await composeEmail(startGame(content, 3), content, offlineJev, gary, ask, noLlm);
      expect(r.reply).toBe('No.');
    });
  }

  it('anything else still gets his usual voice', async () => {
    const r = await composeEmail(startGame(content, 3), content, offlineJev, gary, 'The sink is leaking again.');
    expect(r.reply).not.toBe('No.');
  });
});

describe('inbox order', () => {
  it('numbers deliveries and mail in the order they arrive', async () => {
    const s = startGame(content, 3);
    const r = await replyToEvent(s, content, offlineJev, 'd1_guru', 'Empire', noLlm);
    const t = later(r.state);
    const seqs = [...t.delivered.map((d) => d.seq!), ...t.mail.map((m) => m.seq!)];
    expect(seqs.every((n) => typeof n === 'number')).toBe(true);
    expect(new Set(seqs).size).toBe(seqs.length);
    const reply = t.mail.find((m) => m.folder === 'inbox' && m.addr === EMPIRE.addr)!;
    expect(reply.seq!).toBeGreaterThan(t.delivered.find((d) => d.eventId === 'd1_guru')!.seq!);
  });
});

describe('Mom', () => {
  it('sends 20 DOLR when asked for money', async () => {
    const s = startGame(content, 3);
    const r = await replyToEvent(s, content, offlineJev, 'd1_mom', 'Mom, could you send me some money?', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'money' });
    expect(r.state.values.crypto).toBe(s.values.crypto + 20);
  });
});

describe('reply times', () => {
  const inboxFrom = (s: GameState, addr: string) => s.mail.filter((m) => m.folder === 'inbox' && m.addr === addr);
  const after = (s0: GameState, actions: number) => { const s = clone(s0); for (let i = 0; i < actions; i++) tick(s); return s; };

  it('Mom answers after the next action, not straight away', async () => {
    const r = await replyToEvent(startGame(content, 3), content, offlineJev, 'd1_mom', "I'm okay, mom, don't worry.", noLlm);
    expect(inboxFrom(r.state, 'mom@family.test').filter((m) => m.subject.startsWith('RE:'))).toHaveLength(0);
    expect(inboxFrom(after(r.state, 1), 'mom@family.test').some((m) => m.subject.startsWith('RE:'))).toBe(true);
  });

  it('Gary takes longer than Mom, except for a flat No.', async () => {
    const gary = 'gary@pruittproperty.test';
    const sink = await composeEmail(startGame(content, 3), content, offlineJev, gary, 'The sink is leaking again.');
    expect(inboxFrom(after(sink.state, 2), gary).filter((m) => m.subject.startsWith('RE:'))).toHaveLength(0);
    expect(inboxFrom(later(sink.state), gary).some((m) => m.subject.startsWith('RE:'))).toBe(true);
    const no = await composeEmail(startGame(content, 3), content, offlineJev, gary, 'Could we do the rent in installments?', noLlm);
    expect(inboxFrom(after(no.state, 1), gary).at(-1)?.body).toBe('No.');
  });

  it('a reply still on its way at bedtime arrives the next morning', async () => {
    const s = startGame(content, 3);
    s.clockMin = 23 * 60 + 30;
    const r = await composeEmail(s, content, offlineJev, 'bro@family.test', 'hey');
    const next = endDay(r.state, content);
    const reply = inboxFrom(next, 'bro@family.test').find((m) => m.subject.startsWith('RE:'));
    expect(reply?.day).toBe(2);
  });
});
