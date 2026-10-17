/*
 * matchless.com (day 4): the client's Y post offers the swiping, his standards get worse by email every
 * other morning, each day's ten profiles straddle them, and he pays at night only for a perfect day.
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';
import { composeEmail } from '../engine/actions';
import { isJobOffer, triggerMatches } from '../engine/events';
import { dayProfiles, standardsOf, shownAttrs, PICTURE_ATTRS, passes, meets, matchlessNow, matchlessSwipe, swipesToday, ATTRS, MATCHLESS_JOB } from '../engine/matchless';
import { bookmarks, visitedFlag, route } from '../sites/registry';
import { portraitOf } from '../ui/matchless';

const HAIR_HEX = { black: '#2a2226', brown: '#5a3e2b', blonde: '#d2b06e', red: '#a8502c', grey: '#aeaaa3' };
import { wordJev } from '../engine/_fixtures';
import { CLOCK } from '../engine/config';
import type { GameState } from '../engine/state';

const content = loadContent();
const versions = content.matchless!.versions;
const ev = (id: string) => content.events.find((e) => e.id === id)!;
const updates = content.events.filter((e) => e.id.includes('_matchless_rules_')).sort((a, b) => a.trigger.dayMin! - b.trigger.dayMin!);

/** Swiping for the client on `day` under standards version `v`. */
function hired(day: number, v = 1): GameState {
  const s = startGame(content, 5);
  s.values.day = day;
  for (let i = 1; i <= v; i++) s.flags.push(`matchless_rules_${i}`);
  s.flags.push(MATCHLESS_JOB);
  s.flags.sort();
  return s;
}
/** Swipe through the day, right on every profile unless `wrongAt` says which one to get wrong. */
function swipeAll(s: GameState, wrongAt = -1): GameState {
  const { profiles, version } = matchlessNow(s, content);
  profiles.forEach((p, i) => {
    const right = passes(standardsOf(content, version), p);
    s = matchlessSwipe(s, content, (i === wrongAt ? !right : right) ? 'yes' : 'no');
  });
  return s;
}

describe('the job', () => {
  it("the client's day 4 post links matchless.com and is a job offer; agreeing by email starts the swiping", async () => {
    const post = ev('d4_y_sigma');
    expect(post.body).toContain('matchless.com');
    expect(isJobOffer(content, post)).toBe(true);
    const s = startGame(content, 1);
    s.values.day = 4;
    const out = await composeEmail(s, content, wordJev, '6ft_sigma@qmail.com', "Count me in, I'll do the swiping on Matchless for you.");
    expect(out.state.flags).toEqual(expect.arrayContaining([MATCHLESS_JOB, 'matchless_rules_1']));
    // his reply lists the first standards
    for (const r of standardsOf(content, 1)) expect(out.reply).toContain(r.say);
  });

  it('the site exists from day 1 and is bookmarked once visited', () => {
    const s = startGame(content, 1);
    expect(route('matchless.com', s).reachable).toBe(true);
    expect(bookmarks(s).some((b) => b.id === 'matchless')).toBe(false);
    s.flags.push(visitedFlag('matchless'));
    expect(bookmarks(s).some((b) => b.id === 'matchless')).toBe(true);
  });
});

describe('his standards', () => {
  it('start with three reasonable ones and only get stricter, ending on every field and every picture trait', () => {
    expect(standardsOf(content, 1).map((r) => r.attr)).toEqual(['age', 'distance', 'smoking']);
    for (let i = 1; i < versions.length; i++) {
      const before = new Set(versions[i - 1].rules.map((r) => r.attr));
      for (const a of before) expect(versions[i].rules.some((r) => r.attr === a), `v${i + 1} keeps ${a}`).toBe(true);
    }
    expect(new Set(standardsOf(content, versions.length, true).map((r) => r.attr))).toEqual(new Set([...ATTRS, ...PICTURE_ATTRS].map(([a]) => a)));
  });

  it('each change arrives first thing in the morning by email, listing all of them, in order', () => {
    expect(updates.map((e) => e.onDeliver!.setFlags![0])).toEqual(versions.slice(1).map((v) => `matchless_rules_${v.id}`));
    for (const e of updates) {
      expect(e.morning).toBe(true);
      expect(isJobOffer(content, e)).toBe(false);
      const v = Number(e.onDeliver!.setFlags![0].split('_').at(-1));
      for (const r of standardsOf(content, v)) expect(e.body, `${e.id}: ${r.say}`).toContain(r.say);
    }
    // a change waits for the one before it
    const s = hired(10, 2);
    expect(triggerMatches(s, ev('d10_matchless_rules_4').trigger)).toBe(false);
  });

  it('lands at 10:00 the morning it is due', () => {
    const s0 = hired(5);
    s0.clockMin = CLOCK.sleep - 1;
    const s = endDay(s0, content);
    expect(s.values.day).toBe(6);
    expect(s.delivered.find((d) => d.eventId === 'd6_matchless_rules_2')?.min).toBe(CLOCK.wake);
    expect(matchlessNow(s, content).version).toBe(2);
  });
});

