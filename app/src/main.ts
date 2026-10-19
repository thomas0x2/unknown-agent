/*
 * Controller. Boots the store, paints the legacy shell slots from the view on every change, and
 * wires input (event delegation, same architecture as the legacy game). No framework: the shell in
 * index.html is static and we fill #tabs / #bookmarks / #viewport / the taskbar / #overlay / #dev.
 */
import { mountInvaders } from './ui/invaders';
import './style.css';
import './ui/coinbin.css';
import './ui/sherwood.css';
import './ui/doordish.css';
import './ui/yowl.css';
import './ui/forkyard.css';
import './ui/qmail.css';
import './ui/desktop.css';
import './ui/qdrive.css';
import { driveFiles } from './ui/qdrive';
import './ui/ads.css';
import './ui/empire.css';
import './ui/adSites.css';
import './ui/citypulse.css';
import './ui/pollymarket.css';
import './ui/stack.css';
import './ui/thirstr.css';
import './ui/appsite.css';
import './ui/terminal.css';
import './ui/devOptions.css';
import './ui/sendFx.css';
import './ui/brands.css';
import './ui/matchless.css';
import './ui/whyc.css';
import { showSuggestions, hideSuggestions, suggestionKey } from './ui/mailSuggest';
import { GameStore } from './game/store';
import { loadContent } from './content/load';
import { localStorageStore, PLAYER_WALLET, SEED_PHRASE, CASINO_WALLET, trendingAt } from './engine';
import { JEV } from './game/backendJev';
import { API_KEYS, DIRECT } from './game/apiKeys';
import { ROUTER } from './game/router';
import { MISSES, makeWriter, type Misses, type HaikuVia, type Net } from './game/misses';
import * as V from './ui/view';
import { route } from './sites/registry';
import { listSlots } from './game/saves';
import { devEditHtml } from './ui/devEdit';
import { jevTestsHtml, runJevTests, jevTestsPick, jevTestsFailsOnly } from './ui/devJevTests';
import type { MeterId } from './engine';
import { newPageLoad } from './ui/ads';
import { pullPct } from './game/pull';
import { trackLoads, LOADING_HTML } from './ui/pageLoad';
import { markSend, applySendFx, flyOff, sendLanded } from './ui/sendFx';
import { swipeOff } from './ui/matchless';
import { SOUND } from './ui/sound';
import { soundSnap, soundCues, botBurst } from './ui/soundCues';
import { queryView } from './ui/queryView';
import { wikiClick, wikiInput } from './ui/wiki';
import { onWikiFiles } from './content/wikiFiles';

