/*
 * Loads the content bundle from the JSON files in /content. Uses Vite's glob import so new files are
 * picked up with no code change. Empty folders are fine — the game boots to an empty browser.
 */
import type { Content, GameEvent, AppTemplate, FillerPost } from './schema';

export function loadContent(): Content {
  const eventMods = import.meta.glob('../../content/events/*.json', { eager: true }) as Record<string, { default: GameEvent }>;
  const appMods = import.meta.glob('../../content/apps/*.json', { eager: true }) as Record<string, { default: AppTemplate }>;
  const fillerMods = import.meta.glob('../../content/y_filler.json', { eager: true }) as Record<string, { default: FillerPost[] }>;
  const spamMods = import.meta.glob('../../content/qmail_spam.json', { eager: true }) as Record<string, { default: FillerPost[] }>;

  const events = Object.values(eventMods).map((m) => m.default);
  const apps: Record<string, AppTemplate> = {};
  for (const m of Object.values(appMods)) apps[m.default.id] = m.default;
  const yFiller = Object.values(fillerMods)[0]?.default ?? [];
  const qmailSpam = Object.values(spamMods)[0]?.default ?? [];

  return { events, apps, yFiller, qmailSpam };
}
