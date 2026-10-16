/*
 * Off-script replies from the game's characters. When Jev finds nothing in what the player wrote
 * (no outcome, no hint), the character still answers: in their own voice, about what the player
 * said, and never helpfully. A hit (an outcome, a hint, a build) is always scripted, never this.
 *
 * Each character's profile and examples live in content/characters.json; the proxy
 * (server/jev-proxy.mjs) turns them into Claude Haiku's prompt. This file tidies what comes back.
 */
import type { Character } from '../content/schema';

/** Tidy the model's output: strip chat tokens, markdown and headers, and keep the first sentences. */
export function finishReply(ch: Character, raw: string): string | null {
  const n = ch.sentences ?? 2;
  let t = String(raw)
    .replace(/<end_of_turn>|<eos>|<\/?start_of_turn>(model|user)?/g, '')
    .replace(/[*_#`]+/g, '')
    .replace(/^\s*(subject|re)\s*:.*$/gim, '')
    .replace(new RegExp(`^\\s*(assistant|model|${escapeRe(ch.name)})\\s*:\\s*`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = t.match(/[^.!?]+[.!?]+/g);
  if (sentences) t = sentences.slice(0, n).join('').trim();
  if (t.length > 160 * n) t = t.slice(0, 160 * n).replace(/\s+\S*$/, '') + '…';
  if (!t || t.split(' ').length < (ch.minWords ?? 1)) return null;
  return t;
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
