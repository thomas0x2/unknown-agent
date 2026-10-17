/*
 * Matchless (day 4): Derek's Y post leads to the job, his filters screen a batch of profiles every
 * day, each filter bug shows (someone let through or blocked who shouldn't be), the player accepts or
 * rejects up to 10 a day, and his filter changes land first thing in the morning and pause screening
 * until they ship.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { applyEffects } from '../engine/effects';
import { getApp, deployApp, canSee } from '../engine/apps';
import { composeEmail } from '../engine/actions';
import { isJobOffer, triggerMatches } from '../engine/events';
import { dayProfiles, screen, standardsOf, datingPick, datingPaused, picksToday, FILTERS, DAILY_PICKS } from '../engine/dating';
import { renderAppSite } from '../ui/appsite';
import { wordJev } from '../engine/_fixtures';
import { CLOCK } from '../engine/config';
import type { GameState } from '../engine/state';

const content = loadContent();
const tmpl = content.apps.dating;
const ev = (id: string) => content.events.find((e) => e.id === id)!;
const UPDATES = ['d6_dating_age', 'd9_dating_followers', 'd12_dating_distance', 'd15_dating_height'];

/** Matchless built right and live on `day`. */
function live(day: number, seed = 3): { s: GameState; id: string } {
  const s = startGame(content, seed);
  s.values.day = day;
  applyEffects(s, ev('dating_contact').outcomes![0].effects!);
  const app = s.apps.at(-1)!;
  app.repo = app.required.map((id) => ({ id, correct: true, params: app.specParams[id] }));
  app.repoVersion = 1;
  deployApp(s, app.id);
  app.features = app.repo.map((f) => ({ ...f }));
  return { s, id: app.id };
}
const withBug = (s: GameState, id: string, fid: string, bug: string) => {
  for (const list of [getApp(s, id)!.repo, getApp(s, id)!.features]) {
    const f = list.find((x) => x.id === fid)!;
    Object.assign(f, { correct: false, variant: bug });
  }
};

describe('the job', () => {
  it("Derek's day 4 post is a job offer naming his address, and agreeing by email creates Matchless", async () => {
    const post = ev('d4_y_dating');
    expect(post.trigger.dayMin).toBe(4);
    expect(isJobOffer(content, post)).toBe(true);
    const s = startGame(content, 1);
    s.values.day = 4;
    const out = await composeEmail(s, content, wordJev, 'derek@highvalue.test', "Happy to help, I can build the dating app for you.");
    const app = out.state.apps.find((a) => a.template === 'dating')!;
    expect(app.name).toBe('Matchless');
    expect(app.kind).toBe('client');
    expect(app.required).toEqual(['deck', 'filters']);
    expect(out.state.flags).toContain('dating_client');
  });
});

describe('the filters', () => {
  const specs = [ev('dating_contact').outcomes![0].effects!.createApp!.spec[1].params!, ...UPDATES.map((u) => ev(u).onDeliver!.updateApp!.add[0].params!)];

  it('every filter bug changes who gets through, every day, under every version of the filters', () => {
    for (const params of specs) {
      const std = standardsOf(params);
      for (let day = 4; day <= 21; day++) {
        const people = dayProfiles(day, std);
        const ok = screen(people, std, new Set());
        expect(ok.deck.length, `day ${day}`).toBeGreaterThanOrEqual(DAILY_PICKS);
        expect(ok.blocked.length).toBeGreaterThan(0);
        for (const f of FILTERS) {
          const leak = screen(people, std, new Set([`${f}_leak`]));
          // a leaking filter lets through someone the real filter blocks
          expect(leak.deck.length, `${f}_leak day ${day}`).toBeGreaterThan(ok.deck.length);
          const strict = screen(people, std, new Set([`${f}_strict`]));
          // a strict filter blocks someone the real filter lets through, and blames itself
          expect(strict.deck.length, `${f}_strict day ${day}`).toBeLessThan(ok.deck.length);
          expect(strict.blocked.some((b) => b.by === f && ok.deck.includes(b.p))).toBe(true);
        }
      }
    }
  });

  it('nobody under 21, and the same day always brings the same people', () => {
    const std = standardsOf(specs[0]);
    expect(dayProfiles(5, std)).toEqual(dayProfiles(5, std));
    expect(dayProfiles(5, std).every((p) => p.age >= 21)).toBe(true);
    expect(dayProfiles(5, std).map((p) => p.name)).not.toEqual(dayProfiles(6, std).map((p) => p.name));
  });

  it('every bug can be seen on a live app, and none while Derek has screening paused', () => {
    const { s, id } = live(5);
    const app = getApp(s, id)!;
    const all = tmpl.features.flatMap((f) => (f.bugs ?? []).map((b) => b.id));
    for (const b of all) expect(canSee(s, app, tmpl, b, content), b).toBe(true);
    applyEffects(s, ev('d6_dating_age').onDeliver!);
    expect(datingPaused(app)).toBe(true);
    for (const b of all) expect(canSee(s, app, tmpl, b, content), b).toBe(false);
  });
});

