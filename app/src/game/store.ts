/*
 * The store: engine state + browser UI state (tabs, transient inputs). A tiny observable; main.ts
 * re-renders on change. All engine calls go through here, with Jev (decisions) and Haiku (wording)
 * injected into the pure engine functions.
 */
import {
  type GameState, type JevRouter, type SaveStore, type Writer, JevOffline,
  startGame, startDayChat, endDay, deploy, takeDown, postToY, replyToEvent, composeEmail,
  promptAgent, writeReview, setValue, addFlag, clearFlag, AGENT_ROLLOUT, type MeterId, localPrompt, makeBooking, cancelBooking, joinEmpire, sendCrypto, settlePayments, recordStake, payStakes, buyStock, sellStock, deliverDue, deliverArrivals, spreadJobOffers, marketPosts, fillerToday, CLOCK, MS_PER_GAME_MIN, advanceClock, phishLogin, seedClaim, lonelySay, lonelyReply, devToggleBug, nameUnnamedBugs, holdHiddenBugs, revealBugs, money, AGENT_USAGE, addValue, binMail, restoreMail, emptyMailBin, gameMinutes, wakeApps, swapMessage, swapOffer, swapBuy, matchlessSwipe, clone, uploadFile, fileRentAppeal, donateCrane, craneDonations, fillMeters, chargeChat, sorrySay, sorryReply, sorryScripted, sorryTooLong, sorryChat,
} from '../engine';
import type { Content } from '../content/schema';
import { readSlot, writeSlot, type Slot } from './saves';
import { route, visitedFlag } from '../sites/registry';
import { adSite } from '../sites/adSites';
import { PULL_MS, pullLines } from './pull';
import { DEEPSLEEP_LINES, DEEPSLEEP_PLEA } from '../engine/deepsleep';
import { MISSES } from './misses';
import { haikuApology } from './haiku';

/**
 * A browser tab. back/fwd are the pages behind and ahead of it, like a real browser's history. A
 * pinned tab always shows its site and can't be closed.
 */
export interface Tab { id: number; url: string; back: string[]; fwd: string[]; pinned?: string }
export interface Draft { to: string; subject: string; body: string }

const norm = (u: string) =>
  String(u || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '') || 'newtab';

/** The laptop runs out of memory past this many tabs. */
export const MAX_TABS = 12;

/** Always open, in this order, and never closed: the sites where mail, posts and work come in. */
export const PINNED = ['coinbin.com', 'qmail.com', 'y.com', 'agent.chat', 'forkyard.com'];
/** The tab a game or a new day opens on: Qmail. */
const HOME_TAB = PINNED.indexOf('qmail.com') + 1;
const siteOf = (url: string) => url.split('/')[0];
const startTabs = (): Tab[] => PINNED.map((url, i) => ({ id: i + 1, url, back: [], fwd: [], pinned: url }));

/** What came in when the clock moved or an action landed, for alerts and sounds. */
export interface Arrival {
  /** New emails in the inbox, story emails and replies alike. */
  mail: number;
  /** New posts on the Y timeline by someone other than the player. */
  posts: number;
  /** The bot accounts among them, which land as a barrage rather than all at once. */
  bots: string[];
}
/** Where arrivals are counted from: the shared seq counter, and the timeline posts up today. */
interface ArrivalMark { seq: number; day: number; timed: number; extra: number; bots: Set<string> }