describe('the card', () => {
  it('shows the ordinary fields from the start and the odd ones only once his standards bring them up', () => {
    expect(shownAttrs(content, 1).map(([a]) => a)).toEqual(['gender', 'age', 'height', 'distance', 'smoking', 'sexuality']);
    expect(shownAttrs(content, 3).map(([a]) => a)).toEqual(expect.arrayContaining(['politics', 'followers']));
    expect(shownAttrs(content, 3).map(([a]) => a)).not.toContain('canthal');
    expect(shownAttrs(content, versions.length)).toEqual(ATTRS);
  });

  it('the picture always shows the hidden traits, and the table never lists them', () => {
    const ps = [4, 5, 6, 7, 8].flatMap((d) => versions.flatMap((v) => dayProfiles(content, d, v.id)));
    for (const [a] of PICTURE_ATTRS) {
      expect(shownAttrs(content, versions.length).some(([x]) => x === a)).toBe(false);
      expect(new Set(ps.map((p) => p[a])).size, a).toBeGreaterThan(1);
    }
    for (const p of ps) {
      const pic = portraitOf(p);
      expect(pic.includes('V54 Q42.2'), `${p.id} hair`).toBe(p.hair === 'long');
      expect(pic.includes('r="3.3"'), `${p.id} glasses`).toBe(p.glasses === 'yes');
      expect(pic.includes('cx="43" cy="35"'), `${p.id} earrings`).toBe(p.earrings === 'yes');
      expect(pic).toContain(HAIR_HEX[p.hairColor]);
    }
  });
});

describe('the profiles', () => {
  it('ten a day, about half meeting every standard and the rest missing one or two, all 21 or older', () => {
    for (const v of versions) {
      for (let day = 4; day <= 21; day++) {
        const ps = dayProfiles(content, day, v.id);
        expect(ps).toHaveLength(10);
        const good = ps.filter((p) => passes(v.rules, p)).length;
        expect(good, `v${v.id} day ${day}`).toBeGreaterThanOrEqual(4);
        expect(good).toBeLessThanOrEqual(6);
        for (const p of ps) {
          expect(p.age).toBeGreaterThanOrEqual(21);
          expect(v.rules.filter((r) => !meets(r, p)).length).toBeLessThanOrEqual(2);
          if (p.gender === 'man') expect(['lesbian']).not.toContain(p.sexuality);
          else expect(p.sexuality).not.toBe('gay');
        }
        expect(new Set(ps.map((p) => p.name)).size).toBeGreaterThan(7);
        for (const p of ps) expect(p.message, p.id).toBeTruthy();
        expect(new Set(ps.map((p) => p.message)).size).toBeGreaterThan(6);
      }
    }
    expect(dayProfiles(content, 7, 3)).toEqual(dayProfiles(content, 7, 3));
  });
});