const content = loadContent();
// a query reads the player's screens as they are when it's sent
const writer = makeWriter(content, () => queryView(store), (on) => store.setSearching(on));
const store = new GameStore(content, ROUTER, writer, localStorageStore());
// a wiki file changed on disk (a save here or on the standalone wiki page): use it at once
onWikiFiles((pages) => { content.wiki = pages; store.repaint(); });

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const val = (sel: string) => ($(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
const trendingToday = () => trendingAt(store.content, store.state.values.day, store.state.clockMin);

let lastSite = '';
let lastUrl = '';
let shownPage = '';
let shownMenu = '';
let shownOverlay = '';

// Unsent text in every page's fields, keyed by the page's URL. Cleared when a form is sent.
const drafts = new Map<string, Record<string, string>>();
let shownUrl: string | null = null;
const SKIP_TYPES = new Set(['checkbox', 'radio', 'hidden', 'submit', 'button', 'file', 'range']);
function readFields(root: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  root.querySelectorAll<HTMLInputElement>('textarea[id], input[id]').forEach((el) => { if (!SKIP_TYPES.has(el.type)) out[el.id] = el.value; });
  return out;
}
function forgetDrafts(): void { drafts.clear(); shownUrl = null; scrolls.clear(); shownKey = null; }

// Where the player scrolled, per tab and page: the viewport and any inner scroll area (Qmail list, chat log).
// Kept while switching tabs; a newly opened tab starts at the top and a closed tab's positions are dropped.
type Scrolls = Record<string, [number, number, boolean]>;
const scrolls = new Map<string, Scrolls>();
let shownKey: string | null = null;
/** A name for a scrollable element that finds the same element after the page is drawn again. */
function scrollName(el: HTMLElement, root: HTMLElement): string {
  if (el === root) return ':root';
  if (el.id) return `#${el.id}`;
  const sig = `${el.tagName}.${el.className}`;
  let n = 0;
  for (const o of root.querySelectorAll<HTMLElement>(el.tagName)) { if (o === el) break; if (o.className === el.className) n++; }
  return `${sig}:${n}`;
}
function findScrolled(root: HTMLElement, name: string): HTMLElement | null {
  if (name === ':root') return root;
  if (name.startsWith('#')) return root.querySelector<HTMLElement>(`[id="${name.slice(1)}"]`);
  const i = name.lastIndexOf(':'); const [tag, ...cls] = name.slice(0, i).split('.'); const n = Number(name.slice(i + 1));
  const cn = cls.join('.');
  return [...root.querySelectorAll<HTMLElement>(tag)].filter((o) => o.className === cn)[n] ?? null;
}
function readScrolls(root: HTMLElement): Scrolls {
  const out: Scrolls = {};
  for (const el of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    // a list read to the end stays at the end, so lines added meanwhile still show up
    if (el.scrollTop || el.scrollLeft) out[scrollName(el, root)] = [el.scrollTop, el.scrollLeft, el.scrollTop + el.clientHeight >= el.scrollHeight - 2];
  }
  return out;
}
function applyScrolls(root: HTMLElement, saved: Scrolls): void {
  for (const [name, [top, left, atEnd]] of Object.entries(saved)) {
    const el = findScrolled(root, name); if (el) { el.scrollTop = atEnd ? el.scrollHeight : top; el.scrollLeft = left; }
  }
}
/** Scrolls whatever holds `el` so it sits `top` px down the screen again after a redraw moved it. */
function keepAt(el: HTMLElement | null, top: number): void {
  if (!el) return;
  let box = el.parentElement;
  while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
  if (box) box.scrollTop += el.getBoundingClientRect().top - top;
}
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
  // looking at the Y timeline reads everything on it
  if (r.site === 'y' && !r.param) store.ui.yUnread = 0;

  $('#tabs')!.innerHTML = V.tabsHtml(store);
  // a tab that just went to another website shows a spinner and a blank page for a moment
  const loading = trackLoads(store.tabs, render);
  for (const id of loading) $(`#tabs .tab[data-tab="${id}"]`)?.classList.add('loading');
  const busy = loading.has(store.active);
  const addr = $<HTMLInputElement>('#address')!;
  if (document.activeElement !== addr) addr.value = V.addressValue(store);
  $<HTMLButtonElement>('#nav-back')!.disabled = !store.canBack;
  $<HTMLButtonElement>('#nav-fwd')!.disabled = !store.canForward;
  $('#bookmarks')!.innerHTML = V.bookmarksHtml(store);

  const vp = $('#viewport')!;
  // unsent text is saved per page, so leaving a site (another tab, a bookmark) and coming back finds it again
  if (shownUrl != null) drafts.set(shownUrl, readFields(vp));
  const keep = drafts.get(store.url) ?? {};
  const key = `${store.active}:${store.url}`;
  const before = readScrolls(vp);
  if (shownKey != null) scrolls.set(shownKey, before);
  for (const k of scrolls.keys()) if (!store.tabs.some((t) => k.startsWith(`${t.id}:`))) scrolls.delete(k);
  // a page the player returns to (another tab, back) gets its scroll back; a redraw of the same page keeps its own
  const returning = key !== shownKey && scrolls.has(key);
  let focusId: string | null = null;
  let caret: [number | null, number | null] | null = null;
  if (document.activeElement && vp.contains(document.activeElement)) {
    const f = document.activeElement as HTMLInputElement;
    focusId = f.id || null;
    // re-rendering replaces the field, so remember where the caret was or typing lands at the start
    try { caret = [f.selectionStart, f.selectionEnd]; } catch { caret = null; }
  }

  vp.innerHTML = busy ? LOADING_HTML : V.page(store, r);
  shownUrl = busy ? null : store.url;
  const site = busy ? 'loading' : V.viewportSite(store);
  if (busy) vp.scrollTop = 0;
  else if (returning) applyScrolls(vp, scrolls.get(key)!);
  else if (key === shownKey) applyScrolls(vp, before);
  else if (vp.dataset.site !== site || store.active !== Number(shownKey?.split(':')[0])) vp.scrollTop = 0;
  // the loading page has no scroll worth keeping
  shownKey = busy ? null : key;
  vp.dataset.site = site;
  SOUND.setSite(site);
  // a field disabled only because a send is going out keeps showing what is being sent
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id) as HTMLInputElement | null; if (el && (!el.disabled || store.busy)) el.value = v; }
  if (focusId) {
    const el = document.getElementById(focusId) as HTMLInputElement | null;
    if (el && !el.disabled) {
      el.focus();
      if (caret && caret[0] != null && caret[1] != null) try { el.setSelectionRange(caret[0], caret[1]); } catch { /* field type without a caret */ }
    }
  }
  // a freshly opened new tab takes typing straight away, like a real browser
  const page = `${store.active}:${store.url}`;
  if (page !== shownPage && site === 'newtab') $<HTMLInputElement>('#nt-url')?.focus();
  shownPage = page;

  // taskbar and the Terminal window
  $('#dk-tasks')!.innerHTML = V.tasksHtml(store);
  renderTerm();
  $('#clock')!.innerHTML = V.clockHtml(s);
  const menu = $('#startmenu')!; menu.hidden = !store.ui.start;
  // only redraw the menu when it changed, so an open dropdown in it survives the clock ticking
  const menuHtml = store.ui.start ? V.startMenuHtml(store) : '';
  if (menuHtml !== shownMenu && (document.activeElement?.id !== 'snd-vol' || !store.ui.start)) { menu.innerHTML = menuHtml; shownMenu = menuHtml; }
  const startBtn = $('#dk-home')!; startBtn.classList.toggle('on', store.ui.start); startBtn.setAttribute('aria-expanded', String(store.ui.start));

  // only redraw a dialog when it changed, so what is typed into one (the API keys) survives a repaint
  const ov = $('#overlay')!; const oh = V.overlayHtml(store); if (oh !== shownOverlay) { ov.innerHTML = oh; shownOverlay = oh; } ov.hidden = !oh;
  const dev = $('#dev')!; dev.hidden = !store.ui.dev; if (store.ui.dev) dev.innerHTML = V.devHtml(store);
  const dve = $('#devedit')!; const showEdit = store.ui.dev && store.ui.devEdit; dve.hidden = !showEdit; if (showEdit) dve.innerHTML = store.ui.devTab === 'jev' ? jevTestsHtml(store) : devEditHtml(store);

  if (site === 'agent') { const log = $('#ua-log'); const read = returning ? scrolls.get(key)!['#ua-log'] : undefined; if (log && !(read && !read[2])) log.scrollTop = log.scrollHeight; updateCost(); }
  if (site === 'coinbin') updateQuote();
  if (site === 'lonely' || site === 'sorry') { const log = $(site === 'lonely' ? '#lo-log' : '#sw-log'); if (log) log.scrollTop = log.scrollHeight; updateCost(); }
  applySendFx(vp, store.busy);
  lastSite = site;
}
/** Paints the Terminal window, keeping what was typed at its prompt. */
let termWasShown = false;
function renderTerm(): void {
  const win = $('#termwin')!;
  const shown = store.ui.termShown;
  win.hidden = !shown;
  if (!shown) { termWasShown = false; return; }
  // each tab has its own prompt: what was typed stays with it
  const old = $<HTMLInputElement>('#termwin .tm-in input');
  const typed = old?.value ?? '';
  // a prompt that was waiting on the agent gets the focus back when it's free again
  const hadFocus = !!old && (document.activeElement === old || old.disabled);
  // a running invaders.exe keeps its canvas: repainting the log would end the game
  const playing = store.ui.invaders && store.ui.termSession !== 'agent' && !!$('#inv-canvas');
  if (!win.firstElementChild) win.innerHTML = V.termWindowHtml(store);
  else {
    if (!playing) $('#tm-log')!.innerHTML = V.termBodyHtml(store);
    $('#tw-title')!.textContent = V.termTitle(store);
  }
  const log = $('#tm-log')!; log.scrollTop = log.scrollHeight;
  const canvas = $<HTMLCanvasElement>('#inv-canvas');
  if (canvas) mountInvaders(canvas, (lines) => store.endInvaders(lines));
  const input = $<HTMLInputElement>('#termwin .tm-in input');
  if (input) {
    if (old?.id === input.id) input.value = typed;
    // focus the prompt when the window comes forward or was being typed in (not on phones: the keyboard covers it)
    if (!input.disabled && (hadFocus || (!termWasShown && window.innerWidth > 700))) input.focus();
  }
  termWasShown = !!input;
}
/** One frame of a model download: just the Terminal and any Weightroom progress bar. */
function renderPull(): void {
  renderTerm();
  const pct = pullPct(store.pullMs());
  document.querySelectorAll<HTMLElement>('[data-pull-bar]').forEach((el) => {
    el.querySelector('i')!.style.width = `${pct}%`; el.querySelector('b')!.textContent = `Downloading ${pct}%`;
  });
}
// ── sound: cues come from what changed in the game since the last look ──
let snap = soundSnap(store.state);
let resyncSound = false;
function listen(): void {
  const next = soundSnap(store.state);
  const cues = resyncSound ? [] : soundCues(snap, next);
  if (resyncSound) bounces = bounceCount();
  resyncSound = false;
  snap = next;
  // after the day-end pad, the night's money sounds wait until it has faded a little
  const lead = cues[0] === 'dayEnd' ? 1.1 : 0;
  cues.forEach((c, i) => SOUND.play(c, i === 0 ? 0 : lead + i * 0.3));
}
/** A loaded save or a new game replaces the state wholesale: take a fresh look without playing anything. */
function quietReset(): void { resyncSound = true; }
// new mail and Y posts come from the store's arrival events, wherever they land from (clock, reply, morning)
// spam-filter bounces are counted apart: one coming back plays its own sound instead of the mail alert
const bounceCount = () => store.state.mail.filter((m) => m.bounceOf).length;
let bounces = bounceCount();
store.onArrival(({ mail, posts, bots }) => {
  store.ui.yBurst = {};
  const b = bounceCount(); const bounced = b > bounces; bounces = b;
  if (resyncSound) return;
  // arriving with a new day: wait for the day-end sound and the night's money
  const after = store.state.values.day !== snap.day ? 2.2 : 0.1;
  const at = after + (mail ? 0.45 : 0);
  if (bounced) SOUND.play('bounce', after + 0.25);
  if (mail > (bounced ? 1 : 0)) SOUND.play('mail', after);
  if (posts > bots.length) SOUND.play('post', at);
  // bot accounts post in a quick barrage: each one shows up on Y with its own chirp
  const burst = botBurst(bots.length);
  const start = performance.now() + at * 1000;
  // the feed lists them newest on top, so the barrage builds upward
  [...bots].sort((a, b) => a.localeCompare(b)).forEach((id, i) => { store.ui.yBurst[id] = start + burst[i] * 1000; });
  SOUND.burst('post', burst, at);
});
store.subscribe(render);
store.subscribe(listen);
store.onPull(renderPull);
store.onClock(() => {
  $('#clock')!.innerHTML = V.clockHtml(store.state);
  const work = $('#ua-work'); if (work) work.outerHTML = V.workHtml(store.state);
  // Dex's countdown moves while the player watches (a frozen one doesn't: it was drawn at the deploy)
  const cd = $('#as-c-clock');
  if (cd) {
    const fresh = document.createElement('div');
    fresh.innerHTML = V.page(store, route(store.url, store.state));
    const now = fresh.querySelector('#as-c-clock');
    if (now && now.outerHTML !== cd.outerHTML) cd.outerHTML = now.outerHTML;
  }
  listen();
});
SOUND.onChange(render);
store.startClock();
MISSES.onChange(render);
JEV.onChange(render);
void JEV.probe();
// the GitHub Pages build asks for the player's own keys at first launch, unless they chose offline
API_KEYS.onChange(() => { void JEV.probe(); render(); });
if (DIRECT && !API_KEYS.any && !MISSES.offline) store.showKeys(true);

