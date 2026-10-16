import { startGame } from './day';
import { clone } from './core';
import { postToY, replyToEvent, briefBuild, briefFix } from './actions';
import { getApp } from './apps';
import { makeContent, fakeRouter } from './_fixtures';

const content = makeContent();

describe('postToY', () => {
  it('a trending reaction gains at least the floor', async () => {
    const s = startGame(content, 1);
    s.values.followers = 12;
    const r = fakeRouter({ rating: () => ({ category: 'reaction', quality: 0 }) });
    const out = await postToY(s, r, 'rent is brutal', ['rent']);
    expect(out.followerDelta).toBe(10); // floor beats 12*0.05
    expect(out.state.values.followers).toBe(22);
    expect(out.state.postsToday).toBe(1);
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

describe('offline Jev post rating', () => {
  it('counts a post as a reaction when it shares a word with a trending phrase', async () => {
    const { offlineJev } = await import('./jev');
    const r = await offlineJev.ratePost({ text: 'These AI layoffs will bite the companies', trending: ['AI layoffs', 'election candidates announced'], recentPosts: [], followers: 12 });
    expect(r.category).toBe('reaction');
    const off = await offlineJev.ratePost({ text: 'Remember to drink water today', trending: ['AI layoffs'], recentPosts: [], followers: 12 });
    expect(off.category).toBe('tip');
  });
});
