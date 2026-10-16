/*
 * The game's Writer: it phrases replies with Gemma (game/llm.ts), looking up the persona for an
 * email address or Y handle in the content. When no model is loaded, or it can't answer, it returns
 * the scripted fallback, so play never blocks on the model.
 */
import type { Writer, WriteReq } from '../engine';
import type { Content } from '../content/schema';
import { LLM } from './llm';

export function makeGemmaWriter(content: Content): Writer {
  return {
    async write(req: WriteReq) {
      if (LLM.status !== 'ready') return { text: req.fallback, llm: false };
      // the Terminal's local model passes its own persona
      if (req.persona) {
        const t = await LLM.generate(req.prompt, { persona: req.persona });
        return t ? { text: t, llm: true } : { text: req.fallback, llm: false };
      }
      if (req.as === 'agent') {
        const t = await LLM.generate(req.prompt, { facts: req.facts, long: req.long });
        return t ? { text: t, llm: true } : { text: req.fallback, llm: false };
      }
      const c = content.contacts.find((x) => x.key.toLowerCase() === req.as.toLowerCase());
      if (!c) return { text: req.fallback, llm: false };
      const t = await LLM.writeReply(c.persona, c.examples ?? [], { fromName: c.name ?? req.as, subject: '', body: req.prompt });
      return t ? { text: t, llm: true } : { text: req.fallback, llm: false };
    },
  };
}
