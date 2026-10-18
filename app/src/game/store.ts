/*
 * The store: engine state + browser UI state (tabs, transient inputs). A tiny observable; main.ts
 * re-renders on change. All engine calls go through here, with Jev (decisions) and Haiku (wording)
 * injected into the pure engine functions.
 */
import {
  addFlag,
  addValue,
  advanceClock,
  AGENT_POLICY,
  AGENT_ROLLOUT,
  AGENT_USAGE,
  agentTermPrompt,
  applyCasinoCode,
  applyToWhyC,
  binMail,
  BOOT_MS,
  buyStock,
  chargeChat,
  clearFlag,
  CLOCK,
  clockTime,
  clone,
  closePopup,
  composeEmail,
  craneDonations,
  createToken,
  dateShort,
  deliverArrivals,
  deliverDue,
  deliverSwapReplies,
  deliverYReplies,
  deploy,
  devToggleBug,
  donateCrane,
  dropHackGame,
  emptyMailBin,
  endDay,
  exchangeCoins,
  EXE_RUN_LINES,
  EXE_RUN_STEPS,
  exeWorking,
  exeDone,
  fileRentAppeal,
  fillerToday,
  fillSave,
  gameMinutes,
  type GameState,
  hackMinutes,
  holdHiddenBugs,
  installAdware,
  JevOffline,
  type JevRouter,
  joinEmpire,
  joinWaitlist,
  localPrompt,
  lonelyReply,
  lonelySay,
  marketPosts,
  matchlessLogin,
  matchlessSwipe,
  type MeterId,
  money,
  MS_PER_GAME_MIN,
  nameUnnamedBugs,
  payStakes,
  phishLogin,
  postToY,
  promptAgent,
  READ_MS,
  recordDeposit,
  recordStake,
  replyToEvent,
  restoreMail,
  revealBugs,
  rewindArrivals,
  type SaveStore,
  seedClaim,
  sellStock,
  sendCrypto,
  settlePayments,
  setValue,
  sorryChat,
  sorryReply,
  sorrySay,
  sorryScripted,
  sorryTooLong,
  spinSlot,
  spreadJobOffers,
  startDayChat,
  startGame,
  swapBuy,
  swapMessage,
  swapOffer,
  takeDown,
  thirstrSubscribe,
  tickAdware,
  uploadFile,
  wakeApps,
  withdrawCasino,
  type Writer,
  writeReview,
} from '../engine';
import type { Content } from '../content/schema';
import { readSlot, writeSlot, type Slot } from './saves';
import { route, visitedFlag, setDevSites, noteBookmarks } from '../sites/registry';
import { adSite } from '../sites/adSites';
import { PULL_MS, pullLines } from './pull';
import { DEEPSLEEP_LINES, DEEPSLEEP_PLEA } from '../engine/deepsleep';
import { shellLines } from './shell';
import { MISSES } from './misses';
import { haikuApology } from './haiku';
import { freshUi, type Draft, type Ui } from './uiState';

/**
 * A browser tab. back/fwd are the pages behind and ahead of it, like a real browser's history. A
 * pinned tab always shows its site and can't be closed.
 */
