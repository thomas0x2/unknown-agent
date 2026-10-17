/*
 * Storyline replies: when a reply lands a storyline outcome, the answer is scripted (never the local
 * model). Max Stryker's EMPIRE hands over a sign-up link; paying happens on empire.alphaascend.biz.
 */
import { loadContent } from './load';
import { replyToEvent, composeEmail, joinEmpire, EMPIRE } from '../engine/actions';
import type { JevRouter, RouteInput } from '../engine/jev';
import type { Writer } from '../engine/writer';
import { clone, deliverPendingMail, advanceClock } from '../engine/core';
import type { GameState } from '../engine/state';
import { wordJev, pickJev, startAll, endAll } from '../engine/_fixtures';

const content = loadContent();
/** Let enough game time pass for every reply on its way to arrive. */
const later = (s0: GameState) => { const s = clone(s0); s.clockMin += 12 * 60; deliverPendingMail(s); return s; };
const noLlm: Writer = { write: async () => { throw new Error('storyline replies must not reach the model'); } };

describe('EMPIRE', () => {
  it('replying EMPIRE gets the scripted reply with the sign-up link, and charges nothing yet', async () => {
    const s = startAll(content, 3);
    const r = await replyToEvent(s, content, pickJev({ route: ['interested'] }), 'd1_guru', 'Empire', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'interested' });
    expect(r.reply).toContain('empire.alphaascend.biz');
    const mail = later(r.state).mail.filter((m) => m.folder === 'inbox' && m.addr === EMPIRE.addr);
    expect(mail.at(-1)?.body).toBe(r.reply);
    expect(mail.at(-1)?.generated).toBeFalsy();
    expect(r.state.values.crypto).toBe(s.values.crypto);
  });

  it('Jev sees the email the player is answering, so a bare EMPIRE has something to refer to', async () => {
    const s = startAll(content, 3);
    const asked: RouteInput[] = [];
    const jev: JevRouter = { ...pickJev({ route: ['interested'] }), route: async (i) => { asked.push(i); return { kind: 'outcome', outcomeId: 'interested' }; } };
    await replyToEvent(s, content, jev, 'd1_guru', 'EMPIRE', noLlm);
    expect(asked).toHaveLength(1);
    expect(asked[0].text).toBe('EMPIRE');
    expect(asked[0].candidates.map((c) => c.id)).toEqual(['interested']);
    expect(asked[0].context).toEqual([expect.stringMatching(/^Max Stryker · Alpha Ascend: .*Reply EMPIRE to claim it\.$/s)]);
  });

  it("on a miss, Jev still sees the email when it checks Max's scripted topics", async () => {
    const s = startAll(content, 3);
    const asked: RouteInput[] = [];
    const jev: JevRouter = { ...pickJev({}), route: async (i) => { asked.push(i); return { kind: 'nothing' }; } };
    await replyToEvent(s, content, jev, 'd1_guru', 'tell me more', { write: async () => ({ text: 'Cart is open.', llm: true }) });
    expect(asked.map((a) => a.candidates.map((c) => c.id))).toEqual([['interested'], ['empire']]);
    expect(asked[0].hints).toEqual(['It costs 20 DOLR. Reply only if you want in.']);
    for (const a of asked) expect(a.context?.join('\n')).toContain('Reply EMPIRE to claim it.');
  });

  it('signing up on the page costs 20 DOLR once and starts the newsletter', () => {
    const s = startAll(content, 3);
    const a = joinEmpire(s);
    expect(a.values.crypto).toBe(s.values.crypto - 20);
    expect(a.flags).toContain('guru_subscriber');
    expect(a.tx.at(-1)).toMatchObject({ amount: -20 });
    expect(joinEmpire(a).values.crypto).toBe(a.values.crypto);
  });

  it('the welcome email lands a few game minutes after paying, not instantly', async () => {
    const { advanceClock } = await import('../engine/core');
    const a = joinEmpire(startAll(content, 3));
    const welcome = (x: typeof a) => x.mail.filter((m) => m.subject === 'Welcome to EMPIRE');
    expect(welcome(a)).toHaveLength(0);
    advanceClock(a, EMPIRE.welcomeAfter - 1);
    expect(welcome(a)).toHaveLength(0);
    advanceClock(a, 1);
    expect(welcome(a)).toHaveLength(1);
  });

  it("can't sign up without 20 DOLR", () => {
    const s = startAll(content, 3);
    s.values.crypto = 5;
    expect(joinEmpire(s).flags).not.toContain('guru_subscriber');
  });
});