export class GameStore {
  state: GameState;
  tabs: Tab[] = startTabs();
  active = HOME_TAB;
  private nextTab = PINNED.length + 1;
  busy = false;
  /** The agent prompt being answered right now, shown in the chat as soon as it's sent. */
  pendingPrompt: string | null = null;
  /** A prompt's charge on its way to the wallet, a beat after the reply (0 when nothing is). */
  charging = 0;
  ui = {
    ySearch: '', yAllDay: 0, yowlSearch: '', fySearch: '', reviewStars: 0, walletRange: '1M', draft: null as Draft | null,
    /** Bot posts landing as a barrage: when each shows up on Y (performance.now() ms), so a repaint keeps the timing. */
    yBurst: {} as Record<string, number>,
    project: '', dev: false, liked: {} as Record<string, boolean>, reposted: {} as Record<string, boolean>, intro: true, greet: false, memWarn: false, confirm: null as null | { text: string; yes: string; fn: () => void }, start: false, menuCat: 'saves',
    /** The Terminal is its own window: open (in the taskbar) and shown (in front of the browser). */
    termOpen: false, termShown: false,
    /** Dev mode: the site whose options panel is open (agent, qmail, y), or ''. */
    devOptions: '' as string,
    /** The two-step booking form: which step is showing and what step one said. */
    book: { step: 1, name: '', email: '', date: 0 },
    /** Dev: the flags and meters editor is open, and which of its tabs shows. */
    devEdit: false,
    devTab: 'edit' as 'edit' | 'jev',
    /** Coinbin's Send form: open or not, what was typed, and why the last attempt failed. */
    send: { open: false, to: '', amount: '', error: '' },
    /** A line under Coinbin's Send/Receive buttons: "Address copied", or what was just sent. */
    cbNotice: '',
    /** Sherwood's order box: what was typed, why the last order was refused, or what it filled. */
    sw: { amount: '', error: '', notice: '' },
    /** Yowl: Post was pressed with no rating picked. */
    reviewNeedsStars: false,
    /** The save-slot menu's last failure, shown in its note. */
    slotNote: '',
    /** Qmail compose: why Send was refused before anything went out. */
    mailError: '',
    /** Qmail: the line above the list after a conversation went into or out of the Bin, with what Undo puts back. */
    mailNotice: null as null | { text: string; ids: string[]; undo: 'bin' | 'restore' },
    /** coinbln.com: why the last sign-in was refused. */
    phishError: '',
    /** prince-claims.xyz: why the last seed phrase was refused. */
    princeError: '',
    /** Coinbin: the recovery phrase is on screen. */
    seedShown: false,
    /** lonely.ai: Mia is typing. */
    lonelyTyping: false,
    /** lonely.ai / sorrywriter.ai: why the last message wasn't sent (the wallet couldn't cover it). */
    chatError: '',
    /** sorrywriter.ai: the apology is being written. */
    sorryTyping: false,
    /** Why the last upload was refused (vantor.group/next-chapter takes PDFs only). */
    uploadError: '',
    /** The file last picked for an upload, so the picker keeps it after the page redraws. */
    uploadPick: '',
    /** An ad site's working button: the line under it (rentboard.gov's appeal). */
    adNotice: '',
    /** An action Jev was needed for and couldn't be reached: why, and the text to put back in its box. */
    jevOffline: null as { reason: string; field?: string; text?: string } | null,
    /** Y posts by others that went up since the player last looked at the timeline, for the Y tab's badge. */
    yUnread: 0,
  };
  /** A model download playing out in the Terminal, if one is running. */
  pull: { id: string; startedAt: number } | null = null;
  private pullTimer: ReturnType<typeof setInterval> | null = null;
  private pullListeners = new Set<() => void>();

  private listeners = new Set<() => void>();

  /** The real-time clock: game minutes pass while the player plays. Paused under dialogs and in a hidden tab. */
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private clockLast = 0;
  /** Real milliseconds not yet turned into a whole game minute. */
  private clockCarry = 0;
  private clockListeners = new Set<() => void>();
  private arrivalListeners = new Set<(a: Arrival) => void>();
  /** Dev: the clock is stopped by hand. */
  clockHeld = false;

