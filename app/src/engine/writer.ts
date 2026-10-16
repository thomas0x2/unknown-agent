/*
 * The Writer is how the engine gets human-sounding text without knowing about Gemma. The game wires
 * the local model in (game/gemma.ts); tests and the headless engine pass a stub that returns the
 * scripted fallback. Jev decides *what* happens; the Writer only phrases a reply when the content
 * gives a brief instead of fixed text, or when nothing was triggered.
 */
export interface WriteReq {
  /** Who is speaking: 'agent', or an email address / Y handle with a persona in content. */
  as: string;
  /** A brief for the reply, or the player's text to react to. */
  prompt: string;
  /** Scripted text to fall back to if no model answers. */
  fallback: string;
  /** Longer (email body) vs. a line or two. */
  long?: boolean;
  /** Grounding facts (wallet balance, last cost). */
  facts?: string;
  /** An explicit persona override (the Terminal's local model), bypassing the content lookup. */
  persona?: string;
}

export interface Writer {
  write(req: WriteReq): Promise<{ text: string; llm: boolean }>;
}

/** The headless/test writer: always the scripted fallback, never a model. */
export const scriptedWriter: Writer = {
  async write(req) { return { text: req.fallback, llm: false }; },
};
