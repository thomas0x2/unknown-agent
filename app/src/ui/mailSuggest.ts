/*
 * Qmail's To-field suggestions, Gmail style: a list under the field that narrows as you type, matching
 * names and addresses. It works on the live DOM instead of re-rendering the page, so the field keeps
 * focus and the list stays open between keystrokes.
 */
export interface Contact { addr: string; name: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const list = () => document.getElementById('qm-sugg') as HTMLUListElement | null;
const contacts = (ul: HTMLElement): Contact[] => { try { return JSON.parse(ul.dataset.contacts || '[]'); } catch { return []; } };

/** Show the contacts matching what's typed so far; nothing while the field is empty. */
export function showSuggestions(input: HTMLInputElement): void {
  const ul = list();
  if (!ul) return;
  const q = input.value.trim().toLowerCase();
  if (!q) { hideSuggestions(); return; }
  // names or addresses that start with what's typed come first, then any word in the name, then anywhere
  const rank = (c: Contact) => {
    const n = c.name.toLowerCase(), a = c.addr.toLowerCase();
    if (n.startsWith(q) || a.startsWith(q)) return 0;
    if (n.split(/[\s·,&]+/).some((w) => w.startsWith(q))) return 1;
    return n.includes(q) || a.includes(q) ? 2 : -1;
  };
  const hits = contacts(ul).map((c) => ({ c, r: rank(c) })).filter((x) => x.r >= 0).sort((x, y) => x.r - y.r).map((x) => x.c);
  // nothing left to suggest once the field holds exactly one known address
  if (!hits.length || (hits.length === 1 && hits[0].addr.toLowerCase() === q)) { hideSuggestions(); return; }
  ul.innerHTML = hits.slice(0, 6).map((c, i) => `<li role="option" data-addr="${esc(c.addr)}" class="${i === 0 ? 'on' : ''}"><b>${esc(c.name)}</b><span>${esc(c.addr)}</span></li>`).join('');
  ul.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

export function hideSuggestions(): void {
  const ul = list();
  if (ul) { ul.hidden = true; ul.innerHTML = ''; }
  document.getElementById('mail-to')?.setAttribute('aria-expanded', 'false');
}

/** Arrow keys move the highlight, Enter or Tab takes it, Escape closes. Returns true when handled. */
export function suggestionKey(e: KeyboardEvent, pick: (addr: string) => void): boolean {
  const ul = list();
  if (!ul || ul.hidden) return false;
  const items = [...ul.querySelectorAll<HTMLLIElement>('li')];
  const at = items.findIndex((li) => li.classList.contains('on'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
    items.forEach((li, i) => li.classList.toggle('on', i === next));
    return true;
  }
  if ((e.key === 'Enter' || e.key === 'Tab') && at >= 0) { pick(items[at].dataset.addr!); return true; }
  if (e.key === 'Escape') { hideSuggestions(); return true; }
  return false;
}
