/*
 * The Writer is how the engine gets human-sounding text without knowing about the model. The game wires
 * Claude Haiku in (game/misses.ts); tests and the headless engine pass a stub that returns the
 * scripted fallback. Jev decides *what* happens; the Writer only phrases a reply when the content
 * gives a brief instead of fixed text, or when nothing was triggered.
 */
export interface WriteReq {
  /** Who is speaking: 'agent', or an email address / Y handle mapped to a character in content. */
  as: string;
  /** A brief for the reply, or the player's text to react to. */
  prompt: string;
  /** Scripted text to fall back to if no model answers. */
  fallback: string;
  /** Longer (email body) vs. a line or two. */
  long?: boolean;
  /** Grounding facts (wallet balance, last cost). */
  facts?: string;
  /**
   * What was said before `prompt`, oldest first: the email thread or the recent agent.chat transcript,
   * scripted lines included. `from` is 'player', 'self' (the speaker), or another sender's name.
   */
  history?: HistoryLine[];
  /** Speak as this character (content/characters.json) instead of the one `as` maps to. */
  character?: string;
  /** What the character is doing right now (a Swaplist seller: the listing, the buyer's question). */
  situation?: string;
  /** 'query': answer the question (agent.chat queries), looking up the world and the player's screens. */
  mode?: 'query';
  /** The game day and clock (minutes since midnight), so a lookup only finds what the player could know by now. */
  day?: number;
  min?: number;
  /** The player's story flags, so a lookup only finds the branch they're on. Never shown to the model. */
  flags?: string[];
}

export interface HistoryLine { from: string; text: string }

export interface Writer {
  /** `note` says why the scripted fallback was used when a model was asked (shown next to the line). */
  write(req: WriteReq): Promise<{ text: string; llm: boolean; note?: string; debug?: string[]; by?: string }>;
}

/** The headless/test writer: always the scripted fallback, never a model. */
export const scriptedWriter: Writer = {
  async write(req) { return { text: req.fallback, llm: false }; },
};
