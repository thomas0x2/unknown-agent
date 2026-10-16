/*
 * Controller. Boots the store, paints the legacy shell slots from the view on every change, and
 * wires input (event delegation, same architecture as the legacy game). No framework: the shell in
 * index.html is static and we fill #tabs / #bookmarks / #viewport / the taskbar / #overlay / #dev.
 */
import '../../src/style.css';
import './ui/satchel.css';
import './ui/yowl.css';
import './ui/forkyard.css';
import './ui/qmail.css';
import './ui/desktop.css';
import './ui/qdrive.css';
import './ui/ads.css';
import './ui/empire.css';
import './ui/appsite.css';
import './ui/devOptions.css';
import { showSuggestions, hideSuggestions, suggestionKey } from './ui/mailSuggest';
import { GameStore } from './game/store';
import { loadContent } from './content/load';
import { localStorageStore } from './engine';
import { JEV } from './game/backendJev';
import { MISSES, makeWriter, type Misses, type HaikuVia } from './game/misses';
import * as V from './ui/view';
import { route } from './sites/registry';
import { listSlots } from './game/saves';
import { devEditHtml } from './ui/devEdit';
import type { MeterId } from './engine';
import { newPageLoad } from './ui/ads';

const content = loadContent();
const writer = makeWriter(content);
const store = new GameStore(content, JEV, writer, localStorageStore());

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const val = (sel: string) => ($(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
const trendingToday = () => store.content.trending[store.state.values.day] ?? [];

let lastSite = '';
let lastUrl = '';

// Unsent text in every page's fields, keyed by the page's URL. Cleared when a form is sent.
const drafts = new Map<string, Record<string, string>>();
let shownUrl: string | null = null;
const SKIP_TYPES = new Set(['checkbox', 'radio', 'hidden', 'submit', 'button', 'file', 'range']);
function readFields(root: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  root.querySelectorAll<HTMLInputElement>('textarea[id], input[id]').forEach((el) => { if (!SKIP_TYPES.has(el.type)) out[el.id] = el.value; });
  return out;
}
function forgetDrafts(): void { drafts.clear(); shownUrl = null; }
/** Empties a field after its text was sent, so the draft does not come back. */
function clearField(id: string): void {
  const el = document.getElementById(id) as HTMLInputElement | null; if (el) el.value = '';
  for (const rec of drafts.values()) delete rec[id];
}
function render(): void {
  const s = store.state;
  const r = route(store.url, s);
  // a different page (tab switch, back to a site) is a fresh page load: draw new ads
  if (store.url !== lastUrl) { newPageLoad(); lastUrl = store.url; }

  $('#tabs')!.innerHTML = V.tabsHtml(store);
  const addr = $<HTMLInputElement>('#address')!;
  if (document.activeElement !== addr) addr.value = V.addressValue(store);
  $<HTMLButtonElement>('#nav-back')!.disabled = !store.canBack;
  $<HTMLButtonElement>('#nav-fwd')!.disabled = !store.canForward;
  $('#bookmarks')!.innerHTML = V.bookmarksHtml(store);

  const vp = $('#viewport')!;
  // unsent text is saved per page, so leaving a site (another tab, a bookmark) and coming back finds it again
  if (shownUrl != null) drafts.set(shownUrl, readFields(vp));
  const keep = drafts.get(store.url) ?? {};
  let focusId: string | null = null;
  let caret: [number | null, number | null] | null = null;
  if (document.activeElement && vp.contains(document.activeElement)) {
    const f = document.activeElement as HTMLInputElement;
    focusId = f.id || null;
    // re-rendering replaces the field, so remember where the caret was or typing lands at the start
    try { caret = [f.selectionStart, f.selectionEnd]; } catch { caret = null; }
  }

  vp.innerHTML = V.page(store, r);
  shownUrl = store.url;
  const site = V.viewportSite(store);
  if (vp.dataset.site !== site) vp.scrollTop = 0;
  vp.dataset.site = site;
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id) as HTMLInputElement | null; if (el && !el.disabled) el.value = v; }
  if (focusId) {
    const el = document.getElementById(focusId) as HTMLInputElement | null;
    if (el && !el.disabled) {
      el.focus();
      if (caret && caret[0] != null && caret[1] != null) try { el.setSelectionRange(caret[0], caret[1]); } catch { /* field type without a caret */ }
    }
  }

  // taskbar
  $('#dk-task')!.title = V.taskTitle(store);
  $('#clock')!.innerHTML = V.clockHtml(s);
  const menu = $('#startmenu')!; menu.hidden = !store.ui.start; menu.innerHTML = store.ui.start ? V.startMenuHtml(store) : '';
  const startBtn = $('#dk-home')!; startBtn.classList.toggle('on', store.ui.start); startBtn.setAttribute('aria-expanded', String(store.ui.start));

  const ov = $('#overlay')!; const oh = V.overlayHtml(store); ov.innerHTML = oh; ov.hidden = !oh;
  const dev = $('#dev')!; dev.hidden = !store.ui.dev; if (store.ui.dev) dev.innerHTML = V.devHtml(store);
  const dve = $('#devedit')!; const showEdit = store.ui.dev && store.ui.devEdit; dve.hidden = !showEdit; if (showEdit) dve.innerHTML = devEditHtml(store);

  if (site === 'agent') { const log = $('#ua-log'); if (log) log.scrollTop = log.scrollHeight; updateCost(); }
  if (site === 'terminal') { const log = $('#tm-log'); if (log) log.scrollTop = log.scrollHeight; const t = $('#term-input'); if (t && window.innerWidth > 700 && !store.busy) t.focus(); }
  lastSite = site;
}
store.subscribe(render);
MISSES.onChange(render);
JEV.onChange(render);
void JEV.probe();

