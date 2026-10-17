/*
 * The standalone wiki (wiki.html): the same editor as wiki.dev in the game (ui/wiki.ts), on the same
 * files (content/wiki/*.md), for a real browser tab at http://localhost:5173/wiki.html while
 * `npm run dev` runs. Saves need `npm run proxy` too. A save in either copy lands in the file and
 * Vite passes it to the other (content/wikiFiles.ts), so they always match.
 *
 * There's no game here, so "view as" picks the day, time and flags to judge the tags by. What has
 * reached the player by then (for "if seen" rules and embeds) is estimated from each event's trigger.
 */
import '../../src/style.css';
import { loadContent } from './content/load';
import { onWikiFiles } from './content/wikiFiles';
import { wikiView, wikiClickIn, wikiInputIn, clock, type WikiHost } from './ui/wiki';
import { queryCtx, estimatedState, CLOCK, type GameState } from './engine';

const content = loadContent();
const KEY = 'unknown-agent-wiki-view';
const view = { day: 1, min: CLOCK.wake, flags: [] as string[] };
try { Object.assign(view, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage off */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(view)); } catch { /* storage off */ } };

/** Every flag the content mentions, to suggest in "view as" and in rule rows. */
const ALL_FLAGS = [...new Set([
  ...content.events.flatMap((e) => [...(e.trigger.flagsAll ?? []), ...(e.trigger.flagsNone ?? [])]),
  ...(content.wiki ?? []).flatMap((p) => p.sections.flatMap((s) => [s.ifFlag?.flag ?? '', ...s.blocks.flatMap((b) => [...`${b.rule} ${b.text}`.matchAll(/if\s+!?([a-z][a-z0-9_]+)/g)].map((m) => m[1]))])),
].filter((f) => f && f !== 'seen'))].sort();

const viewState = (): GameState => estimatedState(content, view.day, view.min, view.flags);

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const host: WikiHost = {
  content,
  ctx: () => queryCtx(viewState(), content),
  ctxLabel: () => 'what has arrived is estimated from triggers',
  flags: () => ALL_FLAGS,
  name: 'Unknown Agent wiki',
  controls: () => `<span class="wk-view">View as day <select id="wv-day">${Array.from({ length: 21 }, (_, i) => `<option ${i + 1 === view.day ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
    at <input id="wv-time" type="time" value="${clock(view.min)}">
    with flags <input id="wv-flags" value="${esc(view.flags.join(', '))}" placeholder="none" list="wv-all" size="28"><datalist id="wv-all">${ALL_FLAGS.map((f) => `<option value="${esc(f)}">`).join('')}</datalist></span>`,
  open: (file) => { location.hash = file.replace(/\.md$/, ''); },
  repaint: () => render(),
};

const root = document.getElementById('wiki')!;
function render(): void {
  // a repaint keeps what's typed and where the cursor is
  const typed = new Map([...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input[id], textarea[id], select[id]')].map((el) => [el.id, el.value]));
  const focus = document.activeElement as HTMLInputElement | null;
  const at = focus?.id ? { id: focus.id, start: focus.selectionStart, end: focus.selectionEnd } : null;
  root.innerHTML = wikiView(host, decodeURIComponent(location.hash.slice(1)) || undefined);
  for (const [id, v] of typed) {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el && !id.startsWith('wv-') && id !== 'wk-search') el.value = v;
  }
  if (at) {
    const el = document.getElementById(at.id) as HTMLInputElement | null;
    el?.focus();
    try { if (el && at.start != null) el.setSelectionRange(at.start, at.end); } catch { /* not a text field */ }
  }
}

root.addEventListener('click', (e) => { if (e.target instanceof HTMLElement) wikiClickIn(e.target, host, e); });
root.addEventListener('input', (e) => { if (e.target instanceof HTMLElement) wikiInputIn(e.target, host); });
root.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.id === 'wv-day') view.day = Number(t.value) || 1;
  else if (t.id === 'wv-time') { const [h, m] = t.value.split(':').map(Number); if (Number.isFinite(h)) view.min = h * 60 + (m || 0); }
  else if (t.id === 'wv-flags') view.flags = t.value.split(/[\s,]+/).filter(Boolean);
  else return;
  keep();
  render();
});
window.addEventListener('hashchange', render);
onWikiFiles((pages) => { content.wiki = pages; render(); });
render();