  constructor(readonly content: Content, private router: JevRouter, private writer: Writer, private store: SaveStore) {
    const loaded = this.store.load();
    this.state = loaded ?? startGame(content);
    fillMeters(this.state.values); // saves from before a meter was added
    nameUnnamedBugs(this.state, content); // saves from before the app had named bugs
    holdHiddenBugs(this.state, content); // and from before bugs waited until they could show
    startDayChat(this.state, content); // saves from before the per-day reset may still carry yesterday's chat
    this.ui.intro = !this.state.introSeen;
    this.ui.greet = !this.state.introSeen; // a fresh game opens with the OS greeting
    applyDevMode(this.devMode);
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void { for (const fn of this.listeners) fn(); }
  /** Called on every frame of a download, so only the Terminal and the progress bars repaint. */
  onPull(fn: () => void): () => void { this.pullListeners.add(fn); return () => this.pullListeners.delete(fn); }
  /** Called on every game minute that passes without anything else changing, so only the clock repaints. */
  onClock(fn: () => void): () => void { this.clockListeners.add(fn); return () => this.clockListeners.delete(fn); }
  /**
   * Called whenever new mail lands in the inbox or new posts go up on Y: as the clock reaches their
   * time, when a reply comes back, or first thing in the morning. Hook alert sounds here.
   */
  onArrival(fn: (a: Arrival) => void): () => void { this.arrivalListeners.add(fn); return () => this.arrivalListeners.delete(fn); }
  private arrivalMark(s = this.state): ArrivalMark {
    const day = s.values.day;
    const market = marketPosts(s, this.content).filter((p) => p.day === day);
    return { seq: s.nextId, day, extra: s.yExtra.length, timed: market.length + fillerToday(s, this.content).length, bots: new Set(market.filter((p) => p.bot).map((p) => p.id)) };
  }
  /** Tell the listeners what arrived since `m`. Returns whether anything did. */
  private announce(m: ArrivalMark): boolean {
    const s = this.state;
    const fresh = (seq?: number) => (seq ?? -1) >= m.seq;
    const latent = (id: string) => !!this.content.events.find((e) => e.id === id)?.latent;
    const mail = s.mail.filter((x) => x.folder === 'inbox' && fresh(x.seq)).length
      + s.delivered.filter((d) => d.site === 'qmail' && fresh(d.seq) && !latent(d.eventId)).length;
    const now = this.arrivalMark(s);
    // timeline posts are counted afresh each day; a story post on Y is a delivery like an email
    const posts = (now.day === m.day ? Math.max(0, now.timed - m.timed) : now.timed)
      + Math.max(0, now.extra - m.extra)
      + s.delivered.filter((d) => d.site === 'y' && fresh(d.seq)).length;
    if (!mail && !posts) return false;
    this.ui.yUnread += posts;
    const bots = [...now.bots].filter((id) => now.day !== m.day || !m.bots.has(id));
    for (const fn of this.arrivalListeners) fn({ mail, posts, bots });
    return true;
  }
  private commit(s: GameState): void {
    const m = this.arrivalMark();
    this.keepTime(s); this.state = s; this.store.save(s); this.announce(m); this.emit();
  }
  /** Commit an action, then auto-sleep if the clock has reached bedtime (22:00). */
  private commitAndSettle(s: GameState): void {
    const m = this.arrivalMark();
    this.keepTime(s);
    this.state = s;
    if (!s.ending && s.clockMin >= CLOCK.sleep) this.sleep(s);
    this.store.save(this.state); this.announce(m); this.emit();
  }

  /**
   * An action works on a copy of the state, and the clock kept running while it waited on Jev:
   * carry the time over, and deliver the mail that came due meanwhile.
   */
  private keepTime(s: GameState): void {
    if (s === this.state || s.values.day !== this.state.values.day || s.clockMin >= this.state.clockMin) return;
    advanceClock(s, this.state.clockMin - s.clockMin);
    deliverArrivals(s, this.content);
  }

  /** A dialog is up (or the run is over), so time stands still. */
  get dialogOpen(): boolean {
    const s = this.state;
    return !!(s.ending || s.morning || this.ui.jevOffline || this.ui.confirm || this.ui.memWarn || this.ui.greet || this.ui.intro);
  }
  get clockPaused(): boolean {
    return this.clockHeld || this.dialogOpen || (typeof document !== 'undefined' && document.hidden);
  }
  /** Start the real-time clock. */
  startClock(): void {
    if (this.clockTimer) return;
    this.clockLast = Date.now();
    this.clockTimer = setInterval(() => this.clockFrame(), 100);
  }
  stopClock(): void { if (this.clockTimer) clearInterval(this.clockTimer); this.clockTimer = null; }
  private clockFrame(): void {
    const now = Date.now();
    const dt = now - this.clockLast;
    this.clockLast = now;
    if (this.clockPaused) return;
    // a stalled timer (a sleeping laptop) doesn't fast-forward the day
    this.clockCarry += Math.min(dt, 1000);
    const mins = Math.floor(this.clockCarry / MS_PER_GAME_MIN);
    if (!mins) return;
    this.clockCarry -= mins * MS_PER_GAME_MIN;
    this.passMinutes(mins);
  }
  /** Let game minutes pass: replies come due, and at 22:00 the day ends. */
  passMinutes(mins: number): void {
    const s = this.state;
    if (s.ending) return;
    if (this.busy) {
      // an action is working on a copy of this state: move the clock only, and hold mail and bedtime until it lands
      s.clockMin = Math.min(CLOCK.sleep - 1, s.clockMin + mins);
      for (const fn of this.clockListeners) fn();
      return;
    }
    const m = this.arrivalMark();
    const working = s.agentWork;
    advanceClock(s, mins); // the agent's build or fix lands here too, once its time has come
    const shown = revealBugs(s, this.content); // held bugs land once something shows them (Crane's first praise)
    const paid = payStakes(s, this.content); // the trader's stake payouts, 12:00 four days after each send
    const woke = wakeApps(s, this.content).length > 0 || shown || paid; // an empty app's first content (and its bugs) once its time has come
    deliverArrivals(s, this.content); // emails and posts whose time has come
    if (s.clockMin >= CLOCK.sleep) { this.sleep(s); this.store.save(this.state); this.announce(m); this.emit(); return; }
    if (this.announce(m) || s.agentWork !== working || woke) { this.store.save(s); this.emit(); return; }
    if (s.clockMin % 10 === 0) this.store.save(s);
    for (const fn of this.clockListeners) fn();
  }

  get url(): string { return this.tabs.find((t) => t.id === this.active)?.url ?? 'newtab'; }

  navigate(url: string, newTab = false): void {
    const u = norm(url);
    this.ui.cbNotice = '';
    this.ui.sw = { amount: '', error: '', notice: '' };
    this.ui.mailNotice = null;
    if (this.state.swap?.notice) this.state.swap.notice = undefined;
    // localhost is the laptop itself: it opens the Terminal app, not a browser page
    if (u === 'localhost' && this.state.flags.includes('has_terminal')) { this.showTerm(true); return; }
    // a pinned tab stays on its site: another site opens in its own pinned tab, or a new one
    const cur = this.tab;
    if (!newTab && cur?.pinned && siteOf(u) !== cur.pinned) {
      const home = this.tabs.find((x) => x.pinned === siteOf(u));
      if (home) {
        this.active = home.id;
        if (home.url !== u) { home.back.push(home.url); home.fwd = []; home.url = u; }
        this.markVisited(u); this.emit(); return;
      }
      newTab = true;
    }
    if (newTab && this.tabs.length >= MAX_TABS) { this.ui.memWarn = true; this.emit(); return; }
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
    this.ui.adNotice = ''; this.ui.chatError = ''; this.ui.uploadError = '';
    // an ad site can introduce a site it links to (deepsleep.ai links to Weightroom)
    const unlocks = r.site === 'adsite' && r.param ? adSite(r.param)?.unlocks : undefined;
    if (unlocks && !this.state.flags.includes(unlocks)) { this.state.flags.push(unlocks); this.state.flags.sort(); this.store.save(this.state); }
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
    const i = this.tabs.findIndex((t) => t.id === id);
    if (i < 0 || this.tabs[i].pinned) return;
    this.tabs.splice(i, 1);
    if (this.active === id) this.active = this.tabs[Math.max(0, i - 1)].id;
    this.emit();
  }

  setYSearch(v: string): void { this.ui.ySearch = v; this.emit(); }
  /** Y shows only today's posts until the player asks for the rest; the choice lapses at the next day. */
  showAllY(on = true): void { this.ui.yAllDay = on ? this.state.values.day : 0; this.emit(); }
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
  /** Opens the dev editor on a tab (or closes it, when that tab is already showing). */
  devTab(tab: 'edit' | 'jev'): void { this.ui.devEdit = !(this.ui.devEdit && this.ui.devTab === tab); this.ui.devTab = tab; this.emit(); }
  /** Repaints after something outside the store changed (the dev Jev tests report as they run). */
  repaint(): void { this.emit(); }
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
  repost(id: string): void { this.ui.reposted[id] = !this.ui.reposted[id]; this.emit(); }
  /** Mark a mail row read (persisted, no re-render — called during render). */
  markReadMail(id: string): void {
    const s = this.state;
    if (id.startsWith('m/')) { const m = s.mail.find((x) => x.id === id.slice(2)); if (m && !m.read) { m.read = true; this.store.save(s); } }
    else if (id.startsWith('e/')) { const ev = id.slice(2); if (!s.readEvents.includes(ev)) { s.readEvents.push(ev); this.store.save(s); } }
  }
  /** Qmail: move a conversation's emails into the Bin (or back out), then show the folder it came from. */
  binMail(ids: string[], back: string): void {
    binMail(this.state, ids); this.store.save(this.state);
    this.navigate(back);
    this.ui.mailNotice = { text: 'Conversation moved to the Bin.', ids, undo: 'restore' };
    this.emit();
  }
  restoreMail(ids: string[], back: string): void {
    restoreMail(this.state, ids); this.store.save(this.state);
    this.navigate(back);
    this.ui.mailNotice = back.startsWith('qmail.com/bin') ? { text: 'Conversation moved back to the Inbox.', ids, undo: 'bin' } : null;
    this.emit();
  }
  /** Undo the last Bin move, staying on the page. */
  undoMailNotice(): void {
    const n = this.ui.mailNotice;
    if (!n) return;
    if (n.undo === 'restore') restoreMail(this.state, n.ids); else binMail(this.state, n.ids);
    this.ui.mailNotice = null; this.store.save(this.state); this.emit();
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
    this.ui.greet = true; this.emit();
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
    holdHiddenBugs(state, this.content);
    fillMeters(state.values);
    this.state = state;
    this.tabs = startTabs();
    this.active = HOME_TAB; this.nextTab = PINNED.length + 1;
    this.ui = { ySearch: '', yAllDay: 0, yBurst: {}, yowlSearch: '', fySearch: '', reviewStars: 0, walletRange: '1M', draft: null, project: '', dev: this.ui.dev, liked: {}, reposted: {}, intro: false, greet: false, memWarn: false, confirm: null, start: false, menuCat: 'saves', termOpen: false, termShown: false, devOptions: this.ui.devOptions, devEdit: this.ui.devEdit, devTab: this.ui.devTab, book: { step: 1, name: '', email: '', date: 0 }, send: { open: false, to: '', amount: '', error: '' }, cbNotice: '', sw: { amount: '', error: '', notice: '' }, reviewNeedsStars: false, slotNote: '', mailError: '', mailNotice: null, phishError: '', princeError: '', seedShown: false, lonelyTyping: false, chatError: '', uploadError: '', uploadPick: '', sorryTyping: false, adNotice: '', jevOffline: null, yUnread: 0 };
    this.store.save(this.state);
    this.emit();
  }

  endDay(): void { this.sleep(this.state); this.store.save(this.state); this.emit(); }
  dismissGreet(): void { this.ui.greet = false; this.emit(); }
  dismissMemWarn(): void { this.ui.memWarn = false; this.emit(); }
  /**
   * End the day and autosave the new morning into the 'auto' slot. The next day starts with only the
   * pinned tabs open.
   */
  private sleep(s: GameState): void {
    this.state = endDay(s, this.content);
    if (this.state.ending) return;
    writeSlot('auto', this.state);
    this.tabs = startTabs();
    this.active = HOME_TAB; this.nextTab = PINNED.length + 1;
    this.ui.start = false;
  }
  deploy(appId: string): void { this.commitAndSettle(deploy(this.state, appId, this.content)); }
  takeDown(appId: string): void { this.commit(takeDown(this.state, appId)); }
  cancelBooking(id: string): void { this.commit(cancelBooking(this.state, id)); }
  joinEmpire(): void { this.commitAndSettle(joinEmpire(this.state)); }
  toggleSend(open = !this.ui.send.open): void { this.ui.send = { open, to: '', amount: '', error: '' }; this.ui.cbNotice = ''; this.emit(); }
  /** Coinbin Send. A refusal keeps the form open with what was typed and the reason. */
  send(to: string, amount: string): boolean {
    const r = sendCrypto(this.state, to, Number(amount.replace(',', '.')));
    if (r.error) { this.ui.send = { open: true, to, amount, error: r.error }; this.emit(); return false; }
    settlePayments(r.state, this.content);
    recordStake(r.state, to, -r.state.tx.at(-1)!.amount);
    this.ui.send = { open: false, to: '', amount: '', error: '' };
    this.ui.cbNotice = `Sent ${(-r.state.tx.at(-1)!.amount).toFixed(2)} DOLR to ${r.state.tx.at(-1)!.memo.split(' · ')[0]}.`;
    this.commitAndSettle(r.state);
    return true;
  }
  /** A Sherwood order: buy or sell `amount` DOLR of a ticker ('all' sells the whole position). */
  trade(ticker: string, side: 'buy' | 'sell', amount: string): boolean {
    const n = amount === 'all' ? 'all' : Number(amount.replace(',', '.'));
    const r = side === 'buy' ? buyStock(this.state, ticker, n === 'all' ? NaN : n) : sellStock(this.state, ticker, n);
    if (r.error) { this.ui.sw = { amount: amount === 'all' ? '' : amount, error: r.error, notice: '' }; this.emit(); return false; }
    const tx = r.state.tx.at(-1)!;
    this.ui.sw = { amount: '', error: '', notice: `${tx.memo.split(' · ')[1]} for ${Math.abs(tx.amount).toFixed(2)} DOLR.` };
    this.commitAndSettle(r.state);
    return true;
  }
  /** The phishing page's sign-in. A wrong password stays on the form with an error. */
  phish(password: string): void {
    const r = phishLogin(this.state, password);
    this.ui.phishError = r.error ?? '';
    if (r.error) { this.emit(); return; }
    this.commitAndSettle(r.state);
  }
  /** prince-claims.xyz: pasting the seed phrase. A wrong one stays on the form with an error. */
  princeClaim(phrase: string): void {
    const r = seedClaim(this.state, phrase);
    this.ui.princeError = r.error ?? '';
    if (r.error) { this.emit(); return; }
    this.commitAndSettle(r.state);
  }
  /** rentboard.gov: file an appeal, 5 DOLR, decided by email. */
  rentAppeal(): void {
    const r = fileRentAppeal(this.state);
    this.ui.adNotice = r.error ?? 'Appeal filed. The decision will be sent to your Qmail.';
    if (r.error) { this.emit(); return; }
    this.commitAndSettle(r.state);
  }
  /** Upload a Qdrive file to a website (the Vantor Outplacement resume upload). */
  upload(site: string, file: { id: string; name: string }): void {
    const r = uploadFile(this.state, site, file);
    this.ui.uploadPick = file.id;
    this.ui.uploadError = r.error ?? '';
    if (r.error) { this.emit(); return; }
    this.commitAndSettle(r.state);
  }
  /** crane2026.vote: donate 5 DOLR to the Crane Victory Fund. */
  craneDonate(): void {
    const r = donateCrane(this.state);
    const n = craneDonations(r.state);
    this.ui.adNotice = r.error ?? (n > 1 ? `Thank you. That's ${n} donations. Randall has been told.` : 'Thank you. Your donation of 5 DOLR has been received.');
    if (r.error) { this.emit(); return; }
    this.commitAndSettle(r.state);
  }
  /** lonely.ai: the player's message, then Mia's scripted reply after a short "typing". */
  lonelySend(text: string): boolean {
    if (this.ui.lonelyTyping) return false;
    const s = clone(this.state);
    this.ui.chatError = chargeChat(s, 'lonely', text) ?? '';
    if (this.ui.chatError) { this.emit(); return false; }
    this.commitAndSettle(lonelySay(s, text));
    this.ui.lonelyTyping = true; this.emit();
    setTimeout(() => { this.ui.lonelyTyping = false; this.commitAndSettle(lonelyReply(this.state)); }, 1400);
    return true;
  }
  /** sorrywriter.ai: bill the message, then Haiku writes the apology (scripted if it can't, or if the message is over the cap). */
  sorrySend(text: string): boolean {
    if (this.ui.sorryTyping) return false;
    const s = clone(this.state);
    this.ui.chatError = chargeChat(s, 'sorry', text) ?? '';
    if (this.ui.chatError) { this.emit(); return false; }
    const history = sorryChat(s).msgs.map((m) => ({ from: m.from === 'you' ? 'player' : 'self', text: m.text }));
    this.commitAndSettle(sorrySay(s, text));
    this.ui.sorryTyping = true; this.emit();
    void (async () => {
      const started = Date.now();
      const long = sorryTooLong(text);
      const h = long || MISSES.settings.misses === 'scripted' ? { text: null } : await haikuApology(text, MISSES.settings.haikuVia, history);
      await wait(1400 - (Date.now() - started));
      this.ui.sorryTyping = false;
      this.commitAndSettle(sorryReply(this.state, h.text ?? sorryScripted(this.state, long), h.text ? 'llm' : 'scripted'));
    })();
    return true;
  }
  /** Coinbin's Show/Hide recovery phrase. */
  toggleSeed(): void { this.ui.seedShown = !this.ui.seedShown; this.ui.cbNotice = ''; this.emit(); }
  // a new attempt clears the last attempt's notice, so a refusal never sticks to a date it wasn't about
  bookNext(name: string, email: string, date: number): void { delete this.state.bookingNotice; this.ui.book = { step: 2, name, email, date }; this.emit(); }
  bookBack(): void { delete this.state.bookingNotice; this.ui.book.step = 1; this.emit(); }
  /** Leaves the confirmation for a fresh, empty form. */
  bookAgain(): void { delete this.state.bookingNotice; this.ui.book = { step: 1, name: '', email: '', date: 0 }; this.emit(); }
  book(appId: string, time: string, party: number): void {
    const { name, email, date } = this.ui.book;
    const next = makeBooking(this.state, appId, name || 'You', email, date || this.state.values.day, time, party, this.content);
    if (next.bookings.length > this.state.bookings.length) this.ui.book = { step: 1, name: '', email: '', date: 0 };
    this.commitAndSettle(next);
  }

  /**
   * Runs an action that needs Jev. If Jev can't be reached, nothing happened (the engine works on a
   * copy), so the state stays as it was and a dialog says so; the text goes back into `field`.
   */
  private async run<T>(fn: () => Promise<T>, field?: string, text?: string): Promise<T | undefined> {
    this.busy = true; this.ui.jevOffline = null; this.emit();
    try { return await fn(); }
    catch (e) {
      if (!(e instanceof JevOffline)) throw e;
      this.ui.jevOffline = { reason: e.reason, field, text };
      return undefined;
    }
    finally { this.busy = false; this.emit(); }
  }
  dismissJevOffline(): void { this.ui.jevOffline = null; this.emit(); }

  async post(text: string, trending: string[]) {
    return this.run(async () => { const r = await postToY(this.state, this.router, text, trending, this.content); this.commitAndSettle(r.state); return r; }, 'post-input', text);
  }
  async reply(eventId: string, text: string) {
    return this.run(async () => { const r = await replyToEvent(this.state, this.content, this.router, eventId, text, this.writer); this.commitAndSettle(r.state); return r; }, 'reply-body', text);
  }
  /** `field` is the reply box when it's a reply to a thread; the compose form keeps its text until it's sent. */
  async compose(to: string, subject: string, text: string, field?: string) {
    return this.run(async () => { const r = await composeEmail(this.state, this.content, this.router, to, text, this.writer, subject); this.commitAndSettle(r.state); return r; }, field, text);
  }
  /** Swaplist: message the seller of a listing; the reply is written in their character. */
  async swapMessage(n: number, text: string) {
    return this.run(async () => { const r = await swapMessage(this.state, this.content, this.writer, n, text); this.commitAndSettle(r.state); return r; }, 'sl-msg', text);
  }
  /** Swaplist: offer an amount on a listing, or buy it (an accepted offer's amount, else the shown price). */
  swapOffer(n: number, amount: number): void { this.commitAndSettle(swapOffer(this.state, this.content, n, amount)); }
  swapBuy(n: number): void { this.commitAndSettle(swapBuy(this.state, this.content, n)); }
  /** matchless.com: accept or reject the current profile on the client's account. */
  matchlessSwipe(choice: 'yes' | 'no'): void { this.commit(matchlessSwipe(this.state, this.content, choice)); }
  /** The agent is always free-text promptable. Jev routes it to a build/fix or an ordinary reply. */
  async prompt(text: string) {
    this.pendingPrompt = text;
    return this.run(async () => {
      try {
        const started = Date.now();
        const txBefore = this.state.tx.length;
        const r = await promptAgent(this.state, this.content, this.router, text, this.writer);
        // Scripted replies come back instantly; hold them behind the typing dots like a generated one.
        const last = r.state.chat[r.state.chat.length - 1];
        if (last && last.from === 'agent' && last.src !== 'llm') await wait(replyDelay(last.text) - (Date.now() - started));
        // the reply lands first and the wallet is charged a beat later, so each makes its own sound
        const due = r.state.clockMin < CLOCK.sleep ? withholdCharge(r.state, txBefore) : 0;
        this.pendingPrompt = null; this.charging = due; this.commitAndSettle(r.state);
        if (due) {
          await wait(CHARGE_DELAY_MS);
          this.charging = 0;
          money(this.state, -due, AGENT_USAGE);
          this.commitAndSettle(this.state);
        }
        return r;
      }
      finally { this.pendingPrompt = null; this.charging = 0; }
    }, 'prompt-input', text);
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
    s.terminal.push(...pullLines(id, PULL_MS));
    this.commitAndSettle(s);
  }
  termClear(): void { this.state.terminal = []; this.store.save(this.state); this.emit(); }

  devAdd(kind: string): void {
    const s = this.state;
    if (kind === 'money') money(s, 100, 'Dev · grant');
    else if (kind === 'followers') s.values.followers += 50;
    else if (kind === 'deliver') { const m = this.arrivalMark(); deliverDue(s, this.content, { now: true }); this.announce(m); }
    else if (kind === 'hold') { this.devHoldClock(); return; }
    else if (kind === 'skip') { this.devSkip(60); return; }
    else if (kind === 'work') { if (s.agentWork) this.devSkip(Math.max(1, s.agentWork.at - gameMinutes(s))); return; }
    this.store.save(s); this.emit();
  }
  /** Dev: set a meter to an exact value (clamped). A new day delivers that day's events. */
  devSetMeter(id: MeterId, value: number): void {
    const s = this.state;
    if (!Number.isFinite(value)) return;
    if (id === 'day') { this.devGoToDay(value); return; }
    // the wallet goes through the ledger, so the Coinbin chart sees the jump
    if (id === 'crypto') money(s, Math.max(0, value) - s.values.crypto, 'Dev · adjustment');
    else setValue(s, id, value);
    this.store.save(s); this.emit();
  }
  /**
   * Dev: move straight to a day's morning, without running the nights in between (no payday, rent or
   * bills). The agent gets the level GeneralAI would have rolled out by then, and that day's events
   * arrive over the day.
   */
  devGoToDay(day: number): void {
    const s = this.state;
    if (!Number.isFinite(day)) return;
    setValue(s, 'day', day);
    const d = s.values.day;
    const level = Math.max(1, ...Object.entries(AGENT_ROLLOUT).filter(([k]) => Number(k) <= d).map(([, v]) => v));
    s.values.agentLevel = Math.max(s.values.agentLevel, level);
    s.postsToday = 0; s.sentToday = [];
    emptyMailBin(s);
    s.morning = null;
    s.clockMin = CLOCK.wake; // the day's mail and posts arrive over the day, as on a real morning
    s.arriving = (s.arriving ?? []).filter((x) => x.day <= d);
    const m = this.arrivalMark();
    spreadJobOffers(s, this.content);
    deliverArrivals(s, this.content);
    deliverDue(s, this.content);
    this.announce(m);
    this.store.save(s); this.emit();
  }
  /** Dev: stop or restart the clock. */
  devHoldClock(): void { this.clockHeld = !this.clockHeld; this.emit(); }
  /** Dev: jump the clock forward (to 22:00 at most, which ends the day). */
  devSkip(minutes: number): void { this.passMinutes(Math.min(minutes, CLOCK.sleep - this.state.clockMin)); }
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
/** How long after the agent's reply its charge hits the wallet. */
export const CHARGE_DELAY_MS = 2000;
/**
 * Take the prompt's charge (the agent-usage entries added since ledger entry `from`) back out of `s`
 * and return the amount, so it can be charged on its own a moment later.
 */
export function withholdCharge(s: GameState, from: number): number {
  let due = 0;
  const kept = s.tx.slice(0, from);
  for (const t of s.tx.slice(from)) {
    if (t.memo === AGENT_USAGE && t.amount < 0) { due -= t.amount; continue; }
    kept.push(due && t.bal != null ? { ...t, bal: Math.round((t.bal + due) * 100) / 100 } : t);
  }
  if (!due) return 0;
  s.tx = kept;
  addValue(s, 'crypto', due);
  return Math.round(due * 100) / 100;
}
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, Math.max(0, ms)));

/** deepsleep-0.5B's whole repertoire: one confident, absurd sentence in Chinese, whatever you ask. */
const DEEPSLEEP = DEEPSLEEP_LINES.map((l) => l.zh);