function updateCost(): void {
  const est = $('#cost-est'); const input = $<HTMLTextAreaElement>('#prompt-input');
  if (!est || !input) return;
  const c = V.costLine(store.state, input.value);
  est.textContent = c.text;
  est.classList.toggle('neg', c.over);
}

function toast(title: string, body: string, kind = 'note'): void {
  const box = $('#toasts'); if (!box) return;
  const el = document.createElement('div');
  el.className = `toast t-${kind}`;
  el.innerHTML = `<b>${title}</b><span>${body}</span>`;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild!.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 4200);
}

// ── clicks ──
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-nav],[data-tab],[data-close],[data-newtab],[data-act],[data-like],[data-deploy],[data-takedown],[data-mail-discard],[data-wl-range],[data-star],[data-download],[data-ov],[data-dev],[data-cancel-booking],[data-empire-join],[data-start],[data-slot-save],[data-slot-load],[data-menu-cat],[data-back],[data-forward],[data-devbug],[data-devopts]');
  // any click outside the home menu closes it (menu items close it themselves below)
  if (store.ui.start && !(e.target as HTMLElement).closest('#startmenu, #dk-home')) store.toggleStart(false);
  if (!t) return;
  const d = t.dataset;
  if (d.close != null) { e.stopPropagation(); store.closeTab(Number(d.close)); return; }
  e.preventDefault();
  if (d.start != null) { store.toggleStart(); return; }
  if (d.menuCat != null) { store.setMenuCat(d.menuCat); return; }
  if (t.closest('#startmenu')) store.toggleStart(false);
  if (d.slotSave != null) { const n = Number(d.slotSave); const save = () => { if (!store.saveSlot(n)) toast('Not saved', 'Could not save (storage unavailable)', 'note'); }; if (listSlots()[n - 1]) store.confirm(`Overwrite slot ${n} with your current game?`, 'Overwrite', save); else save(); return; }
  if (d.slotLoad != null) {
    const n = d.slotLoad === 'auto' ? 'auto' as const : Number(d.slotLoad);
    const name = n === 'auto' ? 'the autosave' : `slot ${n}`;
    store.confirm(`Load ${name}? Your current game is replaced by it.`, 'Load', () => { forgetDrafts(); store.loadSlot(n); });
    return;
  }
  if (d.nav != null) { newPageLoad(); store.navigate(d.nav); }
  else if (d.back != null) store.back();
  else if (d.forward != null) store.forward();
  else if (d.tab != null) store.switchTab(Number(d.tab));
  // data-newtab with a URL opens that page in a new tab (Forkyard deployments); empty opens a blank tab
  else if (d.newtab != null) { newPageLoad(); store.navigate(d.newtab || 'newtab', true); }
  else if (d.like != null) store.like(d.like);
  else if (d.deploy != null) store.deploy(d.deploy);
  else if (d.takedown != null) store.confirm('Take it offline? It counts as broken at payday.', 'Take down', () => store.takeDown(d.takedown!));
  // the cancel link opens the restaurant's cancel page in a new tab
  else if (d.cancelBooking != null) { store.cancelBooking(d.cancelBooking); if (d.cancelUrl) { newPageLoad(); store.navigate(d.cancelUrl, true); } }
  else if (d.empireJoin != null) store.joinEmpire();
  else if (d.mailDiscard != null) { clearMailDraft(); store.setDraft(null); store.navigate('qmail.com'); }
  else if (d.star != null) store.setReviewStars(Number(d.star));
  else if (d.download != null) store.download(d.download);
  else if (d.wlRange != null) store.setWalletRange(d.wlRange);
  else if (d.ov != null) onOverlay(d.ov);
  else if (d.dev != null) store.devAdd(d.dev);
  else if (d.devopts != null) store.toggleDevOptions(d.devopts);
  else if (d.devbug != null) { const [app, feat, key] = d.devbug.split('|'); store.devToggleBug(app, feat, key); }
  else if (d.act === 'book-back') store.bookBack();
  else if (d.act === 'sleep') store.endDay();
  else if (d.act === 'new') store.confirm('Start over? This erases your save.', 'Start over', () => { forgetDrafts(); store.newGame(); });
  else if (d.act === 'dev') store.toggleDev();
  else if (d.act === 'devedit') store.toggleDevEdit();
  else if (d.act === 'devmode') store.setDevMode(!store.devMode);
  else if (d.act === 'intro') store.openIntro();
});

