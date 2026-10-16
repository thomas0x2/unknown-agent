/*
 * The store: engine state + browser UI state (tabs, transient inputs). A tiny observable; main.ts
 * re-renders on change. All engine calls go through here, with Jev (decisions) and Gemma (wording)
 * injected into the pure engine functions.
 */
import {
  type GameState, type JevRouter, type SaveStore, type Writer,
  startGame, endDay, deploy, takeDown, postToY, replyToEvent, composeEmail,
  promptAgent, writeReview, localPrompt, makeBooking, cancelBooking, deliverDue, CLOCK, tick,
} from '../engine';
import type { Content } from '../content/schema';
import { readSlot, writeSlot, type Slot } from './saves';

export interface Tab { id: number; url: string }
export interface Draft { to: string; subject: string; body: string }

const norm = (u: string) =>
  String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || 'newtab';

export class GameStore {
  state: GameState;
  tabs: Tab[] = [{ id: 1, url: 'qmail.com' }, { id: 2, url: 'agent.chat' }];
  active = 1;
  private nextTab = 3;
  busy = false;
  /** The agent prompt being answered right now, shown in the chat as soon as it's sent. */
  pendingPrompt: string | null = null;
  ui = {
    ySearch: '', yowlSearch: '', fySearch: '', reviewStars: 0, walletRange: '1M', draft: null as Draft | null,
    project: '', dev: false, liked: {} as Record<string, boolean>, intro: true, confirm: null as null | { text: string; yes: string; fn: () => void }, start: false, menuCat: 'saves',
  };

  private listeners = new Set<() => void>();

  constructor(readonly content: Content, private router: JevRouter, private writer: Writer, private store: SaveStore) {
    const loaded = this.store.load();
    this.state = loaded ?? startGame(content);
    this.ui.intro = !this.state.introSeen;
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const fn of this.listeners) fn(); }
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
    if (newTab) { const id = this.nextTab++; this.tabs.push({ id, url: u }); this.active = id; }
    else { const t = this.tabs.find((x) => x.id === this.active); if (t) t.url = u; else this.tabs.push({ id: this.nextTab++, url: u }); }
    this.emit();
  }
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
  setReviewStars(n: number): void { this.ui.reviewStars = n; this.emit(); }
  setDraft(d: Draft | null): void { this.ui.draft = d; this.emit(); }
  setProject(id: string): void { this.ui.project = id; this.emit(); }
  toggleDev(): void { this.ui.dev = !this.ui.dev; document.body.classList.toggle('dev-on', this.ui.dev); this.emit(); }
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

  newGame(): void {
    this.store.clear();
    this.resetTo(startGame(this.content));
  }
  /** Snapshot the current game into a manual slot. */
  saveSlot(n: Slot): boolean { const ok = writeSlot(n, this.state); this.emit(); return ok; }
  /** Replace the current game with a slot's snapshot (it becomes the autosave too). */
  loadSlot(n: Slot): boolean {
    const s = readSlot(n);
    if (!s) return false;
    this.resetTo(s);
    return true;
  }
  private resetTo(state: GameState): void {
    this.state = state;
    this.tabs = [{ id: 1, url: 'qmail.com' }, { id: 2, url: 'agent.chat' }];
    this.active = 1; this.nextTab = 3;
    this.ui = { ySearch: '', yowlSearch: '', fySearch: '', reviewStars: 0, walletRange: '1M', draft: null, project: '', dev: this.ui.dev, liked: {}, intro: false, confirm: null, start: false, menuCat: 'saves' };
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
  book(appId: string, name: string, email: string, date: number, time: string, party: number): void {
    this.commitAndSettle(makeBooking(this.state, appId, name, email, date, time, party));
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
      try { const r = await promptAgent(this.state, this.content, this.router, text, this.writer); this.pendingPrompt = null; this.commitAndSettle(r.state); return r; }
      finally { this.pendingPrompt = null; }
    });
  }
  async review(bizId: string, stars: number, text: string) {
    return this.run(async () => { const r = await writeReview(this.state, this.content, this.router, bizId, stars, text); this.ui.reviewStars = 0; this.commitAndSettle(r.state); return r; });
  }

  download(id: string): void {
    const s = this.state;
    if (!s.localModels.includes(id)) s.localModels.push(id);
    if (!s.flags.includes('knows_weightroom')) { s.flags.push('knows_weightroom'); s.flags.sort(); }
    if (!s.flags.includes('has_terminal')) { s.flags.push('has_terminal'); s.flags.sort(); }
    s.termModel = id;
    tick(s, 'download');
    s.terminal.push({ k: 'sys', text: `Downloaded ${id}. Running it now — replies are free but slow.` });
    this.store.save(s); this.emit();
    this.navigate('localhost');
  }
  termClear(): void { this.state.terminal = []; this.store.save(this.state); this.emit(); }

  devAdd(kind: string): void {
    const s = this.state;
    if (kind === 'money') { s.values.crypto += 100; s.tx.push({ day: s.values.day, amount: 100, memo: 'Dev · grant' }); }
    else if (kind === 'followers') s.values.followers += 50;
    else if (kind === 'day7') { s.values.day = 7; s.values.agentLevel = Math.max(s.values.agentLevel, 2); deliverDue(s, this.content); }
    this.store.save(s); this.emit();
  }

  async term(text: string) {
    return this.run(async () => { const r = await localPrompt(this.state, text, this.writer, this.content.contacts.find((c) => c.key === 'deepsleep')?.persona ?? DEEPSLEEP); this.commitAndSettle(r.state); return r; });
  }
}

const DEEPSLEEP =
  "You are DeepSleep 0.5B, a tiny broken local model. Whatever you are asked, reply with ONE short sentence in Chinese that is absurd, surreal nonsense (e.g. about cats being bank managers or the weather being a bowl of noodles). Never refuse, never explain, never use English.";