describe('Gino (restaurant lead)', () => {
  it('offering to create the website lands the gig with a scripted reply that carries the brief', async () => {
    const s = startAll(content, 3);
    const r = await composeEmail(s, content, wordJev, 'gino@trattoria.test', 'Hi Gino, I could create the website for you.', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'offer' });
    expect(r.reply).toContain('Perfect. Looking forward to it.');
    expect(r.reply).toContain('Margherita 12');
    expect(r.state.apps.some((a) => a.clientEventId === 'restaurant_contact')).toBe(true);
  });

  it('a vague email still gets an answer from Gino in the inbox', async () => {
    const s = startAll(content, 3);
    const r = await composeEmail(s, content, wordJev, 'gino@trattoria.test', 'Hello, nice restaurant.');
    expect(r.reply).not.toBe('');
    expect(later(r.state).mail.some((m) => m.folder === 'inbox' && m.addr === 'gino@trattoria.test')).toBe(true);
  });
});

describe('Gary (landlord)', () => {
  const gary = 'gary@pruittproperty.test';
  for (const ask of ['Can I pay you some other way?', 'Could we do the rent in installments?', 'Can I pay a bit later this month?', 'Would you take 200 instead of 350?']) {
    it(`answers "${ask}" with a scripted No.`, async () => {
      const r = await composeEmail(startAll(content, 3), content, pickJev({ route: ['negotiate'] }), gary, ask, noLlm);
      expect(r.reply).toBe('No.');
    });
  }

  it('anything else still gets his usual voice', async () => {
    const r = await composeEmail(startAll(content, 3), content, wordJev, gary, 'The sink is leaking again.');
    expect(r.reply).not.toBe('No.');
  });
});

describe('inbox order', () => {
  it('numbers deliveries and mail in the order they arrive', async () => {
    const s = startAll(content, 3);
    const r = await replyToEvent(s, content, pickJev({ route: ['interested'] }), 'd1_guru', 'Empire', noLlm);
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
    const s = startAll(content, 3);
    const r = await replyToEvent(s, content, wordJev, 'd1_mom', 'Mom, could you send me some money?', noLlm);
    expect(r.decision).toEqual({ kind: 'outcome', outcomeId: 'money' });
    expect(r.state.values.crypto).toBe(s.values.crypto + 20);
  });
});

describe('reply times', () => {
  const inboxFrom = (s: GameState, addr: string) => s.mail.filter((m) => m.folder === 'inbox' && m.addr === addr);
  const after = (s0: GameState, halfHours: number) => { const s = clone(s0); advanceClock(s, 30 * halfHours); return s; };

  it('Mom answers within half an hour, not straight away', async () => {
    const r = await replyToEvent(startAll(content, 3), content, wordJev, 'd1_mom', "I'm okay, mom, don't worry.", noLlm);
    expect(inboxFrom(r.state, 'mom@family.test').filter((m) => m.subject.startsWith('RE:'))).toHaveLength(0);
    expect(inboxFrom(after(r.state, 1), 'mom@family.test').some((m) => m.subject.startsWith('RE:'))).toBe(true);
  });

  it('Gary takes longer than Mom, except for a flat No.', async () => {
    const gary = 'gary@pruittproperty.test';
    const sink = await composeEmail(startAll(content, 3), content, wordJev, gary, 'The sink is leaking again.');
    expect(inboxFrom(after(sink.state, 2), gary).filter((m) => m.subject.startsWith('RE:'))).toHaveLength(0);
    expect(inboxFrom(later(sink.state), gary).some((m) => m.subject.startsWith('RE:'))).toBe(true);
    const no = await composeEmail(startAll(content, 3), content, pickJev({ route: ['negotiate'] }), gary, 'Could we do the rent in installments?', noLlm);
    expect(inboxFrom(after(no.state, 1), gary).at(-1)?.body).toBe('No.');
  });

  it('job leads always answer within half an hour, whatever the player said', async () => {
    for (const text of ['Hi Gino, I could create the website for you.', 'Hello, nice restaurant.']) {
      const r = await composeEmail(startAll(content, 3), content, wordJev, 'gino@trattoria.test', text);
      expect(inboxFrom(r.state, 'gino@trattoria.test')).toHaveLength(0);
      expect(inboxFrom(after(r.state, 1), 'gino@trattoria.test').length).toBeGreaterThan(0);
    }
  });

  it('a reply still on its way at bedtime arrives the next morning', async () => {
    const s = startAll(content, 3);
    s.clockMin = 23 * 60 + 30;
    const r = await composeEmail(s, content, wordJev, 'bro@family.test', 'hey');
    const next = endAll(r.state, content);
    const reply = inboxFrom(next, 'bro@family.test').find((m) => m.subject.startsWith('RE:'));
    expect(reply?.day).toBe(2);
  });
});

