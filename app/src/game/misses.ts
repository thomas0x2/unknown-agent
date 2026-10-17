/*
 * The game's Writer: when Jev finds nothing in what the player wrote (a miss), the character they
 * wrote to answers in their own voice; when Jev reads an agent.chat prompt as a question about the
 * world (a query), agent answers it, looking things up first. The "Misses" setting on agent.chat picks who writes that
 * line: Claude Haiku through the local proxy (game/haiku.ts), or the scripted fallback lines from
 * content. 'agent' is agent.chat; an email address or Y handle maps to a character through
 * content/contacts.json. If Haiku can't answer, the scripted line is used, so play never blocks.
 */
import type { Writer, WriteReq } from '../engine';
import type { Content } from '../content/schema';
import { haikuReply } from './haiku';
import type { PlayerView } from './playerView';

export type Misses = 'haiku' | 'scripted';
/** Who pays for Haiku replies: the Claude subscription logged in to the claude CLI (dev), or ANTHROPIC_API_KEY. */
export type HaikuVia = 'subscription' | 'api';
/**
 * Online: every judgment goes to Jev (there is no keyword fallback) and misses follow the Misses
 * setting. Offline: a local keyword matcher decides instead of Jev and every miss is a scripted line,
 * so the game needs no network and no keys. An explicit mode the player picks, not a fallback for
 * when Jev is down.
 */
export type Net = 'online' | 'offline';
interface MissSettings { misses: Misses; haikuVia: HaikuVia; net: Net }

const KEY = 'unknown-agent-misses';

function load(): MissSettings {
  const d: MissSettings = { misses: 'haiku', haikuVia: 'api', net: 'online' };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (saved.misses === 'scripted') d.misses = 'scripted';
    if (saved.haikuVia === 'subscription') d.haikuVia = 'subscription';
    if (saved.net === 'offline') d.net = 'offline';
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
  /** Offline mode: the keyword matcher decides and every miss is a scripted line. */
  get offline(): boolean { return this.settings.net === 'offline'; }
  /** Whether a miss is answered by a scripted line (offline, or the Misses setting says so) rather than Haiku. */
  get scriptedMisses(): boolean { return this.offline || this.settings.misses === 'scripted'; }
  /** Who wrote model replies, for labels. */
  label(): string { return this.settings.haikuVia === 'api' ? 'Claude Haiku 5.5 · API' : 'Claude Haiku 5.5 · subscription'; }
}

export const MISSES = new MissesSetting();

/**
 * `view` reads what the player's screens show right now, for Haiku to look things up in on a query;
 * `searching` is told while a query's answer is being written, so agent.chat can show the search.
 */
export function makeWriter(content: Content, view?: () => PlayerView, searching?: (on: boolean) => void): Writer {
  const characterFor = (as: string) => {
    const id = as === 'agent' ? 'agent' : content.contacts.find((x) => x.key.toLowerCase() === as.toLowerCase())?.character;
    return id ? content.characters?.find((c) => c.id === id) : undefined;
  };
  return {
    async write(req: WriteReq) {
      if (MISSES.scriptedMisses) return { text: req.fallback, llm: false, debug: [MISSES.offline ? 'Offline mode, so the scripted line is used' : 'Misses setting is "Scripted lines", so Haiku was not asked'] };
      const ch = req.character ? content.characters?.find((c) => c.id === req.character) : characterFor(req.as);
      if (!ch) return { text: req.fallback, llm: false, note: `no character for ${req.as}` };
      const query = req.mode === 'query' ? { known: req.known ?? { public: [], hint: [] }, view: view?.() } : undefined;
      const near = (req.mode === 'near' || req.mode === 'refuse') && req.near ? { ...req.near, refuse: req.mode === 'refuse' } : undefined;
      if (query) searching?.(true);
      const h = await haikuReply(ch, req.prompt, MISSES.settings.haikuVia, req.history, req.situation, query, near).finally(() => { if (query) searching?.(false); });
      return h.text ? { text: h.text, llm: true, debug: h.debug, by: MISSES.label() } : { text: req.fallback, llm: false, note: h.note, debug: h.debug };
    },
  };
}
