/*
 * The game's Writer: when Jev finds nothing in what the player wrote, the character they wrote to
 * answers in their own voice through Gemma (game/llm.ts, game/characters.ts). 'agent' is agent.chat;
 * an email address or Y handle maps to a character through content/contacts.json. When no model is
 * loaded, or its reply doesn't pass, the scripted fallback is used, so play never blocks on the model.
 */
import type { Writer, WriteReq } from '../engine';
import type { Content } from '../content/schema';
import { LLM } from './llm';

export function makeGemmaWriter(content: Content): Writer {
  const characterFor = (as: string) => {
    const id = as === 'agent' ? 'agent' : content.contacts.find((x) => x.key.toLowerCase() === as.toLowerCase())?.character;
    return id ? content.characters?.find((c) => c.id === id) : undefined;
  };
  return {
    async write(req: WriteReq) {
      if (LLM.status !== 'ready') return { text: req.fallback, llm: false };
      // the Terminal's local model passes its own persona
      if (req.persona) {
        const t = await LLM.generate(req.prompt, { persona: req.persona });
        return t ? { text: t, llm: true } : { text: req.fallback, llm: false };
      }
      const ch = characterFor(req.as);
      if (!ch) return { text: req.fallback, llm: false };
      const t = await LLM.speak(ch, req.prompt);
      return t ? { text: t, llm: true } : { text: req.fallback, llm: false };
    },
  };
}
