/*
 * Client-side Jev router that talks to the backend proxy (which holds the API key). If the proxy
 * isn't running or a call fails, it falls back to the offline keyword router so the game stays
 * playable. The key never ships in the client.
 */
import {
  offlineJev,
  type JevRouter, type RouteInput, type RouteDecision, type PostInput, type PostRating, type FeatureMatchInput,
} from '../engine';

export type JevMode = 'checking' | 'online' | 'offline';

/** How long to stay on the offline router after a failed call before trying the proxy again. */
const RETRY_MS = 30_000;

export class BackendJev implements JevRouter {
  mode: JevMode = 'checking';
  /** Why Jev is offline, in plain words (for the agent page and the dev panel). */
  reason = '';
  private retryAt = 0;
  private listeners = new Set<() => void>();

  constructor(private fallback: JevRouter) {}

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Ask the proxy whether Jev is usable, so the UI shows the right mode before the first call. */
  async probe(): Promise<void> {
    try {
      const res = await fetch('/api/status');
      const body = res.ok ? ((await res.json()) as { jev?: boolean; reason?: string }) : null;
      if (body?.jev) this.setMode('online');
      else this.goOffline(body?.reason ?? 'The Jev proxy is not running (npm run proxy).');
    } catch {
      this.goOffline('The Jev proxy is not running (npm run proxy).');
    }
  }

  async route(input: RouteInput): Promise<RouteDecision> {
    return this.call('route', input, () => this.fallback.route(input));
  }
  async ratePost(input: PostInput): Promise<PostRating> {
    return this.call('rate-post', input, () => this.fallback.ratePost(input));
  }
  async matchFeatures(input: FeatureMatchInput): Promise<string[]> {
    return this.call('match-features', input, () => this.fallback.matchFeatures(input));
  }

  private setMode(mode: JevMode, reason = ''): void {
    if (this.mode === mode && this.reason === reason) return;
    this.mode = mode; this.reason = reason;
    this.listeners.forEach((fn) => fn());
  }
  private goOffline(reason: string): void {
    this.retryAt = Date.now() + RETRY_MS;
    this.setMode('offline', reason);
  }

  private async call<T>(path: string, payload: unknown, fallback: () => Promise<T>): Promise<T> {
    // after a failure, use the offline router for a while, then give the proxy another chance
    if (this.mode === 'offline' && Date.now() < this.retryAt) return fallback();
    try {
      const res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        this.goOffline(err?.error ?? `The Jev proxy answered ${res.status}.`);
        return fallback();
      }
      const out = (await res.json()) as T;
      this.setMode('online');
      return out;
    } catch {
      this.goOffline('The Jev proxy is not running (npm run proxy).');
      return fallback();
    }
  }
}

/** The game's one Jev router; the UI reads its mode. */
export const JEV = new BackendJev(offlineJev);
