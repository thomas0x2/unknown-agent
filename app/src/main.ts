/*
 * Controller. Boots the store, paints the legacy shell slots from the view on every change, and
 * wires input (event delegation, same architecture as the legacy game). No framework: the shell in
 * index.html is static and we fill #tabs / #bookmarks / #viewport / the taskbar / #overlay / #dev.
 */
import '../../src/style.css';
import './ui/satchel.css';
import './ui/yowl.css';
import './ui/forkyard.css';
import { GameStore } from './game/store';
import { loadContent } from './content/load';
import { offlineJev, localStorageStore } from './engine';
import { BackendJev } from './game/backendJev';
import { LLM } from './game/llm';
import { makeGemmaWriter } from './game/gemma';
import * as V from './ui/view';
import { route } from './sites/registry';

const content = loadContent();
const router = new BackendJev(offlineJev);
const writer = makeGemmaWriter(content);
const store = new GameStore(content, router, writer, localStorageStore());

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const val = (sel: string) => ($(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
const trendingToday = () => store.content.trending[store.state.values.day] ?? [];

let lastSite = '';
function render(): void {
  const s = store.state;
  const r = route(store.url, s);

  $('#tabs')!.innerHTML = V.tabsHtml(store);
  const addr = $<HTMLInputElement>('#address')!;
  if (document.activeElement !== addr) addr.value = V.addressValue(store);
  $('#bookmarks')!.innerHTML = V.bookmarksHtml(store);

  const vp = $('#viewport')!;
  const keep: Record<string, string> = {};
  let focusId: string | null = null;
  vp.querySelectorAll<HTMLInputElement>('textarea[id], input[id]').forEach((el) => { keep[el.id] = el.value; });
  if (document.activeElement && vp.contains(document.activeElement)) focusId = (document.activeElement as HTMLElement).id || null;

  vp.innerHTML = V.page(store, r);
  const site = V.viewportSite(store);
  if (vp.dataset.site !== site) vp.scrollTop = 0;
  vp.dataset.site = site;
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id) as HTMLInputElement | null; if (el && !el.disabled) el.value = v; }
  if (focusId) { const el = document.getElementById(focusId) as HTMLInputElement | null; if (el && !el.disabled) el.focus(); }

  // taskbar
  $('#objective')!.textContent = V.objective(s);
  const wallet = $('#wallet')!; wallet.textContent = (s.values.crypto < 0 ? '−$' : '$') + Math.abs(s.values.crypto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  wallet.classList.toggle('neg', s.values.crypto < 20);
  const rent = $('#rent')!; rent.textContent = V.rentLine(s); rent.classList.toggle('neg', V.rentLow(s));
  $('#clock')!.innerHTML = V.clockHtml(s);

  const ov = $('#overlay')!; const oh = V.overlayHtml(store); ov.innerHTML = oh; ov.hidden = !oh;
  const dev = $('#dev')!; dev.hidden = !store.ui.dev; if (store.ui.dev) dev.innerHTML = V.devHtml(store);

  if (site === 'agent') { const log = $('#ua-log'); if (log) log.scrollTop = log.scrollHeight; updateCost(); }
  if (site === 'terminal') { const log = $('#tm-log'); if (log) log.scrollTop = log.scrollHeight; const t = $('#term-input'); if (t && window.innerWidth > 700 && !store.busy) t.focus(); }
  lastSite = site;
}
store.subscribe(render);
LLM.onChange(render);

function updateCost(): void {
  const est = $('#cost-est'); const input = $<HTMLTextAreaElement>('#prompt-input');
  if (!est || !input) return;
  const words = input.value.split(/\s+/).filter(Boolean).length;
  est.textContent = words ? `~${words} word${words > 1 ? 's' : ''}` : '';
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
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-nav],[data-tab],[data-close],[data-newtab],[data-act],[data-like],[data-deploy],[data-takedown],[data-mail-discard],[data-wl-range],[data-star],[data-download],[data-llm],[data-ov],[data-dev],[data-cancel-booking]');
  if (!t) return;
  const d = t.dataset;
  if (d.close != null) { e.stopPropagation(); store.closeTab(Number(d.close)); return; }
  e.preventDefault();
  if (d.nav != null) store.navigate(d.nav);
  else if (d.tab != null) store.switchTab(Number(d.tab));
  else if (d.newtab != null) store.navigate('newtab', true);
  else if (d.like != null) store.like(d.like);
  else if (d.deploy != null) store.deploy(d.deploy);
  else if (d.takedown != null) store.confirm('Take it offline? It counts as broken at payday.', 'Take down', () => store.takeDown(d.takedown!));
  else if (d.cancelBooking != null) { store.cancelBooking(d.cancelBooking); toast('Qmail', 'Booking cancelled', 'mail'); }
  else if (d.mailDiscard != null) { store.setDraft(null); store.navigate('qmail.com'); }
  else if (d.star != null) store.setReviewStars(Number(d.star));
  else if (d.download != null) { store.download(d.download); toast('Downloads', `${d.download} saved to your laptop`, 'note'); }
  else if (d.wlRange != null) store.setWalletRange(d.wlRange);
  else if (d.llm != null) onLlm(d.llm);
  else if (d.ov != null) onOverlay(d.ov);
  else if (d.dev != null) store.devAdd(d.dev);
  else if (d.act === 'sleep') store.endDay();
  else if (d.act === 'new') store.confirm('Start over? This erases your save.', 'Start over', () => store.newGame());
  else if (d.act === 'dev') store.toggleDev();
});

