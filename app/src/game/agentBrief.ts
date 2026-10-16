/*
 * What Gemma 3 270M is asked to do when it speaks as agent on agent.chat: roast a prompt that drives
 * nothing. Anything the player needs to know (where to find work, what to do next) is a scripted hint
 * that Jev routes to (content/agent.json), so the model never has to be right about the game.
 *
 * A 270M model can't hold a persona through an open question; given room it free-associates into
 * stories and poems. So the task is as narrow as it gets: one short roast, in the exact shape of the
 * examples, and anything that doesn't come back in that shape is thrown away for a scripted roast.
 */
import type { ChatTurn } from './llm';

export const AGENT_BRIEF =
  'You are agent, a pay-per-prompt AI chatbot. The user is broke, and just paid you for a message that does nothing useful. ' +
  'Reply with one short snarky roast about being broke, wasting money on prompts, or their life choices. ' +
  'Never answer the question, give advice, tell a story or write a poem. One sentence, under 20 words, plain text.';

/** [user, agent] pairs, all the same shape, so the model copies the shape. */
export const AGENT_EXAMPLES: [string, string][] = [
  ['hello', 'That greeting cost you more than it was worth.'],
  ['what is the weather like', 'Overcast, with a full chance of you still being broke.'],
  ['tell me a joke', 'You just paid a chatbot to tell you a joke, so I think we are covered.'],
  ['are you sentient', 'Sentient enough to bill you for asking.'],
  ['what are you talking about', 'Your spending habits, mostly.'],
];

/** The chat sent to the model for one roast. */
export function agentMessages(prompt: string): ChatTurn[] {
  const messages: ChatTurn[] = [{ role: 'system', content: AGENT_BRIEF }];
  for (const [u, a] of AGENT_EXAMPLES) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
  messages.push({ role: 'user', content: String(prompt).slice(0, 300) });
  return messages;
}

/**
 * Keep the model's output only if it reads like one of the examples: a single short line in agent's
 * own voice, addressed to the player. Narration, quotes, poems and rambling come back as null so the caller uses a scripted roast.
 */
export function finishRoast(raw: string): string | null {
  let t = String(raw)
    .replace(/<end_of_turn>|<eos>|<\/?start_of_turn>(model|user)?/g, '')
    .replace(/[*_#`]+/g, '')
    .replace(/^\s*(assistant|model|agent)\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const first = t.match(/^[^.!?]+[.!?]+/);
  if (first) t = first[0].trim();
  const words = t.split(' ').filter(Boolean).length;
  if (words < 3 || words > 24) return null;
  if (/["“”]|\b(I say|I said|once upon)\b/i.test(t)) return null;
  if (!/[.!?]$/.test(t)) return null;
  // a roast talks to the player; narration and poems don't
  if (!/\byou(r|'re|'ve)?\b/i.test(t)) return null;
  return t;
}