/** Coinbin Exchange's "you get" line, kept current while the amount is typed. */
function updateQuote(): void {
  const line = $('#cb-ex-quote'); if (!line) return;
  const q = V.exchangeQuoteLine(store, val('#cb-ex-amount'));
  line.textContent = q.text;
  line.classList.toggle('cb-err', q.over);
}

function updateCost(): void {
  for (const [chat, estId, inputId] of [['lonely', '#lo-cost', '#lonely-input'], ['sorry', '#sw-cost', '#sorry-input']] as const) {
    const est = $(estId); const input = $<HTMLTextAreaElement>(inputId);
    if (!est || !input) continue;
    const c = V.chatCostLine(store.state, chat, input.value);
    est.textContent = c.text;
    est.classList.toggle('neg', c.over);
  }
  const est = $('#cost-est'); const input = $<HTMLTextAreaElement>('#prompt-input');
  if (!est || !input) return;
  const c = V.costLine(store.state, input.value);
  est.textContent = c.text;
  est.classList.toggle('neg', c.over);
}

// ── clicks ──
type Click = (v: string, t: HTMLElement) => void;
/**
 * What a click on an element with data-<name> does, in priority order (an element carrying two of
 * these runs the first). The click listener's selector is built from these keys, so a new button
 * only needs a line here. MENU_CLICKS run before a click inside the home menu closes it.
 */
