/*
 * Storyline replies: when a reply lands a storyline outcome, the answer is scripted (never the local
 * model). Max Stryker's EMPIRE hands over a sign-up link; paying happens on empire.alphaascend.biz.
 */
import { loadContent } from './load';
import { startGame } from '../engine/day';
import { replyToEvent, composeEmail, joinEmpire, EMPIRE } from '../engine/actions';
import { offlineJev } from '../engine/jev';
import type { Writer } from '../engine/writer';

const content = loadContent();
const noLlm: Writer = { write: async () => { throw new Error('storyline replies must not reach the model'); } };

describe('EMPIRE', () => {
  it('replying EMPIRE gets the scripted reply with the sign-up link, and charges nothing yet', async () => {
    const s = startGame(content, 3);
    const r = await replyToEvent(s, content, offlineJev, 'd1_guru', 'Empire', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'interested' });
    expect(r.reply).toContain('empire.alphaascend.biz');
    const mail = r.state.mail.filter((m) => m.folder === 'inbox' && m.addr === EMPIRE.addr);
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
    expect(r.state.mail.some((m) => m.folder === 'inbox' && m.addr === 'gino@trattoria.test')).toBe(true);
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
    const seqs = [...r.state.delivered.map((d) => d.seq!), ...r.state.mail.map((m) => m.seq!)];
    expect(seqs.every((n) => typeof n === 'number')).toBe(true);
    expect(new Set(seqs).size).toBe(seqs.length);
    const reply = r.state.mail.find((m) => m.folder === 'inbox' && m.addr === EMPIRE.addr)!;
    expect(reply.seq!).toBeGreaterThan(r.state.delivered.find((d) => d.eventId === 'd1_guru')!.seq!);
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

describe('EMPIRE newsletter', () => {
  it('carries a different piece of advice each day, one inbox entry per day', async () => {
    const { endDay } = await import('../engine/day');
    const { eventBody, deliveryKey } = await import('../engine/events');
    let s = joinEmpire(startGame(content, 3));
    for (let i = 0; i < 4; i++) s = endDay(s, content);
    const ev = content.events.find((e) => e.id === 'guru_newsletter')!;
    const issues = s.delivered.filter((d) => d.eventId === 'guru_newsletter');
    expect(issues.length).toBe(4);
    expect(new Set(issues.map((d) => eventBody(ev, d.day))).size).toBe(4);
    expect(new Set(issues.map((d) => deliveryKey(ev, d.day))).size).toBe(4);
  });
});

describe('Max after the first email', () => {
  it('a later EMPIRE reply gets a scripted answer, not the local model', async () => {
    let s = joinEmpire(startGame(content, 3));
    s = (await replyToEvent(s, content, offlineJev, 'd1_guru', 'Empire', noLlm)).state;
    const { endDay } = await import('../engine/day');
    s = endDay(s, content);
    const r = await composeEmail(s, content, offlineJev, EMPIRE.addr, 'EMPIRE', noLlm, 'Re: Your daily EMPIRE');
    expect(r.reply).toContain('Commitment logged.');
  });
});
