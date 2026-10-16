/*
 * The store: engine state + browser UI state (tabs, transient inputs). A tiny observable; main.ts
 * re-renders on change. All engine calls go through here, with Jev (decisions) and Haiku (wording)
 * injected into the pure engine functions.
 */
import {
  type GameState, type JevRouter, type SaveStore, type Writer,
  startGame, startDayChat, endDay, deploy, takeDown, postToY, replyToEvent, composeEmail,
  promptAgent, writeReview, setValue, addFlag, clearFlag, AGENT_ROLLOUT, type MeterId, localPrompt, makeBooking, cancelBooking, joinEmpire, sendCrypto, deliverDue, CLOCK, tick, devToggleBug, nameUnnamedBugs,
} from '../engine';
import type { Content } from '../content/schema';
import { readSlot, writeSlot, type Slot } from './saves';
import { route, visitedFlag } from '../sites/registry';
import { PULL_MS, pullLines } from './pull';
import { DEEPSLEEP_LINES, DEEPSLEEP_PLEA } from '../engine/deepsleep';

/** A browser tab. back/fwd are the pages behind and ahead of it, like a real browser's history. */
export interface Tab { id: number; url: string; back: string[]; fwd: string[] }
export interface Draft { to: string; subject: string; body: string }

const norm = (u: string) =>
  String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || 'newtab';

const startTabs = (): Tab[] => [{ id: 1, url: 'qmail.com', back: [], fwd: [] }, { id: 2, url: 'agent.chat', back: [], fwd: [] }];

export class GameStore {
  state: GameState;
  tabs: Tab[] = startTabs();
  active = 1;
  private nextTab = 3;
  busy = false;
  /** The agent prompt being answered right now, shown in the chat as soon as it's sent. */
  pendingPrompt: string | null = null;
  ui = {
    ySearch: '', yowlSearch: '', fySearch: '', reviewStars: 0, walletRange: '1M', draft: null as Draft | null,
    project: '', dev: false, liked: {} as Record<string, boolean>, intro: true, confirm: null as null | { text: string; yes: string; fn: () => void }, start: false, menuCat: 'saves',
    /** The Terminal is its own window: open (in the taskbar) and shown (in front of the browser). */
    termOpen: false, termShown: false,
    /** Dev mode: the site whose options panel is open (agent, qmail, y), or ''. */
    devOptions: '' as string,
    /** The two-step booking form: which step is showing and what step one said. */
    book: { step: 1, name: '', email: '', date: 0 },
    /** Dev: the flags and meters editor is open. */
    devEdit: false,
    /** Coinbin's Send form: open or not, what was typed, and why the last attempt failed. */
    send: { open: false, to: '', amount: '', error: '' },
    /** A line under Coinbin's Send/Receive buttons: "Address copied", or what was just sent. */
    cbNotice: '',
    /** Yowl: Post was pressed with no rating picked. */
    reviewNeedsStars: false,
    /** The save-slot menu's last failure, shown in its note. */
    slotNote: '',
    /** Qmail compose: why Send was refused before anything went out. */
    mailError: '',
  };
  /** A model download playing out in the Terminal, if one is running. */
  pull: { id: string; startedAt: number } | null = null;
  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private pullListeners = new Set<() => void>();

  private listeners = new Set<() => void>();

