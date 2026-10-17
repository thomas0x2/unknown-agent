/*
 * Jev is TypeSafe's judgment model. It never runs in the client with a key; the real router calls a
 * backend proxy. The engine depends only on this interface, so tests inject a deterministic stub.
 * Every judgment about what the player wrote goes through Jev: there is no keyword fallback. When
 * Jev can't be reached, a call throws JevOffline and the action doesn't happen.
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
  /** The conversation so far, oldest first ("Player: …", "Agent: …"): what the message refers to, not requests. */
  context?: string[];
  /** Only accept a clear match; when nothing clearly fits, the answer is nothing. */
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
  /** Today's agent.chat before this prompt, oldest first ("Player: …", "Agent: …"): context for what the prompt refers to, not requests. */
  context?: string[];
  /** Spec features with their plain-language descriptions. */
  /** `app` asks whether the prompt names that app (or the chat just before it did); the engine drops matches on apps it doesn't name. */
  features: { id: string; description: string; kind?: 'build' | 'problem' | 'component' | 'area' | 'step' | 'app' | 'topic' | 'section' }[];
}

export interface JevRouter {
  route(input: RouteInput): Promise<RouteDecision>;
  ratePost(input: PostInput): Promise<PostRating>;
  /** Which spec features a build/brief prompt asked for correctly. */
  matchFeatures(input: FeatureMatchInput): Promise<string[]>;
  /** Jev's confidence (0..1) for each item of a matchFeatures question, in order: the dev Jev tests replay other thresholds from these. */
  matchScores?(input: FeatureMatchInput): Promise<number[]>;
}

/** Jev couldn't be reached. The action that needed it didn't happen; nothing was charged. */
export class JevOffline extends Error {
  constructor(public reason = 'Jev is offline.') { super(reason); this.name = 'JevOffline'; }
}

/** The router with no Jev behind it: every judgment fails, so nothing is decided by guesswork. */
export const noJev: JevRouter = {
  async route() { throw new JevOffline(); },
  async ratePost() { throw new JevOffline(); },
  async matchFeatures() { throw new JevOffline(); },
};
