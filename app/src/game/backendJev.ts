/*
 * Client-side Jev router that talks to the backend proxy (which holds the API key). If the proxy
 * isn't running or a call fails, the call throws JevOffline: the action doesn't happen and the UI
 * says Jev is offline. There is no keyword fallback. The key never ships in the client.
 */
import {
  JevOffline,
  type JevRouter, type RouteInput, type RouteDecision, type PostInput, type PostRating, type FeatureMatchInput,
} from '../engine';

export type JevMode = 'checking' | 'online' | 'offline';


export class BackendJev implements JevRouter {
  mode: JevMode = 'checking';
  /** Why Jev is offline, in plain words (for the agent page and the dev panel). */
  reason = '';
  /** Whether the proxy has ANTHROPIC_API_KEY for Haiku replies (null until the proxy answers). */
  haikuKey: boolean | null = null;
  private listeners = new Set<() => void>();

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  /** Ask the proxy whether Jev is usable, so the UI shows the right mode before the first call. */
  async probe(): Promise<void> {
    try {
      const res = await fetch('/api/status');
      const body = res.ok ? ((await res.json()) as { jev?: boolean; reason?: string; writer?: boolean }) : null;
      this.haikuKey = body ? !!body.writer : null;
      if (body?.jev) this.setMode('online');
      else this.goOffline(body?.reason ?? 'The Jev proxy is not running (npm run proxy).');
    } catch {
      this.goOffline('The Jev proxy is not running (npm run proxy).');
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
    let res: Response;
    try {
      res = await fetch(`/api/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw this.goOffline('The Jev proxy is not running (npm run proxy).');
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      // the dev server answers 5xx for a proxy that isn't running
      throw this.goOffline(err?.error ?? (res.status >= 500 ? 'The Jev proxy is not running (npm run proxy).' : `The Jev proxy answered ${res.status}.`));
    }
    const out = (await res.json()) as T;
    this.setMode('online');
    return out;
  }
}

/** The game's one Jev router; the UI reads its mode. */
export const JEV = new BackendJev();
