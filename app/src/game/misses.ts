/*
 * The game's Writer: when Jev finds nothing in what the player wrote (a miss), the character they
 * wrote to answers in their own voice. The "Misses" setting on agent.chat picks who writes that
 * line: Claude Haiku through the local proxy (game/haiku.ts), or the scripted fallback lines from
 * content. 'agent' is agent.chat; an email address or Y handle maps to a character through
 * content/contacts.json. If Haiku can't answer, the scripted line is used, so play never blocks.
 */
import type { Writer, WriteReq } from '../engine';
import type { Content } from '../content/schema';
import { haikuReply } from './haiku';

export type Misses = 'haiku' | 'scripted';
/** Who pays for Haiku replies: the Claude subscription logged in to the claude CLI (dev), or ANTHROPIC_API_KEY. */
export type HaikuVia = 'subscription' | 'api';
interface MissSettings { misses: Misses; haikuVia: HaikuVia }

const KEY = 'unknown-agent-misses';

function load(): MissSettings {
  const d: MissSettings = { misses: 'haiku', haikuVia: 'api' };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved.misses === 'scripted') d.misses = 'scripted';
    if (saved.haikuVia === 'subscription') d.haikuVia = 'subscription';
  } catch { /* storage off */ }
  return d;
}

class MissesSetting {
  settings = load();
  private listeners = new Set<() => void>();
  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  set(patch: Partial<MissSettings>): void {
    Object.assign(this.settings, patch);
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage off */ }
    this.listeners.forEach((fn) => fn());
  }
  /** Who wrote model replies, for labels. */
  label(): string { return this.settings.haikuVia === 'api' ? 'Claude Haiku 5.5 · API' : 'Claude Haiku 5.5 · subscription'; }
}

export const MISSES = new MissesSetting();

export function makeWriter(content: Content): Writer {
  const characterFor = (as: string) => {
    const id = as === 'agent' ? 'agent' : content.contacts.find((x) => x.key.toLowerCase() === as.toLowerCase())?.character;
    return id ? content.characters?.find((c) => c.id === id) : undefined;
  };
  return {
    async write(req: WriteReq) {
      if (MISSES.settings.misses === 'scripted') return { text: req.fallback, llm: false, debug: ['Misses setting is "Scripted lines", so Haiku was not asked'] };
      const ch = characterFor(req.as);
      if (!ch) return { text: req.fallback, llm: false, note: `no character for ${req.as}` };
      const h = await haikuReply(ch, req.prompt, MISSES.settings.haikuVia, req.history, req.day);
      return h.text ? { text: h.text, llm: true, debug: h.debug, by: MISSES.label() } : { text: req.fallback, llm: false, note: h.note, debug: h.debug };
    },
  };
}
