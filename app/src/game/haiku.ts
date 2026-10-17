/*
 * Off-script character replies from Claude Haiku, through the local proxy (server/jev-proxy.mjs,
 * POST /api/write). The proxy holds ANTHROPIC_API_KEY and builds the prompt from
 * content/characters.json; the browser only sends which character is speaking, what the player
 * wrote, and the conversation so far. Used when the "Misses" setting on agent.chat is "Haiku (API)".
 */
import type { Character } from '../content/schema';
import type { HistoryLine } from '../engine';
import type { PlayerView } from './playerView';
import { finishReply } from './characters';

export interface HaikuReply { text: string | null; note?: string; debug: string[] }

/** A query (agent.chat): Haiku answers from what it may tell or hint at (`known`), and can read the player's screens in `view`. */
export interface QueryReq { known: { public: string[]; hint: string[] }; view?: PlayerView }
/** A near-miss (agent.chat): Haiku says what the prompt was missing (`why`), as the scripted `lines` do. */
export interface NearReq { why: string; lines: string[] }

/** `situation` (a Swaplist chat) tells the character what they're selling and what the player asked about. */
export async function haikuReply(ch: Character, text: string, via: 'subscription' | 'api', history: HistoryLine[] = [], situation?: string, query?: QueryReq, near?: NearReq): Promise<HaikuReply> {
  let res: Response;
  try {
    res = await fetch('/api/write', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: ch.id, text, via, history: history.slice(-12), ...(situation ? { situation } : {}), ...(query ? { mode: 'query', known: query.known, view: query.view } : {}), ...(near ? { mode: 'near', near } : {}) }),
    });
  } catch {
    return { text: null, note: 'the proxy is not running (npm run proxy)', debug: [] };
  }
  const data: any = await res.json().catch(() => ({}));
  // Vite answers 500 itself when nothing listens on the proxy port
  if (!res.ok) return { text: null, note: data.error || (res.status >= 500 ? 'the proxy is not running (npm run proxy)' : `proxy returned ${res.status}`), debug: [] };
  const raw = String(data.text ?? '');
  const reply = finishReply(ch, raw, query ? ch.query?.sentences ?? 3 : near ? ch.near?.sentences ?? 2 : undefined);
  const u = data.usage ?? {};
  const debug = [
    `Haiku: character "${ch.id}", ${data.model}, ${data.ms} ms, ${u.input_tokens ?? '?'} in / ${u.output_tokens ?? '?'} out tokens, stop ${data.stop}`,
    `system: ${data.system}`,
    ...(data.messages ?? []).map((m: any) => `${m.role}: ${m.content}`),
    ...(data.lookups ?? []).map((l: any) => `${l.tool} ${JSON.stringify(l.input)}: ${l.result}`),
    `raw output: ${raw || '(none)'}`,
  ];
  return reply ? { text: reply, debug } : { text: null, note: `Haiku's reply was unusable: ${raw.slice(0, 80) || data.stop}`, debug };
}

/** sorrywriter.ai: Haiku writes the player's apology (POST /api/apology; the prompt lives in the proxy). */
export async function haikuApology(text: string, via: 'subscription' | 'api', history: HistoryLine[] = []): Promise<{ text: string | null; note?: string }> {
  try {
    const res = await fetch('/api/apology', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, via, history: history.slice(-12) }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { text: null, note: data.error || `proxy returned ${res.status}` };
    const out = String(data.text ?? '').trim();
    return out ? { text: out } : { text: null, note: 'Haiku returned nothing' };
  } catch {
    return { text: null, note: 'the proxy is not running (npm run proxy)' };
  }
}
