/*
 * sorrywriter.ai, from the SorryWriter banner ad: a chat laid out like agent.chat. A scripted opener
 * asks what the player wants to apologise for; each message the player sends gets an apology back,
 * written by Claude Haiku (game/haiku.ts, haikuApology) in which the player blames themselves far
 * too much. Scripted apologies stand in when Haiku doesn't answer; a message over MAX_INPUT_CHARS
 * gets a scripted refusal and Haiku isn't asked. Billed per message and word (chatFees.ts).
 */
import type { GameState } from './state';
import { clone } from './core';
import { MAX_INPUT_CHARS } from './config';

export const SORRY_OPENER = 'Hi, I’m SorryWriter. What happened, and who do you need to apologise to?';

/** Stand-ins when Haiku can't write one. They don't mention what the player said, so they fit anything. */
export const SORRY_FALLBACKS = [
  'I’m sorry. I have thought about what I did all night, and I keep arriving at the same place: this is who I am, and you deserved better from me. I don’t expect you to forgive me. I wouldn’t.',
  'I owe you an apology, and probably several from before this one that I never made. There’s no excuse. I had every chance to do the right thing and I did the other thing, as I usually do.',
  'I’m so sorry. It was thoughtless and selfish, and I can see now that it fits a pattern I should have noticed years ago. You don’t have to reply. I’d understand if you never did.',
];

/** What SorryWriter says to a message over the cap. The message is still billed. */
export const SORRY_TOO_LONG = [
  'That’s too much for one apology. Tell me what happened in a few sentences. This message has been billed.',
  'I stopped reading partway through. Keep it to the part you’re sorry for.',
];

export interface SorryMsg { from: 'you' | 'bot'; text: string; day: number; src?: 'llm' | 'scripted' }
export interface SorryChat { msgs: SorryMsg[] }

export const sorryChat = (s: GameState): SorryChat => s.sorry ?? { msgs: [] };
export const sorryTooLong = (text: string) => text.length > MAX_INPUT_CHARS;

/** The player's message goes into the chat; the apology comes from sorryReply once it's written. */
export function sorrySay(s0: GameState, text: string): GameState {
  const s = clone(s0);
  const c = sorryChat(s);
  s.sorry = { msgs: [...c.msgs, { from: 'you', text, day: s.values.day }] };
  return s;
}

/** A scripted line for when no apology was written (cycles, so repeats are rare). */
export function sorryScripted(s: GameState, tooLong: boolean): string {
  const lines = tooLong ? SORRY_TOO_LONG : SORRY_FALLBACKS;
  const n = sorryChat(s).msgs.filter((m) => m.from === 'bot').length;
  return lines[n % lines.length];
}

export function sorryReply(s0: GameState, text: string, src: 'llm' | 'scripted'): GameState {
  const s = clone(s0);
  const c = sorryChat(s);
  s.sorry = { msgs: [...c.msgs, { from: 'bot', text, day: s.values.day, src }] };
  return s;
}