function clearMailDraft(): void { ['mail-to', 'mail-subject', 'mail-body'].forEach(clearField); }

function onOverlay(a: string): void {
  if (a === 'new') { forgetDrafts(); store.newGame(); }
  else if (a === 'start') store.seenIntro();
  else if (a === 'morning') store.dismissMorning();
  else if (a === 'confirm-yes') store.resolveConfirm(true);
  else if (a === 'confirm-no') store.resolveConfirm(false);
}

// ── forms ──
document.addEventListener('submit', (e) => {
  const f = (e.target as HTMLElement).closest<HTMLFormElement>('[data-form]');
  if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  if (kind === 'dev-day') { store.devGoToDay(Number(val('#dev-day'))); return; }
  if (kind === 'dev-flag') { const v = val('#dev-flag-name').trim(); if (v) store.devSetFlag(v, true); return; }
  if (kind === 'url') { newPageLoad(); store.navigate(val('#nt-url') || val('#address')); }
  else if (kind === 'ypost') { const v = val('#post-input').trim(); if (v) { clearField('post-input'); void store.post(v, trendingToday()); } }
  else if (kind === 'prompt') {
    const v = val('#prompt-input').trim(); if (!v || store.busy) return;
    clearField('prompt-input');
    updateCost();
    void store.prompt(v);
  } else if (kind === 'mail') {
    const to = val('#mail-to').trim(), subject = val('#mail-subject').trim(), body = val('#mail-body').trim();
    if (!to || !body) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast('Qmail', 'Enter a valid address.', 'mail'); return; }
    void store.compose(to, subject, body).then((r) => { if (r.sent) { clearMailDraft(); store.setDraft(null); store.navigate('qmail.com/sent'); } });
  } else if (kind === 'reply') {
    const v = val('#reply-body').trim(); if (!v) return;
    clearField('reply-body');
    const id = f.dataset.id, to = f.dataset.to;
    if (id) void store.reply(id, v);
    else if (to) void store.compose(to, f.dataset.subject ?? '', v);
  } else if (kind === 'review') {
    const biz = f.dataset.biz!; const v = val('#review-text').trim(); const stars = store.ui.reviewStars;
    if (!stars) { toast('Yowl', 'Pick a rating first.', 'note'); return; }
    if (v) void store.review(biz, stars, v).then((r) => { if (r.posted !== false) clearField('review-text'); });
  } else if (kind === 'book-next') {
    store.bookNext(val('#bk-name').trim(), val('#bk-email').trim(), Number(val('#bk-date')) || store.state.values.day);
  } else if (kind === 'book') {
    store.book(f.dataset.app!, val('#bk-time').trim() || '19:00', Number(val('#bk-party')) || 2);
  } else if (kind === 'fy-search') {
    const q = val('#fy-search-input').trim().replace(/^@/, '');
    if (q) store.navigate('forkyard.com/u/' + q.toLowerCase());
  } else if (kind === 'term') {
    const v = val('#term-input').trim(); if (!v) return;
    clearField('term-input');
    if (v === 'clear') { store.termClear(); return; }
    void store.term(v);
  }
});