const MENU_CLICKS: Record<string, Click> = {
  start: () => store.toggleStart(),
  task: (v) => { if (v === 'terminal') store.termTask(); else store.showTerm(false); },
  term: (v) => { if (v === 'close') store.closeTerm(); else store.showTerm(false); },
  menuCat: (v) => store.setMenuCat(v),
};
const CLICKS: Record<string, Click> = {
  slotSave: (v) => { const n = Number(v); const save = () => { store.saveSlot(n); }; if (listSlots()[n - 1]) store.confirm(`Overwrite slot ${n} with your current game?`, 'Overwrite', save); else save(); },
  slotLoad: (v) => {
    const n = v === 'auto' ? 'auto' as const : Number(v);
    const name = n === 'auto' ? 'the autosave' : `slot ${n}`;
    store.confirm(`Load ${name}? Your current game is replaced by it.`, 'Load', () => { forgetDrafts(); quietReset(); store.loadSlot(n); });
  },
  nav: (v) => { if (v === 'run-exe') { store.runExe(); return; } newPageLoad(); store.navigate(v); },
  back: () => store.back(),
  forward: () => store.forward(),
  tab: (v) => store.switchTab(Number(v)),
  // data-newtab with a URL opens that page in a new tab (Forkyard deployments); empty opens a blank tab
  newtab: (v) => { newPageLoad(); store.navigate(v || 'newtab', true); },
  like: (v) => store.like(v),
  repost: (v) => store.repost(v),
  // the Show all / Hide old posts button trades places with its twin; keep that spot where it was on screen
  yAll: (v, t) => { const top = t.closest('.y-more')!.getBoundingClientRect().top; store.showAllY(v !== 'hide'); keepAt($('#viewport .y-more'), top); },
  deploy: (v) => { SOUND.play('deploy'); store.deploy(v); },
  takedown: (v) => store.confirm('Take it offline? It counts as broken at payday.', 'Take down', () => store.takeDown(v)),
  empireJoin: () => store.joinEmpire(),
  mailBin: (v, t) => store.binMail(JSON.parse(v), t.dataset.mailHome || 'qmail.com'),
  mailRestore: (v, t) => store.restoreMail(JSON.parse(v), t.dataset.mailHome || 'qmail.com/bin'),
  mailUndo: () => store.undoMailNotice(),
  mailDiscard: () => { clearMailDraft(); store.setDraft(null); store.navigate('qmail.com'); },
  star: (v) => store.setReviewStars(Number(v)),
  download: (v) => store.download(v),
  wlRange: (v) => store.setWalletRange(v),
  ov: (v, t) => onOverlay(v, t),
  dev: (v) => { if (v === 'rewind') quietReset(); store.devAdd(v); },
  devopts: (v) => store.toggleDevOptions(v),
  devbug: (v) => { const [app, feat, key] = v.split('|'); store.devToggleBug(app, feat, key); },
  act: (v, t) => ACTS[v]?.(t),
};
/** Buttons with data-act="<name>". */
const ACTS: Record<string, (t: HTMLElement) => void> = {
  send: () => store.toggleSend(),
  'send-cancel': () => store.toggleSend(false),
  exchange: () => store.toggleExchange(),
  'ex-cancel': () => store.toggleExchange(false),
  token: () => store.toggleToken(),
  'tok-cancel': () => store.toggleToken(false),
  'ex-flip': () => store.setExchange('from', store.ui.ex.to, val('#cb-ex-amount')),
  'ex-max': () => { const el = $<HTMLInputElement>('#cb-ex-amount'); if (el) { el.value = V.exchangeMax(store); updateQuote(); } },
  receive: () => copyWalletAddress(),
  'seed-show': () => store.toggleSeed(),
  'seed-copy': () => copySeedPhrase(),
  'rent-appeal': () => store.rentAppeal(),
  'up-open': (t) => openFilePicker(t.dataset.site ?? ''),
  'fp-folder': (t) => store.filePickFolder(t.dataset.folder ?? ''),
  'fp-file': (t) => store.filePickFile(t.dataset.file ?? ''),
  'fp-cancel': () => store.closeFilePicker(),
  'fp-ok': () => confirmFilePick(),
  'whyc-apply': () => store.applyWhyC(),
  'crane-donate': () => store.craneDonate(),
  'thirstr-sub': (t) => store.thirstrSubscribe(t.dataset.handle ?? ''),
  'stack-bet': (t) => store.stackPickBet(Number(t.dataset.bet)),
  'stack-spin': () => store.stackSpin(),
  'stack-copy': () => copyDepositAddress(),
  'pcmedic-download': () => store.downloadCleaner(),
  'qd-delete': (t) => store.confirm(`Delete ${t.dataset.name}? It can't be recovered.`, 'Delete', () => store.deleteDriveFile(t.dataset.file!)),
  'sw-sell': (t) => { if (store.trade(t.dataset.ticker!, 'sell', val('#sw-amount').trim())) clearField('sw-amount'); },
  'sw-sell-all': (t) => { if (store.trade(t.dataset.ticker!, 'sell', 'all')) clearField('sw-amount'); },
  sleep: () => store.endDay(),
  new: () => store.confirm('Start over? This erases your save.', 'Start over', () => { forgetDrafts(); quietReset(); store.newGame(); }),
  dev: () => store.toggleDev(),
  devedit: () => store.toggleDevEdit(),
  devtab: (t) => store.devTab(t.dataset.devtab === 'jev' ? 'jev' : 'edit'),
  jevtests: (t) => runJevTests(store, t.dataset.case != null ? Number(t.dataset.case) : undefined),
  jevcell: (t) => jevTestsPick(store, Number(t.dataset.step), Number(t.dataset.part)),
  jevfails: () => jevTestsFailsOnly(store),
  devmode: () => store.setDevMode(!store.devMode),
  sound: () => SOUND.setMuted(!SOUND.settings.muted),
  keys: () => store.showKeys(true),
};
const dataAttr = (key: string) => `[data-${key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`;
const CLICKABLE = ['close', ...Object.keys(MENU_CLICKS), ...Object.keys(CLICKS)].map(dataAttr).join(',');

