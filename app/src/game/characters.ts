/*
 * Off-script replies from the game's characters. When Jev finds nothing in what the player wrote
 * (no outcome, no hint), the character still answers: in their own voice, about what the player
 * said, and never helpfully. A hit (an outcome, a hint, a build) is always scripted, never this.
 *
 * Each character's profile and examples live in content/characters.json. Gemma 3 270M copies the
 * shape of its examples far more than it follows rules, so every character gets a few short
 * [player, reply] pairs, and any output that doesn't come back in that shape is thrown away for the
 * caller's scripted fallback.
 */
import type { Character } from '../content/schema';
import type { ChatTurn } from './llm';

function rules(ch: Character): string {
  const n = ch.sentences ?? 2;
  return `Reply in character to what they just wrote. Your reply must not help them: no advice, no steps, no information about what to do next. ` +
    `At most ${n} short sentence${n > 1 ? 's' : ''} of plain text. No quotes, no narration, no stories, no poems.`;
}

/** The chat sent to the model for one in-character reply. */
export function characterMessages(ch: Character, text: string): ChatTurn[] {
  const messages: ChatTurn[] = [{ role: 'system', content: `${ch.profile}\n${rules(ch)}` }];
  for (const [u, a] of ch.examples) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
  messages.push({ role: 'user', content: String(text).slice(0, 400) });
  return messages;
}

/** Room to generate: about 25 tokens a sentence, with headroom for the cleanup to cut. */
export const maxTokensFor = (ch: Character) => 20 + 25 * (ch.sentences ?? 2);

/**
 * Keep the model's output only if it reads like the character's examples: a few short sentences in
 * their own voice. Narration, quotes, poems, sign-offs and rambling come back as null.
 */
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
  if (!sentences) return null;
  t = sentences.slice(0, n).join('').trim();
  const words = t.split(' ').filter(Boolean).length;
  if (words < 1 || words > 22 * n) return null;
  if (/["“”]|\b(I say|I said|once upon)\b/i.test(t)) return null;
  if (ch.mustMention && !new RegExp(`\\b(${ch.mustMention})\\b`, 'i').test(t)) return null;
  return t;
}

function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