describe('screening', () => {
  it('accepts and rejects up to 10 a day, once each, only from the deck', () => {
    let { s, id } = live(5);
    const people = dayProfiles(5, standardsOf(getApp(s, id)!.specParams.filters));
    const { deck, blocked } = screen(people, standardsOf(getApp(s, id)!.specParams.filters), new Set());
    expect(datingPick(s, content, id, blocked[0].p.id, 'yes')).toBe(s);
    for (const p of deck.slice(0, DAILY_PICKS)) s = datingPick(s, content, id, p.id, 'yes');
    expect(picksToday(s, id)).toHaveLength(DAILY_PICKS);
    expect(datingPick(s, content, id, deck[DAILY_PICKS].id, 'no')).toBe(s);
    expect(datingPick(s, content, id, deck[0].id, 'no')).toBe(s);
    // tomorrow is a new batch and a new limit
    s.values.day = 6;
    expect(picksToday(s, id)).toHaveLength(0);
  });

  it('swapped buttons record the opposite; the double-counting limit stops at 5', () => {
    let { s, id } = live(5);
    withBug(s, id, 'deck', 'buttons_swapped');
    const deck = screen(dayProfiles(5, standardsOf(getApp(s, id)!.specParams.filters)), standardsOf(getApp(s, id)!.specParams.filters), new Set()).deck;
    s = datingPick(s, content, id, deck[0].id, 'yes');
    expect(picksToday(s, id)[0].choice).toBe('no');
    ({ s, id } = live(5));
    withBug(s, id, 'deck', 'limit_double');
    for (const p of deck) s = datingPick(s, content, id, p.id, 'no');
    expect(picksToday(s, id)).toHaveLength(5);
    expect(renderAppSite(getApp(s, id)!, tmpl, undefined, { day: 5, dating: s.dating })).toContain('Today: 10 of 10 decisions');
  });

  it('the site shows the filters, the cards and who was filtered out and why', () => {
    const { s, id } = live(5);
    const html = renderAppSite(getApp(s, id)!, tmpl, undefined, { day: 5, dating: s.dating });
    expect(html).toContain('Filters: age 21–27 · 5\'5" or under · within 3 mi · fewer than 212 Y followers');
    expect(html).toContain('Filtered out today (6)');
    expect(html).toContain('data-form="dt-pick"');
    withBug(s, id, 'filters', 'age_strict');
    expect(renderAppSite(getApp(s, id)!, tmpl, undefined, { day: 5 })).toContain('Filtered out today (7)');
  });
});

describe("Derek's filter changes", () => {
  it('each lands first thing in the morning, in order, outdates the filters and pauses screening until shipped', () => {
    const { s: s0, id } = live(5);
    s0.values.crypto = 10_000;
    s0.clockMin = CLOCK.sleep - 1;
    let s = endDay(s0, content); // payday: working, so the day 6 change is due
    expect(s.values.day).toBe(6);
    const d = s.delivered.find((x) => x.eventId === 'd6_dating_age');
    expect(d?.min).toBe(CLOCK.wake);
    const app = getApp(s, id)!;
    expect(app.specParams.filters.age).toBe('21-25');
    expect(datingPaused(app)).toBe(true);
    expect(renderAppSite(app, tmpl, undefined, { day: 6 })).toContain('Screening is paused');
    const deck = screen(dayProfiles(6, standardsOf(app.specParams.filters)), standardsOf(app.specParams.filters), new Set()).deck;
    expect(datingPick(s, content, id, deck[0].id, 'yes')).toBe(s);
    // the next change waits for this one, even on its day
    s.values.day = 9;
    expect(triggerMatches(s, ev('d12_dating_distance').trigger)).toBe(false);
    // shipping the new filters lifts the pause
    app.repo = app.required.map((fid) => ({ id: fid, correct: true, params: app.specParams[fid] }));
    app.repoVersion++;
    deployApp(s, id);
    s.values.day = 6;
    expect(datingPaused(getApp(s, id)!)).toBe(false);
    expect(datingPick(s, content, id, deck[0].id, 'yes')).not.toBe(s);
  });

  it('each change carries every earlier one', () => {
    let prev = ev('dating_contact').outcomes![0].effects!.createApp!.spec[1].params!;
    for (const u of UPDATES) {
      const next = ev(u).onDeliver!.updateApp!.add[0].params!;
      const changed = Object.keys(next).filter((k) => next[k] !== prev[k]);
      expect(changed, u).toHaveLength(1);
      prev = next;
    }
  });
});