document.addEventListener('click', (e) => {
  if (e.target instanceof HTMLElement && wikiClick(e.target, store, e)) return;
  const t = (e.target as HTMLElement).closest<HTMLElement>(CLICKABLE);
  // any click outside the home menu closes it (menu items close it themselves below)
  if (store.ui.start && !(e.target as HTMLElement).closest('#startmenu, #dk-home')) store.toggleStart(false);
  // clicking the browser while the Terminal is in front brings the browser forward, like any window
  if (store.ui.termShown && (e.target as HTMLElement).closest('.window')) store.showTerm(false);
  if (!t) return;
  const d = t.dataset;
  if (d.close != null) { e.stopPropagation(); store.closeTab(Number(d.close)); return; }
  e.preventDefault();
  for (const [k, fn] of Object.entries(MENU_CLICKS)) if (d[k] != null) { fn(d[k]!, t); return; }
  if (t.closest('#startmenu')) store.toggleStart(false);
  for (const [k, fn] of Object.entries(CLICKS)) if (d[k] != null) { fn(d[k]!, t); return; }
});

/** Coinbin Receive: the player's address goes on the clipboard, for pasting wherever someone wants paying. */
function copyWalletAddress(): void {
  const fallback = () => store.setCbNotice(`Your address: ${PLAYER_WALLET}`);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(PLAYER_WALLET).then(() => store.setCbNotice('Address copied'), fallback);
  else fallback();
}