describe('swiping and pay', () => {
  it('one profile at a time, ten a day, nothing before the job', () => {
    expect(matchlessSwipe(startGame(content, 1), content, 'yes').matchless).toBeUndefined();
    let s = hired(5);
    const first = matchlessNow(s, content).next!;
    s = matchlessSwipe(s, content, 'yes');
    expect(matchlessNow(s, content).next!.id).not.toBe(first.id);
    s = swipeAll(s);
    expect(swipesToday(s)).toHaveLength(10);
    expect(matchlessNow(s, content).next).toBeUndefined();
    expect(matchlessSwipe(s, content, 'no')).toBe(s);
  });

  it('a perfect day of ten pays 35 DOLR at night; one wrong swipe pays nothing and the client says which', () => {
    const good = swipeAll(hired(5));
    good.values.crypto = 1000;
    const paid = endDay(good, content);
    expect(paid.tx.some((t) => t.memo === '6ft_sigma · Matchless' && t.amount === 35)).toBe(true);
    expect(paid.morning!.lines).toContainEqual(['Matchless swiping', 35]);
    expect(paid.mail.some((m) => m.subject === 'Yesterday')).toBe(false);

    const woman = dayProfiles(content, 5, 1).findIndex((x) => x.gender === 'woman');
    const bad = swipeAll(hired(5), woman);
    bad.values.crypto = 1000;
    const after = endDay(bad, content);
    expect(after.tx.some((t) => t.memo === '6ft_sigma · Matchless')).toBe(false);
    const mail = after.mail.find((m) => m.subject === 'Yesterday')!;
    const p = dayProfiles(content, 5, 1)[woman];
    expect(mail.body).toContain(p.name);
    expect(mail.body).toContain('No pay for yesterday.');
    expect(mail.day).toBe(6);
  });

  it('a day with profiles left unswiped pays nothing, even if every swipe was right', () => {
    let s = hired(5);
    const { profiles, version } = matchlessNow(s, content);
    for (const p of profiles.slice(0, 6)) s = matchlessSwipe(s, content, passes(standardsOf(content, version), p) ? 'yes' : 'no');
    s.values.crypto = 1000;
    const after = endDay(s, content);
    expect(after.tx.some((t) => t.memo === '6ft_sigma · Matchless')).toBe(false);
    expect(after.mail.find((m) => m.subject === 'Yesterday')!.body).toContain('You swiped 6 of 10.');
  });

  it("before he says it, men can't be swiped wrong; accepting one gets 'SUPER STRAIGHT' the next morning and women only from then on", () => {
    const day = Array.from({ length: 10 }, (_, i) => 5 + i).find((d) => dayProfiles(content, d, 1).some((p) => p.gender === 'man'))!;
    let s = hired(day);
    const { profiles, version } = matchlessNow(s, content);
    for (const p of profiles) s = matchlessSwipe(s, content, p.gender === 'man' || passes(standardsOf(content, version), p) ? 'yes' : 'no');
    s.values.crypto = 1000;
    const next = endDay(s, content);
    expect(next.tx.some((t) => t.memo === '6ft_sigma · Matchless' && t.amount === 35)).toBe(true);
    expect(next.flags).toContain('matchless_women_only');
    const say = content.matchless!.womenOnly.say;
    expect(say).toContain('SUPER STRAIGHT');
    const texts = [...next.mail.map((m) => m.body), ...next.delivered.map((d) => d.body ?? '')];
    expect(texts.filter((b) => b.includes(say))).toHaveLength(1);
    // from now on a man is a wrong accept
    const deck = matchlessNow(next, content).profiles;
    expect(deck.every((p) => p.id.endsWith('-w'))).toBe(true);
    expect(standardsOf(content, 1, true).some((r) => r.attr === 'gender')).toBe(true);

    // rejecting a man changes nothing
    let r = hired(day);
    for (const p of matchlessNow(r, content).profiles) r = matchlessSwipe(r, content, p.gender !== 'man' && passes(standardsOf(content, 1), p) ? 'yes' : 'no');
    expect(endDay(r, content).flags).not.toContain('matchless_women_only');
  });

  it("says it inside that morning's standards email when one arrives, and later emails list women only", () => {
    const s = hired(5);
    s.flags.push('matchless_man_accepted');
    s.values.crypto = 5000;
    s.clockMin = CLOCK.sleep - 1;
    const d6 = endDay(s, content);
    const update = d6.delivered.find((d) => d.eventId === 'd6_matchless_rules_2')!;
    expect(update.body!.startsWith(content.matchless!.womenOnly.say)).toBe(true);
    expect(update.body).toContain('- Women only.\n');
    expect(d6.mail.filter((m) => m.subject === 'Women')).toHaveLength(0);
    d6.clockMin = CLOCK.sleep - 1;
    const d7 = endDay(d6, content);
    d7.clockMin = CLOCK.sleep - 1;
    const d8 = endDay(d7, content);
    const v3 = d8.delivered.find((d) => d.eventId === 'd8_matchless_rules_3')!;
    expect(v3.body).toContain('From today:\n\n- Women only.\n');
    expect(v3.body).not.toContain('SUPER STRAIGHT');
  });
});
