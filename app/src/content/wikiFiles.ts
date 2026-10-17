/*
 * The wiki's pages, from content/wiki/*.md. Both the game (wiki.dev, agent.chat queries) and the
 * standalone wiki page read them here. When a file changes (a save from either editor goes through
 * the proxy into the file), Vite hot-swaps this module and every open page gets the new pages through
 * onWikiFiles, with no reload, so the two editors always show the same files.
 */
import { parseWikiPage, type WikiPage } from '../engine/wiki';

const FILES = import.meta.glob('../../content/wiki/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every page but the format guide (README.md). */
export function wikiPages(): WikiPage[] {
  return Object.entries(FILES).filter(([path]) => !path.endsWith('/README.md')).map(([path, md]) => parseWikiPage(md, path.split('/').pop()!));
}

type Listener = (pages: WikiPage[]) => void;
// kept on globalThis so the listeners survive this module being swapped
const listeners: Set<Listener> = ((globalThis as { __wikiListeners?: Set<Listener> }).__wikiListeners ??= new Set());

/** Calls `fn` with the fresh pages whenever a wiki file changes on disk (dev server only). */
export function onWikiFiles(fn: Listener): void { listeners.add(fn); }

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    if (!mod) return;
    const pages = (mod as unknown as { wikiPages: () => WikiPage[] }).wikiPages();
    for (const fn of listeners) fn(pages);
  });
}
