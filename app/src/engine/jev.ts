/*
 * Jev is TypeSafe's judgment model. It never runs in the client with a key; the real router calls a
 * backend proxy. The engine depends only on this interface, so tests inject a deterministic stub and
 * the game stays playable offline with the keyword fallback below.
 */
import type { EventSite } from './state';

export interface RouteCandidate {
  id: string;
  /** Plain-language description of what this outcome is, for Jev to match. */
  when: string;
}

export interface RouteInput {
  channel: EventSite;
  text: string;
  stateSummary: string;
  candidates: RouteCandidate[];
  hints: string[];
  /** Only accept a clear match: the offline router needs two shared keywords instead of one. */
  strict?: boolean;
}

export type RouteDecision =
  | { kind: 'nothing' }
  | { kind: 'hint'; hintIndex: number }
  | { kind: 'outcome'; outcomeId: string };

export type PostCategory =
  | 'reaction'
  | 'launch'
  | 'tip'
  | 'humor'
  | 'hot_take'
  | 'self_promo'
  | 'spam';

export interface PostInput {
  text: string;
  trending: string[];
  recentPosts: string[];
  followers: number;
}
export interface PostRating {
  category: PostCategory;
  quality: number; // 0..1
}

export interface FeatureMatchInput {
  prompt: string;
  /** Spec features with their plain-language descriptions. */
  features: { id: string; description: string }[];
}

export interface JevRouter {
  route(input: RouteInput): Promise<RouteDecision>;
  ratePost(input: PostInput): Promise<PostRating>;
  /** Which spec features a build/brief prompt asked for correctly. */
  matchFeatures(input: FeatureMatchInput): Promise<string[]>;
}

const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'and', 'or', 'is', 'it', 'i', 'you', 'my', 'me', 'for', 'on', 'in', 'that', 'this', 'with', 'be', 'do', 'please', 'can', 'could', 'would']);
function words(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)),
  );
}
function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

/**
 * Offline fallback: no model, just keyword overlap. Good enough to keep the game playable; the real
 * backend router replaces it when available. Deterministic — no randomness.
 */
export const offlineJev: JevRouter = {
  async route(input) {
    const t = words(input.text);
    let best = { score: 0, id: '' };
    for (const c of input.candidates) {
      const score = overlap(t, words(c.when));
      if (score > best.score) best = { score, id: c.id };
    }
    if (best.score >= 2) return { kind: 'outcome', outcomeId: best.id };
    if (input.strict) return { kind: 'nothing' };
    if (best.score === 1) {
      return input.hints.length ? { kind: 'hint', hintIndex: 0 } : { kind: 'outcome', outcomeId: best.id };
    }
    return { kind: 'nothing' };
  },
  async ratePost(input) {
    const t = words(input.text);
    // trending entries are phrases ("AI layoffs"); a post hits a trend if it shares any word with one
    const trend = new Set(input.trending.flatMap((x) => [...words(x)]));
    const hitsTrend = [...t].some((w) => trend.has(w));
    const dup = input.recentPosts.some((p) => words(p).size && overlap(words(p), t) >= Math.max(2, t.size - 1));
    const quality = Math.max(0, Math.min(1, t.size / 12));
    if (dup) return { category: 'spam', quality: 0.1 };
    if (hitsTrend) return { category: 'reaction', quality: Math.max(0.4, quality) };
    return { category: 'tip', quality };
  },
  async matchFeatures(input) {
    const t = words(input.prompt);
    // the "(for <app name>)" suffix only disambiguates for the real model; naming the app isn't asking for a feature
    return input.features.filter((f) => overlap(t, words(f.description.replace(/\s*\(for [^)]*\)$/, ''))) >= 1).map((f) => f.id);
  },
};