/** stack.com's deposit address onto the clipboard, for Coinbin's Send form. */
function copyDepositAddress(): void {
  const fallback = () => store.setStackNotice(`Deposit address: ${CASINO_WALLET}`);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(CASINO_WALLET).then(() => store.setStackNotice('Deposit address copied'), fallback);
  else fallback();
}

/** Coinbin's recovery phrase onto the clipboard, for pasting wherever someone asks for it. */
function copySeedPhrase(): void {
  const done = () => store.setCbNotice('Recovery phrase copied');
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(SEED_PHRASE).then(done, () => store.setCbNotice('Recovery phrase: select the words above to copy them'));
  else store.setCbNotice('Recovery phrase: select the words above to copy them');
}

/** The upload file dialog opens on the folder and file last uploaded. */
function openFilePicker(site: string): void {
  const last = driveFiles(store.state).find((f) => f.id === store.ui.uploadPick);
  store.openFilePicker(site, last?.folder ?? 'documents', last?.id ?? '');
}
function confirmFilePick(): void {
  const f = driveFiles(store.state).find((x) => x.id === store.ui.filePick?.file);
  if (f) store.confirmFilePick({ id: f.id, name: f.name });
}
// double-clicking a file in the dialog uploads it, like a real one
document.addEventListener('dblclick', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('.fp-file:not(:disabled)');
  if (t?.dataset.file) { store.filePickFile(t.dataset.file); confirmFilePick(); }
});

function clearMailDraft(): void { ['mail-to', 'mail-subject', 'mail-body'].forEach(clearField); }

function onOverlay(a: string, t?: HTMLElement): void {
  if (a === 'new') { forgetDrafts(); quietReset(); store.newGame(); }
  else if (a === 'adpop-close') store.closeAdPopup();
  else if (a === 'adpop-go') { const url = t?.dataset.url; store.closeAdPopup(); if (url) { newPageLoad(); store.navigate(url, true); } }
  else if (a === 'morning') store.dismissMorning();
  else if (a === 'greet') { store.dismissGreet(); SOUND.play('dayStart', 0.1); }
  else if (a === 'mem-ok') store.dismissMemWarn();
  else if (a === 'fp-cancel') store.closeFilePicker();
  else if (a === 'confirm-yes') store.resolveConfirm(true);
  else if (a === 'confirm-no') store.resolveConfirm(false);
  else if (a === 'keys-close') store.showKeys(false);
  else if (a === 'keys-offline') { MISSES.set({ net: 'offline' }); store.showKeys(false); }
  else if (a === 'jev-keys') store.showKeys(true);
  else if (a === 'jev-ok') {
    // put the text back where it was typed, so the player can send it again once Jev is back
    const j = store.ui.jevOffline;
    store.dismissJevOffline();
    const el = j?.field ? document.getElementById(j.field) as HTMLInputElement | HTMLTextAreaElement | null : null;
    if (el && j?.text && !el.value) { el.value = j.text; el.focus(); }
  }
}