  constructor(readonly content: Content, private router: JevRouter, private writer: Writer, private store: SaveStore) {
    const loaded = this.store.load();
    this.state = loaded ?? startGame(content);
    nameUnnamedBugs(this.state, content); // saves from before the app had named bugs
    startDayChat(this.state, content); // saves from before the per-day reset may still carry yesterday's chat
    this.ui.intro = !this.state.introSeen;
    applyDevMode(this.devMode);
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const fn of this.listeners) fn(); }
  /** Called on every frame of a download, so only the Terminal and the progress bars repaint. */
  onPull(fn: () => void): () => void { this.pullListeners.add(fn); return () => this.pullListeners.delete(fn); }
  private commit(s: GameState): void { this.state = s; this.store.save(s); this.emit(); }
  /** Commit an action, then auto-sleep if the clock has run past midnight. */
  private commitAndSettle(s: GameState): void {
    this.state = s;
    if (!s.ending && s.clockMin >= CLOCK.sleep) this.sleep(s);
    this.store.save(this.state); this.emit();
  }

  get url(): string { return this.tabs.find((t) => t.id === this.active)?.url ?? 'newtab'; }

  navigate(url: string, newTab = false): void {
    const u = norm(url);
    this.ui.cbNotice = '';
    // localhost is the laptop itself: it opens the Terminal app, not a browser page
    if (u === 'localhost' && this.state.flags.includes('has_terminal')) { this.showTerm(true); return; }
    if (newTab) { const id = this.nextTab++; this.tabs.push({ id, url: u, back: [], fwd: [] }); this.active = id; }
    else {
      const t = this.tabs.find((x) => x.id === this.active);
      if (!t) this.tabs.push({ id: this.nextTab++, url: u, back: [], fwd: [] });
      else if (t.url !== u) { t.back.push(t.url); t.fwd = []; t.url = u; }
    }
    this.markVisited(u);
    this.emit();
  }
  /** First visit to a site that is bookmarked only after you've been there: add the bookmark. */
  private markVisited(url: string): void {
    const r = route(url, this.state);
    if (!r.def?.bookmarkAfterVisit || !r.reachable) return;
    const f = visitedFlag(r.def.id);
    if (this.state.flags.includes(f)) return;
    this.state.flags.push(f); this.state.flags.sort();
    this.store.save(this.state);
  }
  private get tab(): Tab | undefined { return this.tabs.find((t) => t.id === this.active); }
  get canBack(): boolean { return !!this.tab?.back.length; }
  get canForward(): boolean { return !!this.tab?.fwd.length; }
  /** Return to the previous page in this tab. */
  back(): void { const t = this.tab; if (!t?.back.length) return; t.fwd.push(t.url); t.url = t.back.pop()!; this.emit(); }
  forward(): void { const t = this.tab; if (!t?.fwd.length) return; t.back.push(t.url); t.url = t.fwd.pop()!; this.emit(); }
  switchTab(id: number): void { this.active = id; this.emit(); }
  closeTab(id: number): void {
    if (this.tabs.length === 1) { this.navigate('newtab'); return; }
    const i = this.tabs.findIndex((t) => t.id === id);
    this.tabs.splice(i, 1);
    if (this.active === id) this.active = this.tabs[Math.max(0, i - 1)].id;
    this.emit();
  }

  setYSearch(v: string): void { this.ui.ySearch = v; this.emit(); }
  setYowlSearch(v: string): void { this.ui.yowlSearch = v; this.emit(); }
  setFySearch(v: string): void { this.ui.fySearch = v; this.emit(); }
  setWalletRange(r: string): void { this.ui.walletRange = r; this.emit(); }
  setReviewStars(n: number): void { this.ui.reviewStars = n; this.ui.reviewNeedsStars = false; this.emit(); }
  needStars(): void { this.ui.reviewNeedsStars = true; this.emit(); }
  setCbNotice(text: string): void { this.ui.cbNotice = text; this.emit(); }
  setDraft(d: Draft | null): void { this.ui.draft = d; this.ui.mailError = ''; this.emit(); }
  setMailError(text: string): void { this.ui.mailError = text; this.emit(); }
  setProject(id: string): void { this.ui.project = id; this.emit(); }
  toggleDevOptions(site: string): void { this.ui.devOptions = this.ui.devOptions === site ? '' : site; this.emit(); }
  toggleDevEdit(): void { this.ui.devEdit = !this.ui.devEdit; this.emit(); }
  toggleDev(): void { this.ui.dev = !this.ui.dev; this.emit(); }
  /** Dev mode shows how replies were chosen (Jev's decision, the model prompt and output). On unless turned off. */
  devMode = readDevMode();
  setDevMode(on: boolean): void {
    this.devMode = on;
    try { localStorage.setItem(DEV_KEY, on ? '1' : '0'); } catch { /* storage off */ }
    applyDevMode(on);
    this.emit();
  }
  like(id: string): void { this.ui.liked[id] = !this.ui.liked[id]; this.emit(); }
  /** Mark a mail row read (persisted, no re-render — called during render). */
  markReadMail(id: string): void {
    const s = this.state;
    if (id.startsWith('m/')) { const m = s.mail.find((x) => x.id === id.slice(2)); if (m && !m.read) { m.read = true; this.store.save(s); } }
    else if (id.startsWith('e/')) { const ev = id.slice(2); if (!s.readEvents.includes(ev)) { s.readEvents.push(ev); this.store.save(s); } }
  }
  dismissMorning(): void { this.state.morning = null; this.store.save(this.state); this.emit(); }
  seenIntro(): void { this.ui.intro = false; this.state.introSeen = true; this.store.save(this.state); this.emit(); }
  openIntro(): void { this.ui.intro = true; this.emit(); }
  confirm(text: string, yes: string, fn: () => void): void { this.ui.confirm = { text, yes, fn }; this.emit(); }
  resolveConfirm(ok: boolean): void { const c = this.ui.confirm; this.ui.confirm = null; this.emit(); if (ok && c) c.fn(); }

  setMenuCat(c: string): void { if (this.ui.menuCat !== c) { this.ui.menuCat = c; this.emit(); } }
  toggleStart(open = !this.ui.start): void { if (this.ui.start !== open) { this.ui.start = open; this.emit(); } }

  /** Bring the Terminal to the front (opening it if needed), or send it behind the browser. */
  showTerm(shown: boolean): void {
    if (shown) this.ui.termOpen = true;
    this.ui.termShown = shown && this.ui.termOpen; this.emit();
  }
  closeTerm(): void { this.ui.termOpen = false; this.ui.termShown = false; this.emit(); }
  /** The Terminal's taskbar button: open it, bring it forward, or minimize it if it's already in front. */
  termTask(): void { this.showTerm(!(this.ui.termOpen && this.ui.termShown)); }

  newGame(): void {
    this.store.clear();
    this.resetTo(startGame(this.content));
  }
  /** Snapshot the current game into a manual slot. */
  saveSlot(n: Slot): boolean { const ok = writeSlot(n, this.state); this.ui.slotNote = ok ? '' : `Slot ${n} wasn't saved: this browser isn't letting the game store anything.`; this.emit(); return ok; }
  /** Replace the current game with a slot's snapshot (it becomes the autosave too). */
  loadSlot(n: Slot): boolean {
    const s = readSlot(n);
    if (!s) return false;
    this.resetTo(s);
    return true;
  }
  private resetTo(state: GameState): void {
    this.stopPull();
    startDayChat(state, this.content);
    nameUnnamedBugs(state, this.content);
    this.state = state;
    this.tabs = startTabs();
    this.active = 1; this.nextTab = 3;
    this.ui = { ySearch: '', yowlSearch: '', fySearch: '', reviewStars: 0, walletRange: '1M', draft: null, project: '', dev: this.ui.dev, liked: {}, intro: false, confirm: null, start: false, menuCat: 'saves', termOpen: false, termShown: false, devOptions: this.ui.devOptions, devEdit: this.ui.devEdit, book: { step: 1, name: '', email: '', date: 0 }, send: { open: false, to: '', amount: '', error: '' }, cbNotice: '', reviewNeedsStars: false, slotNote: '', mailError: '' };
    this.store.save(this.state);
    this.emit();
  }

  endDay(): void { this.sleep(this.state); this.store.save(this.state); this.emit(); }
  /** End the day and autosave the new morning into the 'auto' slot. */
  private sleep(s: GameState): void {
    this.state = endDay(s, this.content);
    if (!this.state.ending) writeSlot('auto', this.state);
  }
  deploy(appId: string): void { this.commitAndSettle(deploy(this.state, appId)); }
  takeDown(appId: string): void { this.commit(takeDown(this.state, appId)); }
  cancelBooking(id: string): void { this.commit(cancelBooking(this.state, id)); }
  joinEmpire(): void { this.commitAndSettle(joinEmpire(this.state)); }
  toggleSend(open = !this.ui.send.open): void { this.ui.send = { open, to: '', amount: '', error: '' }; this.ui.cbNotice = ''; this.emit(); }
  /** Coinbin Send. A refusal keeps the form open with what was typed and the reason. */
  send(to: string, amount: string): boolean {
    const r = sendCrypto(this.state, to, Number(amount.replace(',', '.')));
    if (r.error) { this.ui.send = { open: true, to, amount, error: r.error }; this.emit(); return false; }
    this.ui.send = { open: false, to: '', amount: '', error: '' };
    this.ui.cbNotice = `Sent ${(-r.state.tx.at(-1)!.amount).toFixed(2)} DOLR to ${r.state.tx.at(-1)!.memo.split(' · ')[0]}.`;
    this.commitAndSettle(r.state);
    return true;
  }
  // a new attempt clears the last attempt's notice, so a refusal never sticks to a date it wasn't about
  bookNext(name: string, email: string, date: number): void { delete this.state.bookingNotice; this.ui.book = { step: 2, name, email, date }; this.emit(); }
  bookBack(): void { delete this.state.bookingNotice; this.ui.book.step = 1; this.emit(); }
  book(appId: string, time: string, party: number): void {
    const { name, email, date } = this.ui.book;
    const next = makeBooking(this.state, appId, name || 'You', email, date || this.state.values.day, time, party, this.content);
    if (next.bookings.length > this.state.bookings.length) this.ui.book = { step: 1, name: '', email: '', date: 0 };
    this.commitAndSettle(next);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.busy = true; this.emit();
    try { return await fn(); } finally { this.busy = false; this.emit(); }
  }

  async post(text: string, trending: string[]) {
    return this.run(async () => { const r = await postToY(this.state, this.router, text, trending); this.commitAndSettle(r.state); return r; });
  }
  async reply(eventId: string, text: string) {
    return this.run(async () => { const r = await replyToEvent(this.state, this.content, this.router, eventId, text, this.writer); this.commitAndSettle(r.state); return r; });
  }
  async compose(to: string, subject: string, text: string) {
    return this.run(async () => { const r = await composeEmail(this.state, this.content, this.router, to, text, this.writer, subject); this.commitAndSettle(r.state); return r; });
  }
  /** The agent is always free-text promptable. Jev routes it to a build/fix or an ordinary reply. */
  async prompt(text: string) {
    this.pendingPrompt = text;
    return this.run(async () => {
      try {
        const started = Date.now();
        const r = await promptAgent(this.state, this.content, this.router, text, this.writer);
        // Scripted replies come back instantly; hold them behind the typing dots like a generated one.
        const last = r.state.chat[r.state.chat.length - 1];
        if (last && last.from === 'agent' && last.src !== 'llm') await wait(replyDelay(last.text) - (Date.now() - started));
        this.pendingPrompt = null; this.commitAndSettle(r.state); return r;
      }
      finally { this.pendingPrompt = null; }
    });
  }
  async review(bizId: string, stars: number, text: string) {
    return this.run(async () => { const r = await writeReview(this.state, this.content, this.router, bizId, stars, text); this.ui.reviewStars = 0; this.commitAndSettle(r.state); return r; });
  }

  /** Start pulling a model: the Terminal opens and shows the download, which takes a few seconds. */
  download(id: string): void {
    if (this.pull || this.state.localModels.includes(id)) { this.showTerm(true); return; }
    this.pull = { id, startedAt: Date.now() };
    this.ui.termOpen = true; this.ui.termShown = true;
    this.emit();
    this.pullTimer = setInterval(() => {
      if (this.pullMs() >= PULL_MS) this.finishPull();
      else for (const fn of this.pullListeners) fn();
    }, 90);
  }
  /** How long the running download has been going, in ms. */
  pullMs(): number { return this.pull ? Date.now() - this.pull.startedAt : 0; }
  private stopPull(): void { if (this.pullTimer) clearInterval(this.pullTimer); this.pullTimer = null; this.pull = null; }
  private finishPull(): void {
    const id = this.pull!.id;
    this.stopPull();
    const s = this.state;
    if (!s.localModels.includes(id)) s.localModels.push(id);
    if (!s.flags.includes('knows_weightroom')) { s.flags.push('knows_weightroom'); s.flags.sort(); }
    if (!s.flags.includes('has_terminal')) { s.flags.push('has_terminal'); s.flags.sort(); }
    s.termModel = id;
    tick(s, 'download');
    s.terminal.push(...pullLines(id, PULL_MS));
    this.commitAndSettle(s);
  }
  termClear(): void { this.state.terminal = []; this.store.save(this.state); this.emit(); }

  devAdd(kind: string): void {
    const s = this.state;
    if (kind === 'money') { s.values.crypto += 100; s.tx.push({ day: s.values.day, amount: 100, memo: 'Dev · grant' }); }
    else if (kind === 'followers') s.values.followers += 50;
    else if (kind === 'deliver') deliverDue(s, this.content);
    this.store.save(s); this.emit();
  }
  /** Dev: set a meter to an exact value (clamped). A new day delivers that day's events. */
  devSetMeter(id: MeterId, value: number): void {
    const s = this.state;
    if (!Number.isFinite(value)) return;
    if (id === 'day') { this.devGoToDay(value); return; }
    setValue(s, id, value);
    this.store.save(s); this.emit();
  }
  /**
   * Dev: move straight to a day, without running the nights in between (no payday, rent or bills).
   * The agent gets the level GeneralAI would have rolled out by then, and that day's events arrive.
   */
  devGoToDay(day: number): void {
    const s = this.state;
    if (!Number.isFinite(day)) return;
    setValue(s, 'day', day);
    const d = s.values.day;
    const level = Math.max(1, ...Object.entries(AGENT_ROLLOUT).filter(([k]) => Number(k) <= d).map(([, v]) => v));
    s.values.agentLevel = Math.max(s.values.agentLevel, level);
    s.postsToday = 0; s.sentToday = [];
    s.morning = null;
    deliverDue(s, this.content);
    this.store.save(s); this.emit();
  }
  /** Dev: switch a story flag on or off. */
  devSetFlag(flag: string, on: boolean): void {
    const f = flag.trim();
    if (!f) return;
    if (on) addFlag(this.state, f); else clearFlag(this.state, f);
    this.store.save(this.state); this.emit();
  }

  /** Dev mode: switch a bug or break on one app feature on or off. */
  devToggleBug(appId: string, featureId: string, key: string): void {
    devToggleBug(this.state, appId, featureId, key);
    this.store.save(this.state); this.emit();
  }

  async term(text: string) {
    return this.run(async () => {
      // a 0.5B model on this laptop: free, but it makes you wait
      await wait(1500 + Math.random() * 1500);
      const r = await localPrompt(this.state, text, DEEPSLEEP, DEEPSLEEP_PLEA.zh); this.commitAndSettle(r.state); return r;
    });
  }
}

const DEV_KEY = 'unknown-agent-dev';
function readDevMode(): boolean {
  try { return localStorage.getItem(DEV_KEY) !== '0'; } catch { return true; }
}
function applyDevMode(on: boolean): void {
  if (typeof document !== 'undefined') document.body.classList.toggle('dev-on', on);
}

/** How long a scripted agent reply "thinks" before it appears: longer for longer replies, a little random. */
export function replyDelay(text: string, rnd = Math.random): number {
  return Math.min(4500, 1200 + 15 * text.length + Math.round(rnd() * 600));
}
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));

/** deepsleep-0.5B's whole repertoire: one confident, absurd sentence in Chinese, whatever you ask. */
const DEEPSLEEP = DEEPSLEEP_LINES.map((l) => l.zh);
