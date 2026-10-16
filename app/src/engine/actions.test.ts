import { startGame } from './day';
import { clone } from './core';
import { postToY, replyToEvent, briefBuild, briefFix, BOUNCE_ADDR } from './actions';
import { getApp } from './apps';
import { makeContent, fakeRouter } from './_fixtures';
import { noJev, JevOffline } from './jev';

const content = makeContent();

describe('postToY', () => {
  it('a trending reaction on a small account gains the jittered floor', async () => {
    const s = startGame(content, 1);
    s.values.followers = 12;
    const r = fakeRouter({ rating: () => ({ category: 'reaction', quality: 0 }) });
    const out = await postToY(s, r, 'rent is brutal', ['rent']);
    expect(out.followerDelta).toBeGreaterThanOrEqual(6); // floor 8 beats 12*0.05, ±30%
    expect(out.followerDelta).toBeLessThanOrEqual(10);
    expect(out.state.values.followers).toBe(12 + out.followerDelta);
    expect(out.state.postsToday).toBe(1);
  });

  it('the same rating does not always give the same gain', async () => {
    const r = fakeRouter({ rating: () => ({ category: 'reaction', quality: 0.5 }) });
    const gains = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = startGame(content, seed);
      s.values.followers = 12;
      gains.add((await postToY(s, r, 'crane said what', ['Crane'])).followerDelta);
    }
    expect(gains.size).toBeGreaterThan(3);
  });

  it('small accounts gain something from a good tip', async () => {
    const s = startGame(content, 1);
    s.values.followers = 12;
    const r = fakeRouter({ rating: () => ({ category: 'tip', quality: 1 }) });
    expect((await postToY(s, r, 'use a password manager', [])).followerDelta).toBeGreaterThan(0);
  });

  it('spam loses followers', async () => {
    const s = startGame(content, 1);
    s.values.followers = 200;
    const r = fakeRouter({ rating: () => ({ category: 'spam', quality: 0.1 }) });
    const out = await postToY(s, r, 'follow me', []);
    expect(out.followerDelta).toBeLessThan(0);
  });

  it('the 4th post of the day only costs followers', async () => {
    const s = startGame(content, 1);
    s.values.followers = 200;
    s.postsToday = 3;
    const r = fakeRouter({ rating: () => ({ category: 'reaction', quality: 1 }) });
    const out = await postToY(s, r, 'great take', ['x']);
    expect(out.followerDelta).toBe(-4); // 200 * -0.02
  });
});

describe('replyToEvent', () => {
  it('applies the chosen outcome and marks the thread answered', async () => {
    const s = startGame(content, 1);
    const r = fakeRouter({ route: () => ({ kind: 'outcome', outcomeId: 'warm' }) });
    const out = await replyToEvent(s, content, r, 'fam_hi', 'love you mom');
    expect(out.reply).toBe('Love you.');
    expect(out.state.values.familyTrust).toBe(65);
    expect(out.state.delivered.find((d) => d.eventId === 'fam_hi')!.answered).toBe(true);
  });

  it('returns a hint without consuming the thread', async () => {
    const s = startGame(content, 1);
    const r = fakeRouter({ route: () => ({ kind: 'hint', hintIndex: 0 }) });
    const out = await replyToEvent(s, content, r, 'fam_hi', 'hm');
    expect(out.reply).toBe('She just wants to hear from you.');
    expect(out.state.delivered.find((d) => d.eventId === 'fam_hi')!.answered).toBe(false);
  });

  it('nothing happens on an empty match', async () => {
    const s = startGame(content, 1);
    const r = fakeRouter({ route: () => ({ kind: 'nothing' }) });
    const out = await replyToEvent(s, content, r, 'fam_hi', 'asdf');
    expect(out.reply).toBe('');
    expect(out.decision.kind).toBe('nothing');
  });
});

describe('one email per person per day', () => {
  const momEvent = (id: string, dayMin: number) => ({
    id, site: 'qmail' as const, from: 'Mom', addr: 'mom@test', subject: 'Are you eating?', trigger: { dayMin },
    outcomes: [{ id: 'warm', when: 'the player replies warmly', reply: 'Love you.' }],
  });
  const mom = makeContent({ events: [momEvent('mom_a', 1), momEvent('mom_b', 99)] });

  it('bounces a second reply to the same person on the same day', async () => {
    const s = startGame(mom, 1);
    const r = fakeRouter({ route: () => ({ kind: 'nothing' }) });
    const first = await replyToEvent(s, mom, r, 'mom_a', 'hi');
    expect(first.bounced).toBeUndefined();
    const second = await replyToEvent(first.state, mom, r, 'mom_a', 'hi again');
    expect(second.bounced).toBe(true);
    expect(second.state.mail[second.state.mail.length - 1].addr).toBe(BOUNCE_ADDR);
    expect(second.state.delivered.find((d) => d.eventId === 'mom_a')!.answered).toBe(false);
  });

  it('lets the player answer a story email that arrived after their last one', async () => {
    const s = startGame(mom, 1);
    const r = fakeRouter({ route: () => ({ kind: 'outcome', outcomeId: 'warm' }) });
    const first = await replyToEvent(s, mom, r, 'mom_a', 'love you');
    const s2 = clone(first.state);
    s2.delivered.push({ eventId: 'mom_b', site: 'qmail', day: 1, seq: s2.nextId++, answered: false });
    const second = await replyToEvent(s2, mom, r, 'mom_b', 'love you too');
    expect(second.bounced).toBeUndefined();
    expect(second.reply).toBe('Love you.');
  });
});

describe('brief the agent', () => {
  it('builds the features Jev matched and charges the agent', async () => {
    const s = startGame(content, 1);
    const appId = s.apps.find((a) => a.clientEventId === 'client_shop')!.id;
    s.values.crypto = 100;
    const r = fakeRouter({ features: () => ['price_chf'] });
    const out = await briefBuild(s, content, r, appId, 'add CHF prices');
    expect(out.requested).toEqual(['price_chf']);
    expect(getApp(out.state, appId)!.repo.map((f) => f.id)).toEqual(['price_chf']);
    expect(out.state.values.crypto).toBeCloseTo(99.47, 2); // 0.5 per prompt + 0.01 × 3 prompt words
  });

  it('fixing targets the broken feature', async () => {
    const s0 = startGame(content, 1);
    const appId = s0.apps.find((a) => a.clientEventId === 'client_shop')!.id;
    const s = clone(s0);
    const app = getApp(s, appId)!;
    app.repo = app.required.map((f) => ({ id: f, correct: f !== 'catalog' }));
    app.repoVersion = 1;
    s.values.crypto = 100;
    const r = fakeRouter({ features: (_p, ids) => ids.filter((i) => i === 'catalog') });
    const out = await briefFix(s, content, r, appId, 'the catalog is empty');
    expect(out.target).toBe('catalog');
    expect(out.charged).toBe(true);
  });
});

describe('without Jev', () => {
  it('nothing is decided: the action throws JevOffline and the state is untouched', async () => {
    const s = startGame(makeContent());
    const before = JSON.stringify(s);
    await expect(postToY(s, noJev, 'These AI layoffs will bite', ['AI layoffs'])).rejects.toBeInstanceOf(JevOffline);
    expect(JSON.stringify(s)).toBe(before);
  });
});
