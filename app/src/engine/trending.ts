/*
 * Y's trending sidebar. A topic trends from its `at` time (all day without one), so it never shows
 * before the story beat it's about has happened.
 */
import type { Content } from '../content/schema';

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** What's trending on `day` at game minute `min`, in listed order. */
export function trendingAt(content: Pick<Content, 'trending'>, day: number, min: number): string[] {
  return (content.trending[day] ?? []).filter((t) => typeof t === 'string' || toMin(t.at) <= min).map((t) => (typeof t === 'string' ? t : t.topic));
}
