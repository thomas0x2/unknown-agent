/*
 * Client-side Jev router that talks to the backend proxy (which holds the API key), or, in the
 * GitHub Pages build, to TypeSafe directly with the player's own key (game/api.ts). If the proxy
 * isn't running or a call fails, the call throws JevOffline: the action doesn't happen and the UI
 * says Jev is offline. There is no keyword fallback.
 */
import {
  JevOffline,
  type JevRouter, type RouteInput, type RouteDecision, type PostInput, type PostRating, type FeatureMatchInput,
} from '../engine';
import { apiPost, apiStatus, NO_PROXY } from './api';

export type JevMode = 'checking' | 'online' | 'offline';


export class BackendJev implements JevRouter {
  mode: JevMode = 'checking';
  /** Why Jev is offline, in plain words (for the agent page and the dev panel). */
  reason = '';
  /** Whether the proxy has ANTHROPIC_API_KEY for Haiku replies (null until the proxy answers). */
  haikuKey: boolean | null = null;
  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Ask the proxy (or the saved keys) whether Jev is usable, so the UI shows the right mode before the first call. */
  async probe(): Promise<void> {
    try {
      const body = await apiStatus();
      this.haikuKey = body ? !!body.writer : null;
      if (body?.jev) this.setMode('online');
      else this.goOffline(body?.reason || NO_PROXY);
    } catch {
      this.goOffline(NO_PROXY);
    }
  }

  async route(input: RouteInput): Promise<RouteDecision> {
    return this.call('route', input);
  }
  async ratePost(input: PostInput): Promise<PostRating> {
    return this.call('rate-post', input);
  }
  async matchFeatures(input: FeatureMatchInput): Promise<string[]> {
    return this.call('match-features', input);
  }
  async matchScores(input: FeatureMatchInput): Promise<number[]> {
    return this.call('match-features', { ...input, withScores: true });
  }

  private setMode(mode: JevMode, reason = ''): void {
    if (this.mode === mode && this.reason === reason) return;
    this.mode = mode; this.reason = reason;
    this.listeners.forEach((fn) => fn());
  }
  private goOffline(reason: string): JevOffline {
    this.setMode('offline', reason);
    return new JevOffline(reason);
  }

  /** Every call tries the proxy, so Jev is back the moment the proxy is. */
  private async call<T>(path: string, payload: unknown): Promise<T> {
    let res;
    try {
      res = await apiPost(path, payload);
    } catch {
      throw this.goOffline(NO_PROXY);
    }
    if (!res.ok) {
      // the dev server answers 5xx for a proxy that isn't running
      throw this.goOffline(res.data?.error ?? (res.status >= 500 ? NO_PROXY : `The Jev proxy answered ${res.status}.`));
    }
    this.setMode('online');
    return res.data as T;
  }
}

/** The game's one Jev router; the UI reads its mode. */
export const JEV = new BackendJev();
