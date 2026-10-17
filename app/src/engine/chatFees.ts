/*
 * The paid chats on ad sites (lonely.ai, sorrywriter.ai) bill like agent.chat: a fee per message plus
 * a fee per word, charged from Coinbin when the message is sent. A message the wallet can't cover
 * isn't sent.
 */
import type { GameState } from './state';
import { money } from './core';
import { promptWords } from './agent';

export type PaidChat = 'lonely' | 'sorry';

export const CHAT_FEES: Record<PaidChat, { prompt: number; word: number; memo: string }> = {
  lonely: { prompt: 1, word: 0.02, memo: 'Lonely.ai · messages' },
  sorry: { prompt: 2, word: 0.03, memo: 'SorryWriter · apologies' },
};

/** The exact price of sending `text`: the per-message fee plus the per-word fee. */
export function chatCost(chat: PaidChat, text: string) {
  const f = CHAT_FEES[chat];
  const words = promptWords(text);
  const wordFee = Math.round(f.word * words * 100) / 100;
  return { base: f.prompt, perWord: f.word, words, wordFee, total: Math.round((f.prompt + wordFee) * 100) / 100 };
}

/** Charge for one message. Returns an error, and charges nothing, when the wallet can't cover it. */
export function chargeChat(s: GameState, chat: PaidChat, text: string): string | undefined {
  const { total } = chatCost(chat, text);
  if (s.values.crypto < total) return `This message costs ${total.toFixed(2)} DOLR. Your wallet doesn't have enough.`;
  money(s, -total, CHAT_FEES[chat].memo);
  return undefined;
}