// ── forms ──
/** What submitting a form with data-form="<kind>" does. */
const FORMS: Record<string, (f: HTMLFormElement) => void> = {
  keys: () => {
    API_KEYS.set({ anthropic: val('#key-anthropic'), typesafe: val('#key-typesafe') });
    // keys mean playing online; without a Jev key there is nothing online to play with
    if (API_KEYS.keys.typesafe) MISSES.set({ net: 'online' });
    store.showKeys(false);
  },
  'dev-day': () => { quietReset(); store.devGoToDay(Number(val('#dev-day'))); },
  'dev-flag': () => { const v = val('#dev-flag-name').trim(); if (v) store.devSetFlag(v, true); },
  phish: () => store.phish(val('#ph-pass')),
  prince: () => store.princeClaim(val('#pr-seed')),
  lonely: () => { const v = val('#lonely-input').trim(); if (v && store.lonelySend(v)) { SOUND.play('send'); clearField('lonely-input'); } },
  sorry: () => { const v = val('#sorry-input').trim(); if (v && store.sorrySend(v)) { SOUND.play('send'); clearField('sorry-input'); } },
  'sw-trade': (f) => { if (store.trade(f.dataset.ticker!, 'buy', val('#sw-amount').trim())) clearField('sw-amount'); },
  'stack-code': () => { if (store.stackCode(val('#st-code'))) clearField('st-code'); },
  'stack-withdraw': () => { if (store.stackWithdraw(val('#st-out').trim())) clearField('st-out'); },
  'cb-send': () => store.send(val('#cb-to').trim(), val('#cb-amount').trim()),
  'cb-token': () => store.createToken(val('#cb-tok-ticker'), val('#cb-tok-supply')),
  'cb-ex': () => { if (store.exchange(val('#cb-ex-amount').trim())) clearField('cb-ex-amount'); },
  url: () => { newPageLoad(); store.navigate(val('#nt-url') || val('#address')); },
  ypost: () => { const v = val('#post-input').trim(); if (v) { SOUND.play('send'); clearField('post-input'); markSend($('#viewport')!, 'post'); void store.post(v, trendingToday()); } },
  prompt: () => {
    const v = val('#prompt-input').trim(); if (!v || store.busy) return;
    SOUND.play('send');
    clearField('prompt-input');
    updateCost();
    markSend($('#viewport')!, 'prompt');
    void store.prompt(v);
  },
  mail: (f) => {
    const to = val('#mail-to').trim(), subject = val('#mail-subject').trim(), body = val('#mail-body').trim();
    if (!to || !body) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { store.setMailError('Enter a valid address.'); return; }
    if (store.busy) return;
    SOUND.play('send');
    flyOff(f);
    markSend($('#viewport')!, 'mail');
    void store.compose(to, subject, body).then((r) => { if (r?.sent) { clearMailDraft(); store.setDraft(null); sendLanded(); store.navigate('qmail.com/sent'); } });
  },
  reply: (f) => {
    const v = val('#reply-body').trim(); if (!v || store.busy) return;
    SOUND.play('send');
    flyOff(f);
    markSend($('#viewport')!, 'reply');
    // the text stays in the (disabled) box until the email is in the thread; if it doesn't go out it stays editable
    const id = f.dataset.id, to = f.dataset.to;
    const sent = id ? store.reply(id, v) : to ? store.compose(to, f.dataset.subject ?? '', v, 'reply-body') : null;
    void sent?.then((r) => { if (r && !('sent' in r && r.sent === false)) clearField('reply-body'); });
  },
  review: (f) => {
    const biz = f.dataset.biz!; const v = val('#review-text').trim(); const stars = store.ui.reviewStars;
    if (!stars) { store.needStars(); return; }
    if (v) SOUND.play('send');
    if (v) void store.review(biz, stars, v).then((r) => { if (r && r.posted !== false) clearField('review-text'); });
  },
  waitlist: (f) => store.joinWaitlist(f.dataset.app!, val('#wl-email').trim()),
  'sl-search': (f) => {
    const q = val('#sl-q').trim();
    store.navigate(`${f.dataset.base}${q ? `/search/${encodeURIComponent(q.toLowerCase())}` : ''}`);
  },
  'sl-msg': (f) => {
    const v = val('#sl-msg').trim(); if (!v || store.busy) return;
    SOUND.play('send');
    void store.swapMessage(Number(f.dataset.n), v).then((r) => { if (r?.sent) clearField('sl-msg'); });
  },
  'sl-offer': (f) => { if (!store.busy) void store.swapOffer(Number(f.dataset.n), Number(val('#sl-offer'))); },
  'sl-buy': (f) => { if (!store.busy) void store.swapBuy(Number(f.dataset.n)); },
  'mx-login': () => store.matchlessLogin(val('#mx-user'), val('#mx-pass')),
  'mx-swipe': (f) => {
    const pick = f.dataset.pick === 'yes' ? 'yes' : 'no';
    SOUND.play(pick === 'yes' ? 'like' : 'ghost');
    swipeOff(f.closest<HTMLElement>('.mx-card'), pick);
    store.matchlessSwipe(pick);
  },
  'y-search': () => {
    // a handle opens that profile; one nobody uses gets Y's "doesn't exist" page
    const q = val('#y-search').trim().replace(/^@/, '').toLowerCase();
    if (!q) return;
    store.setYSearch('');
    store.navigate('y.com/' + encodeURIComponent(q));
  },
  'fy-search': () => {
    const q = val('#fy-search-input').trim().replace(/^@/, '');
    if (q) store.navigate('forkyard.com/u/' + q.toLowerCase());
  },
  term: () => {
    const v = val('#term-input').trim(); if (!v) return;
    SOUND.play('send', 0, 'terminal');
    clearField('term-input');
    if (v === 'clear' && !store.ui.termSsh) { store.termClear(); return; }
    void store.term(v);
  },
  aterm: () => {
    const v = val('#aterm-input').trim(); if (!v) return;
    SOUND.play('send', 0, 'terminal');
    clearField('aterm-input');
    if (v === 'clear') { store.agentTermClear(); return; }
    if (v === 'exit' || v === 'quit') { store.endAgentSession(); return; }
    void store.agentTerm(v);
  },
};
document.addEventListener('submit', (e) => {
  const f = (e.target as HTMLElement).closest<HTMLFormElement>('[data-form]');
  if (!f) return;
  e.preventDefault();
  FORMS[f.dataset.form ?? '']?.(f);
});