export interface Tab { id: number; url: string; back: string[]; fwd: string[]; pinned?: string }
export type { Draft } from './uiState';

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
  /**
   * Actions the player took while an action that needs Jev was working on its own copy of the state
   * (a deploy while the agent types). That action's result replaces the state when it lands, so these
   * run again on it then; otherwise they'd be lost (a redeploy that didn't take).
   */
  private replay: ((s: GameState) => GameState)[] = [];
  /** The agent prompt being answered right now, shown in the chat as soon as it's sent. */
  pendingPrompt: string | null = null;
  /** A prompt's charge on its way to the wallet, a beat after the reply (0 when nothing is). */
  charging = 0;
  /** agent is looking a query up on the WWW (Haiku is writing the answer). */
  searching = false;
  setSearching(on: boolean): void { this.searching = on; this.emit(); }
  ui: Ui = freshUi();
  /** A model download playing out in the Terminal, if one is running. */
  pull: { id: string; startedAt: number } | null = null;
  /** agent-terminal is loading until this time (Date.now() ms): agent.chat shows its loading line, then the Terminal opens. */
  agentBootUntil = 0;
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
    fillSave(this.state); // saves from before a field or meter was added
    nameUnnamedBugs(this.state, content); // saves from before the app had named bugs
    holdHiddenBugs(this.state, content); // and from before bugs waited until they could show
    startDayChat(this.state, content); // saves from before the per-day reset may still carry yesterday's chat
    this.ui.intro = !this.state.introSeen;
    this.ui.greet = !this.state.introSeen; // a fresh game opens with the OS greeting
    applyDevMode(this.devMode);
  }

  subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(): void {
    if (this.state && noteBookmarks(this.state)) this.store.save(this.state);
    for (const fn of this.listeners) fn();
  }
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
    this.watchSuspension(s);
    const m = this.arrivalMark();
    this.keepTime(s); this.state = s; this.store.save(s); this.announce(m); this.emit();
  }
  /** Commit an action, then auto-sleep if the clock has reached bedtime (22:00). */
  private commitAndSettle(s: GameState): void {
    this.watchSuspension(s);
    const m = this.arrivalMark();
    this.keepTime(s);
    this.state = s;
    if (!s.ending && s.clockMin >= CLOCK.sleep) this.sleep(s);
    this.store.save(this.state); this.announce(m); this.emit();
  }

  /** GeneralAI just suspended the account for misuse: a moment later the browser switches to its email. */
  private watchSuspension(s: GameState): void {
    if (!s.suspended || this.state.suspended) return;
    const id = s.suspended.mailId;
    setTimeout(() => this.showSuspension(id), AGENT_POLICY.mailAfterMs);
  }
  private showSuspension(mailId: string): void {
    if (this.state.ending) return;
    const home = this.tabs.find((t) => t.pinned === 'qmail.com');
    if (home) this.active = home.id;
    this.ui.termShown = false;
    this.navigate(`qmail.com/${mailId}`);
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
    return !!(s.ending || s.morning || this.ui.jevOffline || this.ui.confirm || this.ui.memWarn || this.ui.greet || this.ui.intro || s.adware?.popup);
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
      this.revealTerm();
      return;
    }
    const m = this.arrivalMark();
    const working = s.agentWork;
    advanceClock(s, mins);
    this.revealTerm(); // agent-terminal's next lines, once their minute has come // the agent's build or fix lands here too, once its time has come
    if (s.ending) { this.store.save(s); this.announce(m); this.emit(); return; } // the knock after a suspension
    const shown = revealBugs(s, this.content); // held bugs land once something shows them (Crane's first praise)
    const paid = payStakes(s, this.content); // the trader's stake payouts, 12:00 four days after each send
    const woke = wakeApps(s, this.content).length > 0 || shown || paid; // an empty app's first content (and its bugs) once its time has come
    deliverArrivals(s, this.content); // emails and posts whose time has come
    const answered = deliverSwapReplies(s); // Swaplist sellers getting back to the player
    const replied = deliverYReplies(s); // the Y regulars answering the player's posts
    const popped = tickAdware(s); // an infected laptop's next ad pop-up, about once a game hour
    if (s.clockMin >= CLOCK.sleep) { this.sleep(s); this.store.save(this.state); this.announce(m); this.emit(); return; }
    if (this.announce(m) || s.agentWork !== working || woke || answered || replied || popped) { this.store.save(s); this.emit(); return; }
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
    if (u === 'localhost') { this.showTerm(true); return; }
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
    this.ui.adNotice = ''; this.ui.chatError = ''; this.ui.uploadError = ''; this.ui.stack = { error: '', notice: '' };
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
  /** Switch the Terminal's tab. */
  termTabTo(tab: 'shell' | 'agent'): void { if (this.ui.termTab !== tab) { this.ui.termTab = tab; this.emit(); } }
  /** The Terminal tabs the player has: the shell from day 1, agent-terminal once the agent opened it. */
  termTabs(): ('shell' | 'agent')[] {
    return ['shell', ...(this.state.flags.includes('has_agent_terminal') ? ['agent' as const] : [])];
  }
  /** The tab actually in front: the chosen one if the player has it, else the first they have. */
  termTabShown(): 'shell' | 'agent' { const t = this.termTabs(); return t.includes(this.ui.termTab) ? this.ui.termTab : t[0] ?? 'shell'; }
  /** agent-terminal is still loading (shown in agent.chat). */
  agentBooting(): boolean { return Date.now() < this.agentBootUntil; }
  /** The share of the load done, in steps (the loading line repaints at each). */
  static readonly BOOT_STEPS = 8;
  /**
   * After agent's reply to a hack attempt: a loading line in agent.chat, then agent-terminal opens.
   */
  launchAgentTerm(): void {
    this.agentBootUntil = Date.now() + BOOT_MS;
    for (let i = 1; i < GameStore.BOOT_STEPS; i++) setTimeout(() => this.emit(), (BOOT_MS / GameStore.BOOT_STEPS) * i + 10);
    setTimeout(() => { this.agentBootUntil = 0; this.openAgentTerm(); }, BOOT_MS);
    this.emit();
  }
  /** The Terminal comes forward on agent-terminal, ready for a prompt. */
  openAgentTerm(): void {
    const s = this.state;
    addFlag(s, 'has_agent_terminal');
    s.agentTerm = [...(s.agentTerm ?? []), { k: 'sys', text: `── session ${dateShort(s.values.day)}, ${clockTime(s.clockMin)} ──` }];
    this.store.save(s);
    this.ui.termOpen = true; this.ui.termShown = true; this.ui.termTab = 'agent';
    this.emit();
  }
  /** agent-terminal: the prompt just sent, shown under a spinner while Jev reads it. */
  termPending: string | null = null;
  /**
   * agent-terminal lines still to come: the last `at.length` lines of state.agentTerm, each shown once
   * the game clock reaches its minute. A landed hack plays out over its hackMinutes, like a build.
   */
  termReveal: { at: number[] } | null = null;
  /** The lines being revealed are a hack landing (the spinner says so). */
  termHack = false;
  /** How many of agent-terminal's last lines are still hidden. */
  termHidden(): number { return this.termReveal?.at.length ?? 0; }
  /** Show the agent-terminal lines whose minute has come. */
  private revealTerm(): void {
    const r = this.termReveal;
    if (!r) return;
    const now = gameMinutes(this.state);
    const left = r.at.filter((m) => m > now);
    if (left.length === r.at.length) return;
    this.termReveal = left.length ? { at: left } : null;
    this.emit();
  }
  /**
   * A prompt typed into agent-terminal, billed like any agent prompt. The prompt stays on screen with
   * a spinner while Jev reads it; then the agent's lines appear one after another over game time.
   */
  async agentTerm(text: string) {
    if (this.termReveal) return;
    this.termPending = text;
    return this.run(async (s0) => {
      try {
        const started = Date.now();
        const r = await agentTermPrompt(s0, this.content, this.router, text, this.writer);
        await wait(900 - (Date.now() - started));
        this.termPending = null;
        this.land(r.state);
        const n = r.lines.length;
        const now = gameMinutes(this.state);
        // a landed hack takes its time; anything else answers a line a minute
        const total = r.landed ? Math.max(n, hackMinutes(this.state.values.agentLevel, n)) : n;
        this.termHack = !!r.landed;
        if (n) this.termReveal = { at: r.lines.map((_, i) => now + Math.max(1, Math.round((total * (i + 1)) / n))) };
        return r;
      } finally { this.termPending = null; }
    }, 'aterm-input', text);
  }
  /** agent-terminal's own commands: 'clear' wipes the screen, 'exit' drops a blocked hack. Free. */
  agentTermCommand(cmd: 'clear' | 'exit'): void {
    if (cmd === 'clear') { this.termReveal = null; this.state.agentTerm = []; this.store.save(this.state); this.emit(); return; }
    this.commitAndSettle(dropHackGame(this.state));
  }

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
    fillSave(state);
    this.state = state;
    this.tabs = startTabs();
    this.active = HOME_TAB; this.nextTab = PINNED.length + 1;
    this.ui = { ...freshUi(), intro: false, dev: this.ui.dev, devOptions: this.ui.devOptions, devEdit: this.ui.devEdit, devTab: this.ui.devTab };
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
  deploy(appId: string): void { this.act((s) => deploy(s, appId, this.content)); }
  takeDown(appId: string): void { this.act((s) => takeDown(s, appId), false); }
  joinEmpire(): void { this.act((s) => joinEmpire(s)); }
  toggleSend(open = !this.ui.send.open): void { this.ui.send = { open, to: '', amount: '', error: '' }; this.ui.ex.open = false; this.ui.tok.open = false; this.ui.cbNotice = ''; this.emit(); }
  /** Coinbin Exchange's form: opening it closes Send; picking coins keeps the typed amount. */
  toggleExchange(open = !this.ui.ex.open): void { this.ui.ex = { ...this.ui.ex, open, amount: '', error: '' }; if (open) { this.ui.send.open = false; this.ui.tok.open = false; } this.ui.cbNotice = ''; this.emit(); }
  setExchange(part: 'from' | 'to', coin: string, amount: string): void {
    const ex = { ...this.ui.ex, [part]: coin, amount, error: '' };
    // picking the coin on the other side swaps the two
    if (ex.from === ex.to) { if (part === 'from') ex.to = this.ui.ex.from; else ex.from = this.ui.ex.to; }
    this.ui.ex = ex; this.emit();
  }
  /** Coinbin's Create token form: opening it closes the other forms. */
  toggleToken(open = !this.ui.tok.open): void { this.ui.tok = { open, ticker: '', supply: '', error: '' }; if (open) { this.ui.send.open = false; this.ui.ex.open = false; } this.ui.cbNotice = ''; this.emit(); }
  /** Creates $COPE at Dex's reserved address. A refusal keeps the form open with what was typed and the reason. */
  createToken(ticker: string, supply: string): boolean {
    const run = (s: GameState) => createToken(s, ticker, Number(supply.replace(/[,\s]/g, '')));
    const r = run(this.state);
    if (r.error) { this.ui.tok = { open: true, ticker, supply, error: r.error }; this.emit(); return false; }
    this.ui.tok = { open: false, ticker: '', supply: '', error: '' };
    this.ui.cbNotice = `Created $${ticker.trim().replace(/^\$/, '').toUpperCase()}. It trades from tomorrow.`;
    this.act((s) => (s === this.state ? r : run(s)).state);
    return true;
  }
  /** Coinbin Exchange. A refusal keeps the form open with what was typed and the reason. */
  exchange(amount: string): boolean {
    const { from, to } = this.ui.ex;
    const run = (s: GameState) => exchangeCoins(s, from, to, Number(amount.replace(/,/g, '')));
    const r = run(this.state);
    if (r.error) { this.ui.ex = { ...this.ui.ex, amount, error: r.error }; this.emit(); return false; }
    this.ui.ex = { ...this.ui.ex, open: false, amount: '', error: '' };
    this.ui.cbNotice = `Exchanged ${r.state.tx.at(-1)!.memo.split(' · ')[1]}.`;
    this.act((s) => (s === this.state ? r : run(s)).state);
    return true;
  }
  /** Coinbin Send. A refusal keeps the form open with what was typed and the reason. */
  send(to: string, amount: string): boolean {
    const sent = (s: GameState) => {
      const r = sendCrypto(s, to, Number(amount.replace(',', '.')));
      if (r.error) return r;
      settlePayments(r.state, this.content);
      recordStake(r.state, to, -r.state.tx.at(-1)!.amount);
      recordDeposit(r.state, to, -r.state.tx.at(-1)!.amount);
      return r;
    };
    const r = sent(this.state);
    if (r.error) { this.ui.send = { open: true, to, amount, error: r.error }; this.emit(); return false; }
    this.ui.send = { open: false, to: '', amount: '', error: '' };
    this.ui.cbNotice = `Sent ${(-r.state.tx.at(-1)!.amount).toFixed(2)} DOLR to ${r.state.tx.at(-1)!.memo.split(' · ')[0]}.`;
    this.act((s) => (s === this.state ? r : sent(s)).state);
    return true;
  }
  /** A Sherwood order: buy or sell `amount` DOLR of a ticker ('all' sells the whole position). */
  trade(ticker: string, side: 'buy' | 'sell', amount: string): boolean {
    const n = amount === 'all' ? 'all' : Number(amount.replace(',', '.'));
    const order = (s: GameState) => (side === 'buy' ? buyStock(s, ticker, n === 'all' ? NaN : n) : sellStock(s, ticker, n));
    const r = order(this.state);
    if (r.error) { this.ui.sw = { amount: amount === 'all' ? '' : amount, error: r.error, notice: '' }; this.emit(); return false; }
    const tx = r.state.tx.at(-1)!;
    this.ui.sw = { amount: '', error: '', notice: `${tx.memo.split(' · ')[1]} for ${Math.abs(tx.amount).toFixed(2)} DOLR.` };
    this.act((s) => (s === this.state ? r : order(s)).state);
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
  /** Apply to Why Combinator (whycombinator.com): free, and the rejection mail follows. */
  applyWhyC(): void {
    this.ui.adNotice = 'Application received. The decision will be sent to your Qmail.';
    this.commitAndSettle(applyToWhyC(this.state).state);
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
  /** thirstr.com: subscribe to a creator for 30 days, paid from Coinbin. */
  thirstrSubscribe(handle: string): void {
    const r = thirstrSubscribe(this.state, handle);
    this.ui.adNotice = r.error ?? '';
    if (r.error || r.state === this.state) { this.emit(); return; }
    this.commitAndSettle(r.state);
  }
  setStackNotice(text: string): void { this.ui.stack = { error: '', notice: text }; this.emit(); }
  /** stack.com: pick a bet. */
  stackPickBet(bet: number): void { this.ui.stackBet = bet; this.ui.stack.error = ''; this.emit(); }
  /** stack.com: one spin. The result is in at once; the reels show it when they stop. */
  stackSpin(): void {
    if (this.ui.stackSpinning) return;
    const bet = this.ui.stackBet;
    const r = spinSlot(this.state, bet);
    this.ui.stack = { error: r.error ?? '', notice: '' };
    if (r.error) { this.emit(); return; }
    this.ui.stackSpinning = true;
    this.act((s) => (s === this.state ? r : spinSlot(s, bet)).state);
    setTimeout(() => { this.ui.stackSpinning = false; this.emit(); }, 900);
  }
  /** stack.com: a creator code, before the first deposit. */
  stackCode(code: string): boolean {
    const r = applyCasinoCode(this.state, code);
    this.ui.stack = { error: r.error ?? '', notice: r.error ? '' : `Code ${code.trim().toUpperCase()} added. Your first deposit is matched.` };
    if (r.error) { this.emit(); return false; }
    this.act(() => r.state);
    return true;
  }
  /** stack.com: send DOLR back to Coinbin. */
  stackWithdraw(amount: string): boolean {
    const n = Number(amount.replace(',', '.'));
    const r = withdrawCasino(this.state, n);
    this.ui.stack = { error: r.error ?? '', notice: r.error ? '' : `${n.toFixed(2)} DOLR sent to your Coinbin wallet.` };
    if (r.error) { this.emit(); return false; }
    this.act((s) => (s === this.state ? r : withdrawCasino(s, n)).state);
    return true;
  }
  /** Delete a Qdrive file for good. A deleted model's weights are gone from the Terminal too. */
  deleteDriveFile(id: string): void {
    const s = this.state;
    const gone = (s.driveDeleted ??= []);
    if (!gone.includes(id)) gone.push(id);
    if (id.startsWith('model-')) {
      const m = id.slice(6);
      s.localModels = s.localModels.filter((x) => x !== m);
      if (s.termModel === m) s.termModel = null;
    }
    const folder = id.startsWith('model-') ? 'models' : 'documents';
    this.store.save(s);
    this.navigate(`qdrive.com/${folder}`);
  }
  /** A file saved again comes back after being deleted. */
  private undelete(s: GameState, id: string): void { if (s.driveDeleted) s.driveDeleted = s.driveDeleted.filter((x) => x !== id); }
  /** pcmedic.live: save the "cleaner" to Qdrive (it shows up as PCMedic_Setup.exe). */
  downloadCleaner(): void {
    const s = this.state;
    this.undelete(s, 'pcmedic');
    if (!s.flags.includes('adware_downloaded')) addFlag(s, 'adware_downloaded');
    this.ui.adNotice = 'PCMedic_Setup.exe saved to your Qdrive. Open it to run the cleaner.';
    this.store.save(s); this.emit();
  }
  /** Run PCMedic_Setup.exe in the you@laptop shell: it plays out like a loader, then the laptop is
   *  infected and the pop-ups begin. installAdware runs up front, so a second click just reopens. */
  runExe(): void {
    const s = this.state;
    if (s.adware) { this.showTerm(true); return; }
    if (!s.flags.includes('has_terminal')) addFlag(s, 'has_terminal'); // the exe gives the player the shell
    installAdware(s);
    this.ui.termOpen = true; this.ui.termShown = true; this.ui.termTab = 'shell';
    this.store.save(s); this.emit();
    void this.playExe();
  }
  /** Reveal the exe's output one line at a time, a work line landing its "done" a beat after it shows;
   *  with motion off (tests/SSR) the finished lines go up at once. */
  private async playExe(): Promise<void> {
    if (!motion()) { this.state.terminal.push(...EXE_RUN_LINES); this.store.save(this.state); this.emit(); return; }
    for (const st of EXE_RUN_STEPS) {
      const line = { k: st.k, text: exeWorking(st) };
      this.state.terminal.push(line);
      this.emit();
      await wait(st.k === 'in' ? 240 : 420);
      if (st.work) { line.text = exeDone(st); this.emit(); await wait(300); }
    }
    this.store.save(this.state); this.emit();
  }
  /** Dismiss the current OS ad pop-up; the next one is scheduled about an hour out. */
  closeAdPopup(): void { closePopup(this.state); this.store.save(this.state); this.emit(); }

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
  /** The waitlist form on a startup app. */
  joinWaitlist(appId: string, email: string): void {
    this.act((s) => joinWaitlist(s, appId, email, this.content));
  }

  /**
   * Runs an action that needs Jev. If Jev can't be reached, nothing happened (the engine works on a
   * copy), so the state stays as it was and a dialog says so; the text goes back into `field`.
   */
  private async run<T>(fn: (s0: GameState) => Promise<T>, field?: string, text?: string): Promise<T | undefined> {
    this.busy = true; this.replay = []; this.ui.jevOffline = null; this.emit();
    // the action works on the state as it is now; what the player does meanwhile is replayed on its result (land)
    try { return await fn(this.state); }
    catch (e) {
      if (!(e instanceof JevOffline)) throw e;
      this.ui.jevOffline = { reason: e.reason, field, text };
      return undefined;
    }
    finally { this.busy = false; this.replay = []; this.emit(); }
  }
  /** A player action that doesn't wait on anything: it lands now, and again on a running action's result. */
  private act(fn: (s: GameState) => GameState, settle = true): void {
    if (this.busy) this.replay.push(fn);
    const s = fn(this.state);
    if (settle) this.commitAndSettle(s); else this.commit(s);
  }
  /** A running action's result lands: what the player did meanwhile goes on top of it. */
  private land(s: GameState): void {
    this.keepTime(s);
    const done = this.replay;
    this.replay = [];
    this.commitAndSettle(done.reduce((x, fn) => fn(x), s));
  }
  dismissJevOffline(): void { this.ui.jevOffline = null; this.emit(); }

  async post(text: string, trending: string[]) {
    return this.run(async (s0) => { const r = await postToY(s0, this.router, text, trending, this.content, this.writer); this.land(r.state); return r; }, 'post-input', text);
  }
  async reply(eventId: string, text: string) {
    return this.run(async (s0) => { const r = await replyToEvent(s0, this.content, this.router, eventId, text, this.writer); this.land(r.state); return r; }, 'reply-body', text);
  }
  /** `field` is the reply box when it's a reply to a thread; the compose form keeps its text until it's sent. */
  async compose(to: string, subject: string, text: string, field?: string) {
    return this.run(async (s0) => { const r = await composeEmail(s0, this.content, this.router, to, text, this.writer, subject); this.land(r.state); return r; }, field, text);
  }
  /** Swaplist: message the seller of a listing; the reply is written in their character. */
  async swapMessage(n: number, text: string) {
    return this.run(async (s0) => { const r = await swapMessage(s0, this.content, this.writer, n, text); this.land(r.state); return r; }, 'sl-msg', text);
  }
  /** Swaplist: offer an amount on a listing, or buy it (an accepted offer's amount, else the shown price). */
  async swapOffer(n: number, amount: number) {
    return this.run(async (s0) => { this.land(await swapOffer(s0, this.content, this.writer, n, amount)); });
  }
  async swapBuy(n: number) {
    return this.run(async (s0) => { this.land(await swapBuy(s0, this.content, this.writer, n)); });
  }
  /** matchless.com: accept or reject the current profile on the client's account. */
  matchlessSwipe(choice: 'yes' | 'no'): void { this.act((s) => matchlessSwipe(s, this.content, choice), false); }
  matchlessLogin(user: string, pass: string): void { this.act((s) => matchlessLogin(s, user, pass), false); }
  /** The agent is always free-text promptable. Jev routes it to a build/fix or an ordinary reply. */
  async prompt(text: string) {
    this.pendingPrompt = text;
    return this.run(async (s0) => {
      try {
        const started = Date.now();
        const txBefore = s0.tx.length;
        const r = await promptAgent(s0, this.content, this.router, text, this.writer);
        // Scripted replies come back instantly; hold them behind the typing dots like a generated one.
        const last = r.state.chat[r.state.chat.length - 1];
        if (last && last.from === 'agent' && last.src !== 'llm') await wait(replyDelay(last.text) - (Date.now() - started));
        // the reply lands first and the wallet is charged a beat later, so each makes its own sound
        const due = r.state.clockMin < CLOCK.sleep ? withholdCharge(r.state, txBefore) : 0;
        this.pendingPrompt = null; this.charging = due; this.land(r.state);
        // a hack attempt: the player reads agent's reply, agent-terminal loads in the chat, then it opens
        if (r.terminal) setTimeout(() => this.launchAgentTerm(), READ_MS);
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
    return this.run(async (s0) => { const r = await writeReview(s0, this.content, this.router, bizId, stars, text); this.ui.reviewStars = 0; this.land(r.state); return r; });
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
    this.undelete(s, 'model-' + id);
    if (!s.flags.includes('knows_weightroom')) { s.flags.push('knows_weightroom'); s.flags.sort(); }
    if (!s.flags.includes('has_terminal')) { s.flags.push('has_terminal'); s.flags.sort(); }
    s.termModel = id;
    s.terminal.push(...pullLines(id, PULL_MS));
    this.commitAndSettle(s);
  }
  /** invaders.exe closed: its last line goes in the shell's scrollback. */
  endInvaders(lines: string[]): void {
    this.ui.invaders = false;
    this.state.terminal.push(...lines.map((text) => ({ k: 'sys' as const, text })));
    this.store.save(this.state); this.emit();
  }
  termClear(): void { this.state.terminal = []; this.store.save(this.state); this.emit(); }

  devAdd(kind: string): void {
    const s = this.state;
    if (kind === 'money') money(s, 100, 'Dev · grant');
    else if (kind === 'followers') s.values.followers += 50;
    else if (kind === 'deliver') { const m = this.arrivalMark(); deliverDue(s, this.content, { now: true }); this.announce(m); }
    else if (kind === 'hold') { this.devHoldClock(); return; }
    else if (kind === 'skip') { this.devSkip(60); return; }
    else if (kind === 'rewind') { this.devGoToDay(s.values.day); return; }
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
   * arrive over the day. Going back (or redoing today) takes back everything that arrived from that day
   * on, so it all arrives again.
   */
  devGoToDay(day: number): void {
    const s = this.state;
    if (!Number.isFinite(day)) return;
    const was = s.values.day;
    setValue(s, 'day', day);
    const d = s.values.day;
    if (d <= was) rewindArrivals(s, this.content, d); // back to an earlier day: its mail and posts come again
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
    // the shell's own commands (help, ls, cd, run…), and everything once there is no model to ask
    const own = shellLines(text, !!this.state.termModel, this.state, this.ui.termCwd);
    if (own) {
      this.state.terminal.push(...own.lines);
      if (own.cwd) this.ui.termCwd = own.cwd;
      if (own.run === 'pcmedic') { this.runExe(); return; }
      if (own.run === 'invaders') this.ui.invaders = true;
      this.store.save(this.state); this.emit(); return;
    }
    return this.run(async (s0) => {
      // a 0.5B model on this laptop: free, but it makes you wait
      const r = await localPrompt(s0, text, DEEPSLEEP, DEEPSLEEP_PLEA.zh);
      await wait(1500 + Math.random() * 1500);
      this.land(r.state); return r;
    });
  }
}

const DEV_KEY = 'unknown-agent-dev';
function readDevMode(): boolean {
  try { return localStorage.getItem(DEV_KEY) !== '0'; } catch { return true; }
}
function applyDevMode(on: boolean): void {
  setDevSites(on);
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
/** Off outside a browser (tests) and for players who asked for less motion, like the chat streamer. */
const motion = () => typeof document !== 'undefined' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** deepsleep-0.5B's whole repertoire: one confident, absurd sentence in Chinese, whatever you ask. */
const DEEPSLEEP = DEEPSLEEP_LINES.map((l) => l.zh);
