/*
 * The player's own API keys, for the browser build that talks to Anthropic and TypeSafe directly
 * (the GitHub Pages version, built with VITE_DIRECT_API=1). The keys live in this browser's
 * localStorage and are only ever sent to api.anthropic.com and api.typesafe.ai. The local dev build
 * goes through the proxy (server/jev-proxy.mjs) and its app/.env instead, and never reads these.
 */

/** Whether this build calls the APIs from the browser with the player's keys instead of the local proxy. */
export const DIRECT = import.meta.env.VITE_DIRECT_API === '1';

export interface Keys { anthropic: string; typesafe: string }

const KEY = 'unknown-agent-api-keys';

function load(): Keys {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { anthropic: String(saved.anthropic ?? ''), typesafe: String(saved.typesafe ?? '') };
  } catch {
    return { anthropic: '', typesafe: '' };
  }
}

class KeyStore {
  keys = load();
  private listeners = new Set<() => void>();
  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  set(keys: Keys): void {
    this.keys = { anthropic: keys.anthropic.trim(), typesafe: keys.typesafe.trim() };
    try { localStorage.setItem(KEY, JSON.stringify(this.keys)); } catch { /* storage off */ }
    this.listeners.forEach((fn) => fn());
  }
  /** Whether the player has entered anything yet (the first launch asks for keys until they do or pick offline). */
  get any(): boolean { return !!(this.keys.anthropic || this.keys.typesafe); }
}

export const API_KEYS = new KeyStore();

/** A key as the settings show it: enough to recognise, not enough to copy. */
export function maskKey(k: string): string {
  return k ? `${k.slice(0, 7)}…${k.slice(-4)}` : '';
}