// Cinnamon-style: hovering a menu category opens it
document.addEventListener('mouseover', (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-menu-cat]');
  if (c) store.setMenuCat(c.dataset.menuCat!);
});

// ── inputs & keys ──
document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'y-search') store.setYSearch(el.value);
  else if (el.id === 'yowl-search') store.setYowlSearch(el.value);
  else if (el.id === 'fy-search-input') store.setFySearch(el.value);
  else if (el.id === 'prompt-input') updateCost();
  else if (el.id === 'mail-to') { syncMailTo(); showSuggestions(el); }
});
document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.id === 'llm-misses') MISSES.set({ misses: el.value as Misses });
  else if (el.id === 'llm-haiku-via') MISSES.set({ haikuVia: el.value as HaikuVia });
  else if (el.dataset.devMeter) store.devSetMeter(el.dataset.devMeter as MeterId, Number(el.value));
  else if (el.dataset.devFlag) store.devSetFlag(el.dataset.devFlag, (el as unknown as HTMLInputElement).checked);
});
/** Keep the To draft current without re-rendering, so the field and its suggestions stay put. */
function syncMailTo(): void {
  store.ui.draft = { to: val('#mail-to'), subject: val('#mail-subject'), body: val('#mail-body') };
}
function pickContact(addr: string): void {
  const input = $<HTMLInputElement>('#mail-to');
  if (!input) return;
  input.value = addr;
  hideSuggestions();
  syncMailTo();
  $<HTMLInputElement>('#mail-subject')?.focus();
}
// a conversation keeps the messages the player opened or closed when the page repaints (a click on the
// summary, not 'toggle', which also fires when a message renders already open)
document.addEventListener('click', (e) => {
  const d = (e.target as HTMLElement).closest('summary')?.parentElement;
  if (d instanceof HTMLDetailsElement && d.classList.contains('qm-msg') && d.dataset.msg) V.mailOpen.set(d.dataset.msg, !d.open);
});
document.addEventListener('focusin', (e) => { if ((e.target as HTMLElement).id === 'mail-to') showSuggestions(e.target as HTMLInputElement); });
document.addEventListener('focusout', (e) => { if ((e.target as HTMLElement).id === 'mail-to') hideSuggestions(); });
// mousedown, not click: a click would blur the field first and close the list before it registers
document.addEventListener('mousedown', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('#qm-sugg li');
  if (li) { e.preventDefault(); pickContact(li.dataset.addr!); }
});

document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (el.id === 'mail-to' && suggestionKey(e, pickContact)) { e.preventDefault(); return; }
  if ((el.id === 'prompt-input' || el.id === 'reply-body') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (el as HTMLTextAreaElement).form?.requestSubmit(); }
  if ((el.id === 'post-input' || el.id === 'mail-body' || el.id === 'review-text') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (el as HTMLTextAreaElement).form?.requestSubmit(); }
  if (e.key === '`' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); store.toggleDev(); }
  if (e.key === 'Escape' && store.ui.start) store.toggleStart(false);
  // Alt+Left / Alt+Right, like a real browser
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); if (e.key === 'ArrowLeft') store.back(); else store.forward(); }
});

void lastSite;
render();