// Cinnamon-style: hovering a menu category opens it
document.addEventListener('mouseover', (e) => {
  const c = (e.target as HTMLElement).closest<HTMLElement>('[data-menu-cat]');
  if (c) store.setMenuCat(c.dataset.menuCat!);
});

// ── inputs & keys ──
document.addEventListener('input', (e) => {
  if (e.target instanceof HTMLElement && wikiInput(e.target, store)) return;
  const el = e.target as HTMLInputElement;
  if (el.id === 'y-search') store.setYSearch(el.value);
  else if (el.id === 'yowl-search') store.setYowlSearch(el.value);
  else if (el.id === 'fy-search-input') store.setFySearch(el.value);
  else if (el.id === 'prompt-input' || el.id === 'lonely-input' || el.id === 'sorry-input') updateCost();
  else if (el.id === 'cb-ex-amount') updateQuote();
  else if (el.id === 'mail-to') { syncMailTo(); showSuggestions(el); }
  else if (el.id === 'snd-vol') SOUND.setVolume(Number(el.value) / 100);
});
document.addEventListener('change', (e) => {
  const el = e.target as HTMLSelectElement;
  if (el.id === 'cb-ex-from' || el.id === 'cb-ex-to') store.setExchange(el.id === 'cb-ex-from' ? 'from' : 'to', el.value, val('#cb-ex-amount'));
  else if (el.id === 'llm-misses') MISSES.set({ misses: el.value as Misses });
  else if (el.id === 'llm-haiku-via') MISSES.set({ haikuVia: el.value as HaikuVia });
  else if (el.id === 'llm-net') MISSES.set({ net: el.value as Net });
  else if (el.dataset.devMeter) store.devSetMeter(el.dataset.devMeter as MeterId, Number(el.value));
  else if (el.id === 'snd-vol') { SOUND.setVolume(Number(el.value) / 100, true); SOUND.play('reply'); }
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
  // every text box sends on Enter and takes a line break on Shift+Enter (single-line inputs already submit on Enter)
  if (el instanceof HTMLTextAreaElement && el.form && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); el.form.requestSubmit(); }
  if (e.key === '`' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); store.toggleDev(); }
  if (e.key === 'Escape' && store.ui.start) store.toggleStart(false);
  if (e.key === 'Escape' && store.ui.filePick) store.closeFilePicker();
  // Alt+Left / Alt+Right, like a real browser
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); if (e.key === 'ArrowLeft') store.back(); else store.forward(); }
});

// the audio can only start after a gesture; clicks tick, typing ticks quieter (sends have their own cue)
const TYPING = new Set(['text', 'search', 'email', 'password', 'url', 'number', 'textarea']);
document.addEventListener('pointerdown', (e) => {
  SOUND.unlock();
  const t = e.target as HTMLElement;
  const hit = t.closest('button, a, summary, label, select, [data-nav], [data-tab], [data-act], [data-task], [data-start], [data-like], [data-repost], [data-star], input[type="checkbox"], input[type="radio"]');
  if (hit && !hit.closest('[data-deploy]') && !(hit instanceof HTMLButtonElement && hit.type === 'submit' && hit.form)) SOUND.play('click', 0, soundSite(t));
}, true);
document.addEventListener('keydown', (e) => {
  SOUND.unlock();
  const el = e.target as HTMLInputElement;
  const kind = el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'INPUT' ? el.type : '';
  if (!TYPING.has(kind) || e.ctrlKey || e.metaKey || e.altKey || e.key === 'Enter') return;
  if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') SOUND.play('key', 0, soundSite(el));
}, true);
/** The Terminal window and the desktop chrome have their own sound; the page uses its site's. */
function soundSite(el: HTMLElement): string | undefined {
  if (el.closest('#termwin')) return 'terminal';
  if (el.closest('#viewport')) return undefined;
  return 'plain';
}

void lastSite;
render();
