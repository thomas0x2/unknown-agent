import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame, endDay } from './day';
import { addFlag } from './core';
import { LAST_DAY } from './config';
import { composeIssue, issueParts, NEWS_ITEMS } from './newsletter';
import { NEWSLETTER_EVENT } from './current';
import type { GameState } from './state';

const content = loadContent();
const ev = content.events.find((e) => e.id === NEWSLETTER_EVENT)!;
const nl = ev.newsletter!;
const issue = (s: GameState) => s.delivered.find((d) => d.eventId === NEWSLETTER_EVENT && d.day === s.values.day);

describe('The Current morning newsletter', () => {
  it('has an issue for every day: a headline and two items, whatever the flags', () => {
    for (let day = 1; day <= LAST_DAY; day++) {
      const i = nl.issues.find((x) => x.day === day);
      expect(i, `day ${day}`).toBeTruthy();
      const last = i!.headline[i!.headline.length - 1];
      expect(last.yesterday ?? last.when, `day ${day} needs an unconditional headline`).toBeUndefined();
      expect(i!.items.filter((it) => !it.yesterday && !it.when).length, `day ${day}`).toBeGreaterThanOrEqual(NEWS_ITEMS);
      // an item is "Title: text" in the email, so its title can't hold a colon of its own
      for (const it of i!.items) expect(it.title, `day ${day}`).not.toContain(': ');
    }
    for (const r of nl.reactions ?? []) expect(r.title).not.toContain(': ');
  });

  it('lands in Qmail at 10:00 with its headline as the subject, starting with 30% unemployment on day 1', () => {
    const s = startGame(content, 1);
    const d = issue(s)!;
    expect(d.min).toBe(600);
    expect(d.subject).toBe('Unemployment reaches 30%');
    const p = issueParts(d.body!);
    expect(p.text).toMatch(/^Three in ten/);
    expect(p.items).toHaveLength(NEWS_ITEMS);
  });

  it('comes every morning, one issue a day', () => {
    let s = startGame(content, 1);
    s.values.crypto = 10_000;
    for (let day = 2; day <= 5; day++) {
      s = endDay(s, content);
      expect(s.delivered.filter((d) => d.eventId === NEWSLETTER_EVENT && d.day === day)).toHaveLength(1);
      expect(issue(s)!.subject).toBe(composeIssue(nl, day)!.subject);
    }
  });

  it('reacts to what the player did yesterday, and only the next morning', () => {
    let s = startGame(content, 1);
    s.values.crypto = 10_000;
    s = endDay(s, content); // day 2
    addFlag(s, 'swaplist_live');
    s = endDay(s, content); // day 3
    expect(issue(s)!.body).toContain('Swaplist');
    s = endDay(s, content); // day 4
    expect(issue(s)!.body).not.toContain('Swaplist');
  });

  it('keeps an issue to two items when several things happened', () => {
    const s = startGame(content, 1);
    s.values.day = 6;
    for (const f of ['seed_stolen', 'gym_reviews', 'laundromat_live']) { addFlag(s, f); s.flagDays[f] = 5; }
    const c = composeIssue(nl, 6, s)!;
    expect(c.items.map((i) => i.title)).toEqual(['Wallets', 'Reviews']);
  });
});
