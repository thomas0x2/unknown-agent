/*
 * Client-side Jev router that talks to the backend proxy (which holds the API key). If the proxy
 * isn't running or a call fails, it falls back to the offline keyword router so the game stays
 * playable. The key never ships in the client.
 */
import type {
  JevRouter, RouteInput, RouteDecision, PostInput, PostRating, FeatureMatchInput,
} from '../engine';

export class BackendJev implements JevRouter {
  private healthy = true;

  constructor(private fallback: JevRouter) {}

  async route(input: RouteInput): Promise<RouteDecision> {
    return this.call('route', input, () => this.fallback.route(input));
  }
  async ratePost(input: PostInput): Promise<PostRating> {
    return this.call('rate-post', input, () => this.fallback.ratePost(input));
  }
  async matchFeatures(input: FeatureMatchInput): Promise<string[]> {
    return this.call('match-features', input, () => this.fallback.matchFeatures(input));
  }

  private async call<T>(path: string, payload: unknown, fallback: () => Promise<T>): Promise<T> {
    if (!this.healthy) return fallback();
    try {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.healthy = false; // no proxy / no key / error: use offline for the rest of the session
        return fallback();
      }
      return (await res.json()) as T;
    } catch {
      this.healthy = false;
      return fallback();
    }
  }
}
