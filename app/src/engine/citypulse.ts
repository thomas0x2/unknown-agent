/*
 * CityPulse (citypulse.news): the city's news site. Its articles (content/citypulse.json) follow the
 * story day by day and go up at their `at` time, like Y posts, so the front page never runs ahead of
 * the game clock. Rendered by ui/citypulse.ts.
 */
import ARTICLES from '../../content/citypulse.json';
import type { GameState } from './state';
import { parseClock, posted } from './events';

export interface Article {
  /** the page's path: citypulse.news/<slug> */
  slug: string;
  day: number;
  /** "HH:MM" it goes up on its day */
  at: string;
  section: string;
  /** which drawing heads the article (ui/citypulse.ts) */
  art: string;
  by: string;
  title: string;
  dek: string;
  body: string[];
  /** only once all of these flags are set */
  flagsAll?: string[];
  /** only while none of these flags are set */
  flagsNone?: string[];
  /** a big story: its three banner frames (trusted markup, <b> only). The newest live one is CityPulse's ad. */
  ad?: [string, string, string];
  /** the banner's fine print, when not the default */
  adFine?: string;
}

export const CITYPULSE: Article[] = ARTICLES as Article[];

export const articleMin = (a: Pick<Article, 'at'>): number => parseClock(a.at) ?? 0;

/** Whether an article is on the site right now: published by the game clock, and its flags hold. */
export function articleLive(s: GameState, a: Article): boolean {
  if (!posted(s, a.day, articleMin(a))) return false;
  if (a.flagsAll && !a.flagsAll.every((f) => s.flags.includes(f))) return false;
  if (a.flagsNone && a.flagsNone.some((f) => s.flags.includes(f))) return false;
  return true;
}

/** Every article up so far, newest first. */
export function liveArticles(s: GameState, list: Article[] = CITYPULSE): Article[] {
  return list.filter((a) => articleLive(s, a)).sort((a, b) => b.day - a.day || articleMin(b) - articleMin(a));
}

export const findArticle = (slug: string, list: Article[] = CITYPULSE): Article | undefined => list.find((a) => a.slug === slug);

/** The hottest story right now: the newest live article written up for the banner ads. */
export function hotStory(s: GameState, list: Article[] = CITYPULSE): Article | undefined {
  return liveArticles(s, list).find((a) => a.ad);
}
