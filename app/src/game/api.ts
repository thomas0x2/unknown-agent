/*
 * How the game reaches Jev and Claude Haiku. The local build POSTs to the proxy (/api/<kind>, which
 * holds the keys from app/.env). The GitHub Pages build (DIRECT) runs the same request builders
 * (server/api.mjs) in the browser and calls api.anthropic.com and api.typesafe.ai with the player's
 * own keys (game/apiKeys.ts). Both answer the same { ok, status, data } shape.
 */
import { createApi } from '../../server/api.mjs';
import type { Character } from '../content/schema';
import { API_KEYS, DIRECT } from './apiKeys';

export interface ApiResponse { ok: boolean; status: number; data: any }

/** What the game says when there is no proxy to ask. */
export const NO_PROXY = 'The Jev proxy is not running (npm run proxy).';
const ADD_KEY = 'Add it under Home > System > API keys.';

/** POST a request to Jev or Haiku. Throws only when the proxy can't be reached at all. */
export async function apiPost(kind: string, body: unknown): Promise<ApiResponse> {
  if (DIRECT) return direct(kind, body);
  const res = await fetch(`/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

/** Whether Jev and Haiku are usable: { jev, reason, writer }, like the proxy's GET /api/status. */
export async function apiStatus(): Promise<{ jev?: boolean; reason?: string; writer?: boolean } | null> {
  if (DIRECT) {
    const { anthropic, typesafe } = API_KEYS.keys;
    return { jev: !!typesafe, reason: typesafe ? '' : `There is no Jev key. ${ADD_KEY}`, writer: !!anthropic };
  }
  const res = await fetch('/api/status');
  return res.ok ? res.json() : null;
}

// ── the browser route: the shared request builders, with clients made from the player's keys ──
const characterMods = import.meta.glob('../../content/characters/*.json', { eager: true }) as Record<string, { default: Character }>;
const CHARACTERS = Object.values(characterMods).map((m) => m.default);

// one client per key, rebuilt when the player changes it
let anthropic: { key: string; client: any } | null = null;
let typesafe: { key: string; client: any; sdk: any } | null = null;

const handle = createApi({
  characters: CHARACTERS,
  async anthropic() {
    const key = API_KEYS.keys.anthropic;
    if (!key) return null;
    if (anthropic?.key !== key) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      anthropic = { key, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }) };
    }
    return anthropic.client;
  },
  async typesafe() {
    const key = API_KEYS.keys.typesafe;
    if (!key) return null;
    if (typesafe?.key !== key) {
      const sdk = await import('@typesafe-ai/sdk');
      typesafe = { key, sdk, client: new sdk.TypeSafeClient({ apiKey: key, dangerouslyAllowBrowser: true }) };
    }
    return { client: typesafe.client, sdk: typesafe.sdk };
  },
  anthropicMissing: () => `There is no Anthropic key. ${ADD_KEY}`,
  typesafeMissing: () => `There is no Jev key. ${ADD_KEY}`,
});

async function direct(kind: string, body: unknown): Promise<ApiResponse> {
  try {
    const { status, json } = await handle(kind, body);
    return { ok: status < 300, status, data: json };
  } catch (e) {
    return { ok: false, status: 502, data: { error: directError(kind, e) } };
  }
}

/** An SDK error in words the player can act on: a rejected key, or a service the browser can't reach. */
export function directError(kind: string, e: unknown): string {
  const jev = kind !== 'write' && kind !== 'apology';
  const who = jev ? 'Jev (api.typesafe.ai)' : 'Anthropic (api.anthropic.com)';
  const status = Number((e as { status?: unknown })?.status);
  if (status === 401 || status === 403) return `${who} turned down the ${jev ? 'Jev' : 'Anthropic'} key. ${ADD_KEY.replace('Add it', 'Check it')}`;
  if (status === 429) return `${who} says too many requests. Try again in a moment.`;
  // no status: the request never got an answer, either no connection or the service doesn't accept calls from web pages (CORS)
  if (!status) return `This browser could not reach ${who}: the connection failed, or it turned down a request from a web page.`;
  return `${who} answered ${status}: ${String((e as Error)?.message ?? '').slice(0, 160)}`;
}