function onLlm(action: string): void {
  if (action === 'load' || action === 'retry') LLM.load();
  else if (action === 'cancel') LLM.unload();
}
function onOverlay(a: string): void {
  if (a === 'new') store.newGame();
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
  if (kind === 'url') store.navigate(val('#nt-url') || val('#address'));
  else if (kind === 'ypost') { const v = val('#post-input').trim(); if (v) void store.post(v, trendingToday()).then((r) => toast('Y', `${r.followerDelta >= 0 ? '+' : '−'}${Math.abs(r.followerDelta)} followers`, 'y')); }
  else if (kind === 'prompt') {
    const v = val('#prompt-input').trim(); if (!v) return;
    const input = $<HTMLTextAreaElement>('#prompt-input'); if (input) input.value = '';
    void store.prompt(v);
  } else if (kind === 'mail') {
    const to = val('#mail-to').trim(), subject = val('#mail-subject').trim(), body = val('#mail-body').trim();
    if (!to || !body) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast('Qmail', 'Enter a valid address.', 'mail'); return; }
    void store.compose(to, subject, body).then((r) => { if (!r.sent) toast('Qmail', 'You already wrote to them today.', 'mail'); else { store.setDraft(null); store.navigate('qmail.com'); toast('Qmail', `Sent to ${to}`, 'mail'); } });
  } else if (kind === 'reply') {
    const id = f.dataset.id!; const v = val('#reply-body').trim();
    if (v) void store.reply(id, v);
  } else if (kind === 'review') {
    const biz = f.dataset.biz!; const v = val('#review-text').trim(); const stars = store.ui.reviewStars;
    if (!stars) { toast('Yowl', 'Pick a rating first.', 'note'); return; }
    if (v) void store.review(biz, stars, v).then(() => toast('Yowl', 'Review posted', 'note'));
  } else if (kind === 'book') {
    const app = f.dataset.app!; const email = val('#bk-email').trim(); const time = val('#bk-time').trim() || '19:00'; const party = Number(val('#bk-party')) || 2;
    store.book(app, 'You', email, store.state.values.day, time, party);
    toast('Booking', 'Table requested — check Qmail for a confirmation', 'mail');
  } else if (kind === 'fy-search') {
    const q = val('#fy-search-input').trim().replace(/^@/, '');
    if (q) store.navigate('forkyard.com/u/' + q.toLowerCase());
  } else if (kind === 'term') {
    const v = val('#term-input').trim(); if (!v) return;
    const input = $<HTMLInputElement>('#term-input'); if (input) input.value = '';
    if (v === 'clear') { store.termClear(); return; }
    void store.term(v);
  }
});

// ── inputs & keys ──
document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'y-search') store.setYSearch(el.value);
  else if (el.id === 'yowl-search') store.setYowlSearch(el.value);
  else if (el.id === 'fy-search-input') store.setFySearch(el.value);
  else if (el.id === 'prompt-input') updateCost();
  else if (el.id === 'mail-to') store.setDraft({ to: el.value, subject: val('#mail-subject'), body: val('#mail-body') });
});
document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.id === 'llm-backend') LLM.setBackend(el.value as 'browser' | 'ollama' | 'off');
});
document.addEventListener('keydown', (e) => {
  const el = e.target as HTMLElement;
  if (el.id === 'prompt-input' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (el as HTMLTextAreaElement).form?.requestSubmit(); }
  if ((el.id === 'post-input' || el.id === 'mail-body' || el.id === 'reply-body' || el.id === 'review-text') && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); (el as HTMLTextAreaElement).form?.requestSubmit(); }
  if (e.key === '`' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); store.toggleDev(); }
});

void lastSite;
render();
