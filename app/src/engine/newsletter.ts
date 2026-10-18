/*
 * The Current's morning newsletter (Thomas, 2026-10-18): lands in Qmail at 10:00 every day and anchors
 * it, like the newspaper in Papers, Please. One headline and two small items. Items can react to what
 * the player did the day before (a flag set yesterday), so the world notices without naming them.
 */
import type { GameState } from './state';
import type { GameEvent, Newsletter, NewsIssue, NewsItem } from '../content/schema';
import { triggerMatches } from './events';

/** Items an issue carries under its headline. */
export const NEWS_ITEMS = 2;
export const NEWS_FOOTER = 'Read online at thecurrent.test. The Current is independent and funded by its readers.';

export interface ComposedIssue {
  subject: string;
  headline: NewsItem;
  items: NewsItem[];
  body: string;
}

/** A state with no flags on `day`, for showing an issue outside a game (the wiki, dev tools). */
function blank(day: number): GameState {
  return { values: { day }, flags: [], flagDays: {}, apps: [] } as unknown as GameState;
}

function holds(s: GameState, day: number, it: NewsItem): boolean {
  if (it.yesterday && !it.yesterday.some((f) => s.flags.includes(f) && s.flagDays[f] === day - 1)) return false;
  return !it.when || triggerMatches(s, it.when);
}

export function issueFor(nl: Newsletter, day: number): NewsIssue | undefined {
  return nl.issues.find((i) => i.day === day);
}

/** The issue as it lands on `day` for this state (or for a fresh one without `s`). */
export function composeIssue(nl: Newsletter, day: number, s: GameState = blank(day)): ComposedIssue | undefined {
  const issue = issueFor(nl, day);
  if (!issue) return undefined;
  const ok = (it: NewsItem) => holds(s, day, it);
  const headline = issue.headline.find(ok) ?? issue.headline[issue.headline.length - 1];
  const conditional = (it: NewsItem) => !!(it.yesterday || it.when);
  const items = [
    ...issue.items.filter((it) => conditional(it) && ok(it)),
    ...(nl.reactions ?? []).filter(ok),
    ...issue.items.filter((it) => !conditional(it)),
  ].slice(0, NEWS_ITEMS);
  // the headline is the subject, so the body opens with its story
  const body = [
    headline.text,
    ...items.map((it) => `${it.title}: ${it.text}`),
    NEWS_FOOTER,
  ].join('\n\n');
  return { subject: headline.title, headline, items, body };
}

/** Fills in a newsletter delivery's subject and body for today's issue. */
export function stampIssue(s: GameState, ev: GameEvent, d: { day: number; subject?: string; body?: string }): void {
  if (!ev.newsletter) return;
  const c = composeIssue(ev.newsletter, d.day, s);
  if (!c) return;
  d.subject = c.subject;
  d.body = c.body;
}

/** Splits a delivered issue's body back into its headline story and items, for thecurrent.test's front page. */
export function issueParts(body: string): { text: string; items: { title: string; text: string }[] } {
  const [text = '', ...rest] = body.split('\n\n').filter((p) => p !== NEWS_FOOTER);
  const items = rest.map((p) => {
    const i = p.indexOf(': ');
    return i < 0 ? { title: '', text: p } : { title: p.slice(0, i), text: p.slice(i + 2) };
  });
  return { text, items };
}
