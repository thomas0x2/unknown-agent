/*
 * The game's Writer: when Jev finds nothing in what the player wrote, the character they wrote to
 * answers in their own voice through Gemma (game/llm.ts, game/characters.ts). 'agent' is agent.chat;
 * an email address or Y handle maps to a character through content/contacts.json. When no model is
 * loaded, or the "Misses" setting says scripted, the scripted fallback is used, so play never blocks
 * on the model.
 */
import type { Writer, WriteReq } from '../engine';
import type { Content } from '../content/schema';
import { LLM } from './llm';

/** What was sent to the model and what came back, for dev mode. */
function runDebug(character: string): string[] {
  const r = LLM.lastRun;
  if (!r) return [`Gemma (${character}) was not run: ${LLM.lastMiss || 'unknown reason'}`];
  return [
    `Gemma: character "${character}", ${LLM.detail || LLM.label()}, temperature ${r.temperature}, repetition penalty ${r.penalty}, ${r.ms} ms`,
    ...r.messages.map((m) => `${m.role}: ${m.content}`),
    `raw output: ${r.raw ?? '(none)'}`,
  ];
}

export function makeGemmaWriter(content: Content): Writer {
  const characterFor = (as: string) => {
    const id = as === 'agent' ? 'agent' : content.contacts.find((x) => x.key.toLowerCase() === as.toLowerCase())?.character;
    return id ? content.characters?.find((c) => c.id === id) : undefined;
  };
  return {
    async write(req: WriteReq) {
      // the Terminal's local model passes its own persona
      if (req.persona) {
        if (LLM.status !== 'ready') return { text: req.fallback, llm: false };
        const t = await LLM.generate(req.prompt, { persona: req.persona });
        return t ? { text: t, llm: true } : { text: req.fallback, llm: false };
      }
      if (LLM.settings.misses === 'scripted') return { text: req.fallback, llm: false, debug: ['Misses setting is "Scripted lines", so Gemma was not asked'] };
      const ch = characterFor(req.as);
      if (!ch) return { text: req.fallback, llm: false, note: `no character for ${req.as}` };
      LLM.lastRun = null;
      const t = await LLM.speak(ch, req.prompt);
      const debug = runDebug(ch.id);
      return t ? { text: t, llm: true, debug } : { text: req.fallback, llm: false, note: LLM.lastMiss, debug };
    },
  };
}
