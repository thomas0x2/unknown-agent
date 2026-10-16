/*
 * Loads the content bundle from the JSON files in /content. Uses Vite's glob import so new files are
 * picked up with no code change. Empty folders are fine — the game boots to an empty browser.
 */
import type { Content, GameEvent, AppTemplate, FillerPost, Contact, AgentContent, Character, MarketContent } from './schema';

export function loadContent(): Content {
  const eventMods = import.meta.glob('../../content/events/*.json', { eager: true }) as Record<string, { default: GameEvent }>;
  const appMods = import.meta.glob('../../content/apps/*.json', { eager: true }) as Record<string, { default: AppTemplate }>;
  const fillerMods = import.meta.glob('../../content/y_filler.json', { eager: true }) as Record<string, { default: FillerPost[] }>;
  const spamMods = import.meta.glob('../../content/qmail_spam.json', { eager: true }) as Record<string, { default: FillerPost[] }>;
  const trendMods = import.meta.glob('../../content/trending.json', { eager: true }) as Record<string, { default: Record<number, string[]> }>;
  const contactMods = import.meta.glob('../../content/contacts.json', { eager: true }) as Record<string, { default: Contact[] }>;
  const characterMods = import.meta.glob('../../content/characters.json', { eager: true }) as Record<string, { default: Character[] }>;
  const marketMods = import.meta.glob('../../content/y_market.json', { eager: true }) as Record<string, { default: MarketContent }>;
  const agentMods = import.meta.glob('../../content/agent.json', { eager: true }) as Record<string, { default: AgentContent }>;

  const events = Object.values(eventMods).map((m) => m.default);
  const apps: Record<string, AppTemplate> = {};
  for (const m of Object.values(appMods)) apps[m.default.id] = m.default;
  const yFiller = Object.values(fillerMods)[0]?.default ?? [];
  const qmailSpam = Object.values(spamMods)[0]?.default ?? [];
  const trending = Object.values(trendMods)[0]?.default ?? {};
  const contacts = Object.values(contactMods)[0]?.default ?? [];
  const agent = Object.values(agentMods)[0]?.default;
  const characters = Object.values(characterMods)[0]?.default ?? [];
  const yMarket = Object.values(marketMods)[0]?.default;

  return { events, apps, yFiller, qmailSpam, trending, contacts, characters, agent, yMarket };
}