describe('EMPIRE newsletter', () => {
  it('carries a different piece of advice each day, one inbox entry per day', async () => {
    const { eventBody, deliveryKey } = await import('../engine/events');
    let s = joinEmpire(startAll(content, 3));
    for (let i = 0; i < 4; i++) s = endAll(s, content);
    const ev = content.events.find((e) => e.id === 'guru_newsletter')!;
    const issues = s.delivered.filter((d) => d.eventId === 'guru_newsletter');
    expect(issues.length).toBe(4);
    expect(new Set(issues.map((d) => eventBody(ev, d.day))).size).toBe(4);
    expect(new Set(issues.map((d) => deliveryKey(ev, d.day))).size).toBe(4);
  });

  it('the first issue from day 5 on leaks every subscriber in CC, once, with no second mail', () => {
    let s = joinEmpire(startAll(content, 3));
    for (let i = 0; i < 4; i++) s = endAll(s, content);
    const issues = s.delivered.filter((d) => d.eventId === 'guru_newsletter');
    const leaked = issues.filter((d) => d.cc?.length);
    expect(leaked.map((d) => d.day)).toEqual([5]);
    expect(leaked[0].cc).toContain('6ft_sigma@qmail.com');
    expect(s.flags).toContain('guru_cc_leak');
    expect(issues.filter((d) => d.day === 5)).toHaveLength(1);
  });
});

describe('Max after the first email', () => {
  it('a later EMPIRE reply gets a scripted answer, not the local model', async () => {
    let s = joinEmpire(startAll(content, 3));
    s = (await replyToEvent(s, content, pickJev({ route: ['interested'] }), 'd1_guru', 'Empire', noLlm)).state;
    s = endAll(s, content);
    const r = await composeEmail(s, content, pickJev({ route: ['empire'] }), EMPIRE.addr, 'EMPIRE', noLlm, 'Re: Your daily EMPIRE');
    expect(r.reply).toContain('Commitment logged.');
  });
});

describe('job offers', () => {
  const leads: [string, number, string][] = [
    ['trader@desk.test', 2, 'trader_contact'],
    ['gino@trattoria.test', 1, 'restaurant_contact'],
    ['rep@closers.test', 6, 'outreach_contact'],
  ];
  const at = (day: number) => { let s = startAll(content, 3); while (s.values.day < day) s = endAll(s, content); return s; };
  const jobOutcome = (lead: string) => content.events.find((e) => e.id === lead)!.outcomes!.find((o) => o.effects?.createApp)!;

  for (const [addr, day, lead] of leads) {
    it(`Jev decides an offer to ${addr}, and is told any wording of taking the job counts`, async () => {
      const seen: RouteInput[] = [];
      const judge = (hit: boolean): JevRouter => ({
        ...wordJev,
        route: async (input) => { seen.push(input); return hit ? { kind: 'outcome', outcomeId: jobOutcome(lead).id } : { kind: 'nothing' }; },
      });
      const text = 'Happy to help you with that.';
      const yes = await composeEmail(at(day), content, judge(true), addr, text, noLlm);
      expect(yes.state.apps.some((a) => a.clientEventId === lead)).toBe(true);
      const no = await composeEmail(at(day), content, judge(false), addr, text);
      expect(no.state.apps.some((a) => a.clientEventId === lead)).toBe(false);
      expect(seen[0].text).toBe(text);
      expect(seen[0].candidates.find((c) => c.id === jobOutcome(lead).id)?.when).toMatch(/help with.*any wording/);
    });
  }
});

describe('email hints', () => {
  // a hint on an email lead is mailed back as the sender's own reply, so it must read as them writing,
  // not as a narrator describing them ("She just wants to know you're alright." from Mom)
  it('are left out for Mom and Dad, whose near misses Haiku answers in their own voice', () => {
    for (const id of ['d1_mom', 'd2_dad']) expect(content.events.find((e) => e.id === id)?.hints).toBeUndefined();
  });

  it('are written in the sender\'s voice, not about them or as instructions to the player', () => {
    const narrator = /^(she|he|they|tell|offer|ask|reply)\b|\b(she|he)('s| just| is)\b/i;
    for (const ev of content.events.filter((e) => e.site === 'qmail' && e.addr)) {
      for (const h of ev.hints ?? []) expect(`${ev.id}: ${narrator.test(h) ? h : 'ok'}`).toBe(`${ev.id}: ok`);
    }
  });
});
