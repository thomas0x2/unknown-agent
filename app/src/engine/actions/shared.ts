/*
 * Helpers the player actions share: the input cap, ids, the state summary and agent.chat history.
 */
import type { GameState } from '../state';
import { MAX_INPUT_CHARS } from '../config';
import { type HistoryLine } from '../writer';
import { dateFull } from '../calendar';

export const PLAYER_ADDR = 'you@qmail.com';

/** Over MAX_INPUT_CHARS: a scripted reply, with no Jev or Haiku call. */
export function tooLong(text: string): boolean { return text.length > MAX_INPUT_CHARS; }

export const TOO_LONG_DEBUG = `Over ${MAX_INPUT_CHARS} characters: scripted reply, Jev and Haiku skipped`;

/** What anyone you email says to a message over the cap. */
export const TOO_LONG_MAIL = [
  "I'm not reading all of that. If it matters, it fits in a few lines.",
  "Got your email. All of it. Can you send the short version?",
  "That's a lot of text. What do you actually need?",
  "I scrolled for a while and gave up. Shorter, please.",
];

/** What the agent says to a prompt over the cap (it is still billed per word). */
export const TOO_LONG_PROMPT = [
  "That prompt is too long for me to work with. Send one request, in fewer words. This one has been billed.",
  "I stopped reading partway through. Try again with just the part you need done.",
  "Too much input. I've billed it, but I haven't done anything with it. Keep it short.",
];

export function stateSummary(s: GameState): string {
  return `Day ${s.values.day} (${dateFull(s.values.day)}). ${s.values.crypto} DOLR, ${s.values.followers} followers, model agent-${s.values.agentLevel}.`;
}

export function nextId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

/** The recent agent.chat transcript, oldest first, for a model reply as the agent. */
export function chatHistory(s: GameState, max = 10): HistoryLine[] {
  return s.chat.filter((m) => m.from !== 'system').slice(-max).map((m) => ({ from: m.from === 'you' ? 'player' : 'self', text: m.text }));
}
