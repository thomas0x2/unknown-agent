/*
 * Off-script character replies from Claude Haiku, through the local proxy (server/jev-proxy.mjs,
 * POST /api/write). The proxy holds ANTHROPIC_API_KEY and builds the prompt from
 * content/characters.json; the browser only sends which character is speaking and what the player
 * wrote. Used when the "Misses" setting on agent.chat is "Haiku (API)".
 */
import type { Character } from '../content/schema';
import { finishReply } from './characters';
import { LLM } from './llm';

export interface HaikuReply { text: string | null; note?: string; debug: string[] }

export async function haikuReply(ch: Character, text: string): Promise<HaikuReply> {
  let res: Response;
  try {
    res = await fetch('/api/write', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ character: ch.id, text, via: LLM.settings.haikuVia }),
    });
  } catch {
    return { text: null, note: 'the proxy is not running (npm run proxy)', debug: [] };
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) return { text: null, note: data.error || `proxy returned ${res.status}`, debug: [] };
  const raw = String(data.text ?? '');
  const reply = finishReply(ch, raw);
  const u = data.usage ?? {};
  const debug = [
    `Haiku: character "${ch.id}", ${data.model}, ${data.ms} ms, ${u.input_tokens ?? '?'} in / ${u.output_tokens ?? '?'} out tokens, stop ${data.stop}`,
    `system: ${data.system}`,
    ...(data.messages ?? []).map((m: any) => `${m.role}: ${m.content}`),
    `raw output: ${raw || '(none)'}`,
  ];
  return reply ? { text: reply, debug } : { text: null, note: `Haiku's reply was unusable: ${raw.slice(0, 80) || data.stop}`, debug };
}
