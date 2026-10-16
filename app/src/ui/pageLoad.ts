/*
 * A short, fake network wait when a tab goes to a different website, like a real browser: the tab
 * shows a spinner and the page stays blank under a thin progress bar for a few hundred ms. Switching
 * to a tab that already shows its page is instant, as is moving around inside the same site.
 */

/** How long a page "loads", in ms. */
export const LOAD_MS = { min: 220, max: 520 };

const host = (url: string) => url.trim().toLowerCase().split(/[/?#]/)[0];

/** What each tab last showed, and the tabs still loading (tab id → when the page is ready). */
const seen = new Map<number, string>();
const until = new Map<number, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let booted = false;

/**
 * Called on every paint with each tab's URL. Starts a load for a tab whose URL moved to another
 * site since the last paint (or a tab opened straight onto a site), and calls `done` when a load finishes so the page can be drawn.
 * Returns the ids of the tabs that are loading now.
 */
export function trackLoads(tabs: { id: number; url: string }[], done: () => void, now = Date.now(), rand = Math.random): Set<number> {
  const ids = new Set(tabs.map((t) => t.id));
  for (const id of [...seen.keys()]) if (!ids.has(id)) { seen.delete(id); until.delete(id); }
  for (const t of tabs) {
    const prev = seen.get(t.id);
    seen.set(t.id, t.url);
    if (prev === t.url || (prev == null && !booted)) continue;
    if (host(t.url) === 'newtab' || (prev != null && host(prev) === host(t.url))) { until.delete(t.id); continue; }
    until.set(t.id, now + LOAD_MS.min + Math.round(rand() * (LOAD_MS.max - LOAD_MS.min)));
  }
  booted = true;
  const loading = new Set<number>();
  for (const [id, end] of until) { if (end > now) loading.add(id); else until.delete(id); }
  if (timer) { clearTimeout(timer); timer = null; }
  if (loading.size) {
    const next = Math.min(...[...loading].map((id) => until.get(id)!));
    timer = setTimeout(() => { timer = null; done(); }, Math.max(0, next - now));
  }
  return loading;
}

/** The blank page shown while a site loads. */
export const LOADING_HTML = '<div class="pl-page" aria-busy="true" aria-label="Loading"><div class="pl-bar"></div></div>';

/** For tests: forget every tab. */
export function resetLoads(): void { seen.clear(); until.clear(); booted = false; if (timer) clearTimeout(timer); timer = null; }
