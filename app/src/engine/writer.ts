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
  /** Speak as this character (content/characters/) instead of the one `as` maps to. */
  character?: string;
  /** What the character is doing right now (a Swaplist seller: the listing, the buyer's question). */
  situation?: string;
  /**
   * 'query': answer the player's question about the world (agent.chat queries) from `known`.
   * 'near': a near-miss: say what the prompt was missing (`near`), like the scripted lines do.
   * 'refuse': a query about something classified: refuse it (`near.why` says what it asked about).
   * 'y': a Y regular replying under the player's post (`prompt` is the post, `situation` who they are).
   */
  mode?: 'query' | 'near' | 'refuse' | 'y';
  /** A near-miss: why the prompt fell short, as the player should hear it, and the scripted lines that say so (the reply says the same, nothing more). */
  near?: { why: string; lines: string[] };
  /** What the wiki lets a query answer tell (`public`) and only hint at (`hint`), already cut to what the player may know now. */
  known?: { public: string[]; hint: string[] };
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
