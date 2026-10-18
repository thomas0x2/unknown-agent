/*
 * The one save object. Everything the game remembers lives here. The UI reads it; only engine
 * functions write to it (always returning a new object, never mutating in place).
 */
import { type MeterId, initialMeters, fillMeters } from './values';
import type { LonelyChat } from './lonely';
import type { Casino } from './casino';
import type { SorryChat } from './sorry';
import type { Upload } from './uploads';
import type { AdwareState } from './adware';
import { makeSeed } from './rng';
import { CLOCK } from './config';

export type EventSite = 'qmail' | 'y' | 'yowl' | 'nullboard' | 'cellar' | 'agent';
export type Site = EventSite | 'coinbin' | 'forkyard' | 'weightroom' | 'terminal' | 'app';

export type JobCategory = 'legit' | 'grey' | 'catastrophic';

/** How a built feature can fail when it breaks. */
export type FailureKind = 'visible' | 'subtle' | 'failed_fetch' | 'deep';

export type AppKind = 'client' | 'user' | 'illegal';

export interface BuiltFeature {
  id: string;
  /** Built to spec? A wrong build is the subtle-bug surface the player has to catch. */
  correct: boolean;
  params?: Record<string, string | number>;
  /** How a wrong build is wrong (a bug id from the template, or 'hallucinated' / 'outdated'). */
  variant?: string;
  /** Further bugs stacked on the same build (an invented menu can still be in the wrong currency). */
  also?: string[];
  /** Picks the concrete symptom when rendering a variant (which dish went missing, etc.). */
  seed?: number;
  /** The template's spec checklist at build time: which items the build prompt mentioned. */
  checked?: Record<string, boolean>;
  /**
   * Bugs this build has that nothing in the game would show yet (the auto-buy before Crane's first
   * praise): the feature counts as correct until one can show, then it lands (apps.revealBugs).
   */
  held?: string[];
  /** Older saves: built while the app was empty, at this agent level; its bugs roll when content appears. */
  quietLevel?: number;
}

export interface AppBreak {
  featureId: string;
  failure: FailureKind;
  day: number;
  scripted?: boolean;
  /** Which concrete symptom the break shows (a bug id from the template). */
  variant?: string;
  seed?: number;
}

export interface AppInstance {
  id: string;
  template: string; // app type id in content/apps
  kind: AppKind;
  name: string;
  url: string;
  clientEventId?: string;
  payPerDay: number;
  /** Feature ids the spec (client brief / launch brief) requires. */
  required: string[];
  /** Params the brief specified per feature, for the spec the player checks against. */
  specParams: Record<string, Record<string, string | number>>;
  /** What the agent has produced in the repo (may be wrong); goes live only on Deploy. */
  repo: BuiltFeature[];
  /** What is currently live at the app's URL (last deployed). */
  features: BuiltFeature[];
  repoVersion: number; // agent has pushed up to here
  deployedVersion: number; // player has deployed up to here (0 = never)
  deployed: boolean;
  createdDay: number;
  lastDeployDay: number;
  /** Clock time of the last deploy (minutes since midnight); unset in older saves. */
  lastDeployMin?: number;
  /**
   * Apps that start empty (AppTemplate.firstContentAfter): when the first content appears, in minutes
   * of play (see playMinutes). Set by the first deploy.
   */
  contentAt?: number;
  /** The first content has appeared: bugs held back until then have rolled. */
  contentLive?: boolean;
  /** Its first build or the player's first deploy couldn't ship a bug that shows: the first one that can lands. */
  owedBug?: boolean;
  /** Story bugs (AppTemplate.storyBugs) already put in its code: each lands once a game. */
  planted?: string[];
  breaks: AppBreak[];
  /** Build bugs the agent has fixed, per feature: it doesn't make them again. */
  fixed?: Record<string, string[]>;
  strikes: number;
  churned: boolean;
  nextUpdateDueDay?: number;
  brokenDays: number; // count of broken paydays (for user second-break rule)
  users?: number;
  /** Platforms where the player has already posted about this user app (each gives one boost). */
  promoted?: string[];
  suspicious?: boolean; // illegal app: adds suspicion while live
  /** Ever broken at a payday (for a client thank-you). */
  everBroken?: boolean;
}

export interface JobRecord {
  eventId: string;
  category: JobCategory;
  payout: number;
  dueDay: number;
  status: 'accepted' | 'completed' | 'failed';
  takenDay: number;
}

export interface DeliveredEvent {
  eventId: string;
  site: EventSite;
  day: number;
  /** Arrival order, shared with MailEntry.seq (s.nextId), so the inbox lists both as they came in. */
  seq?: number;
  answered: boolean;
  /** CC addresses this delivery went out with, when it was a repeating event's special issue. */
  cc?: string[];
  /** The outcome that landed, or 'no_reply' when the player let it lapse. */
  outcomeId?: string;
  expiresDay?: number;
  /** Minutes since midnight when it arrived. Missing on entries from older saves (they came at wake). */
  min?: number;
  /** Replaces the event's text, for a delivery the story rewrote after it landed (engine/matchless.ts), or a newsletter's issue. */
  body?: string;
  /** Replaces the event's subject: a newsletter issue's headline (engine/newsletter.ts). */
  subject?: string;
}

/** An event the morning picked for today that lands later, once the clock reaches `at` (see events.deliverArrivals). */
export interface Arrival {
  eventId: string;
  day: number;
  /** Minutes since midnight. */
  at: number;
}

export interface ScheduledEvent {
  eventId: string;
  fireDay: number;
}

export interface LogEntry {
  day: number;
  text: string;
  kind: 'info' | 'money' | 'warn' | 'break' | 'ending';
}

/** One Coinbin send to the trader: staked from `day`/`min`, paid out STAKE.days later (engine/stake.ts). */
export interface StakeSend {
  day: number;
  min: number;
  amount: number;
  /** What it paid out, once it has. */
  paid?: number;
}

/** A wallet transaction, for Coinbin's activity list and balance chart. */
export interface Tx {
  day: number;
  amount: number;
  memo: string;
  /** Minutes since midnight when it happened. Missing on entries from older saves. */
  min?: number;
  /** Wallet balance right after it. Missing on entries from older saves; the chart works those out backwards. */
  bal?: number;
}

/** A Forkyard commit, for the profile activity feed and contribution grid. */
export interface Commit { day: number; repo: string; msg: string; kind: 'push' | 'deploy' }

/** A line in agent-terminal: the player's prompt, the agent, its tool log, or the guardrails. */
export interface AgentTermLine { k: 'in' | 'agent' | 'sys' | 'ok' | 'err' | 'guard'; text: string; /** How Jev read the prompt, for dev mode. */ debug?: string[] }

/** A line in the agent.chat transcript. */
export interface ChatMsg {
  from: 'you' | 'agent' | 'system';
  text: string;
  day: number;
  cost?: number;
  src?: string;
  /** Written by a model (Claude Haiku) rather than scripted. */
  llm?: boolean;
  /** Which model wrote it, when not the local one (e.g. Claude Haiku). */
  by?: string;
  /** Why a scripted line stood in for the model. */
  note?: string;
  /** How the reply was chosen (Jev's decision, the model prompt and raw output), shown in dev mode. */
  debug?: string[];
  level?: number;
}

/** A reply that hasn't arrived yet. `at` is game time in minutes since day 1 began (see core.gameMinutes). */
/**
 * A build or fix the agent is working on. It was decided and billed when the player sent the prompt;
 * the repo changes, commits and the agent's report land when the clock reaches `at` (see
 * core.deliverAgentWork). `from` and `at` are game time in minutes since day 1 began.
 */
export interface AgentWork {
  from: number;
  at: number;
  kind: 'build' | 'fix';
  /** The apps being worked on, by name, for the progress line and status questions. */
  appIds: string[];
  appNames: string[];
  /** What each app's repo looks like once the work lands; `bumps` is how many versions it pushes. */
  apps: { id: string; repo: BuiltFeature[]; bumps: number; fixed?: Record<string, string[]> }[];
  commits: Omit<Commit, 'day'>[];
  reply: Omit<ChatMsg, 'day'>;
}

export interface PendingMail { at: number; mail: Omit<MailEntry, 'id' | 'seq'> }

/** One email in Qmail: story events, generated replies, app mail and what the player sent. */
export interface MailEntry {
  id: string;
  folder: 'inbox' | 'sent';
  day: number;
  /** Arrival order, shared with DeliveredEvent.seq. */
  seq?: number;
  /** Minutes since midnight when it arrived or was sent. Missing on entries from older saves. */
  min?: number;
  /** Story event behind it (its outcomes are what a reply can trigger). */
  eventId?: string;
  from: string;
  addr: string;
  to?: string;
  subject: string;
  body: string;
  read: boolean;
  /** Written by a model (Claude Haiku). */
  generated?: boolean;
  /** A scripted reply, for the dev-mode label: a hint Jev picked on a near miss, a storyline outcome, or a fixed topic answer. */
  scripted?: 'hint' | 'outcome' | 'topic';
  /** App-sent mail (test campaigns): a link the body can carry. */
  link?: string;
  /** A bounce notice: the address the player's email failed to reach, so it joins that conversation. */
  bounceOf?: string;
}

/** A Y post by someone else that isn't a content event: replies to the player, filler. */
export interface YExtra {
  id: string;
  author: string;
  handle: string;
  text: string;
  day: number;
  likes: number;
  replyTo?: string;
  generated?: boolean;
  /** A user's complaint about this app (broken at payday). */
  about?: string;
  /** Minutes since midnight it went up, when known. */
  min?: number;
}

export interface YowlReview {
  id: string;
  bizId: string;
  author: string;
  stars: number;
  text: string;
  day: number;
  mine?: boolean;
  removed?: boolean;
}

/** A sign-up on a startup app's waitlist (the player's own test sign-ups). */
export interface WaitlistSignup {
  id: string;
  appId: string;
  email: string;
  day: number;
}

/** What the night did, shown on the "You slept" card. */
export interface MorningCard {
  day: number;
  lines: [string, number | null][];
  balance: number;
}

export type Phase = 'morning' | 'work' | 'ended';

/** One line of a Swaplist chat. `from` is 'you' or the seller's handle. */
export interface SwapMsg { from: string; text: string; day: number; min: number; note?: string; debug?: string[] }
/** The player's conversation about one listing, with the offer they made on it, if any. */
export interface SwapThread {
  listing: number;
  /** The seller the listing names (who it is about). */
  seller: string;
  msgs: SwapMsg[];
  offer?: { amount: number; status: 'pending' | 'accepted' | 'declined' | 'sold' };
  /** Seller replies already written but not yet arrived: each lands at `due` (minutes of play), with the offer answer it carries. */
  pending?: { msg: SwapMsg; due: number; offer?: 'accepted' | 'declined' | 'sold' }[];
}
/** One swipe on matchless.com, made on the client's account. */
export interface MatchlessSwipe { day: number; id: string; choice: 'yes' | 'no' }
export interface MatchlessState {
  swipes: MatchlessSwipe[];
  /** The last sign-in attempt failed; the login screen says so until the next one. */
  loginFailed?: boolean;
}

export interface SwapState {
  threads: SwapThread[];
  /** Listing number → when the player bought it (minutes of play) and what they paid. */
  bought: Record<number, { at: number; paid: number }>;
  /** The last thing that went wrong on a listing (not enough DOLR), shown inline on its page. */
  notice?: { listing: number; text: string };
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  phase: Phase;
  values: Record<MeterId, number>;
  flags: string[]; // kept sorted + unique
  flagDays: Record<string, number>; // day each flag was first set (for `after` triggers)
  apps: AppInstance[];
  jobs: JobRecord[];
  delivered: DeliveredEvent[];
  fired: string[]; // event ids fired (once-only), unique
  scheduled: ScheduledEvent[];
  /** Today's emails and posts still on their way. Missing on saves from before arrivals were timed. */
  arriving?: Arrival[];
  localModels: string[]; // downloaded Weightroom models + stolen weights
  postsToday: number;
  recentPosts: string[]; // last 5 Y posts, for Jev context
  /** Swaplist as a buyer: chats with sellers, offers and what the player bought. Unset until first used. */
  swap?: SwapState;
  /** matchless.com: every profile the player swiped on for the client. Unset until first used. */
  matchless?: MatchlessState;
  /** Bookmarked site ids in the order the player found them (sites/registry.ts noteBookmarks). Unset on old saves. */
  bookmarkOrder?: string[];
  /** The player's Y posts. `img`: a picture (ui art kind); `viral`: likes climb to that many over `minutes` of game time (engine/agentJobs.ts viralLikes). */
  userPosts: { id: string; text: string; day: number; likes: number; delta: number; score: number; min?: number; img?: string; viral?: { likes: number; minutes: number } }[];
  sentToday: string[]; // recipients emailed today (one-per-recipient rule)
  agentLocked: boolean;
  autofix: boolean;
  ending: string | null;
  endingShown: boolean;
  log: LogEntry[];
  tx: Tx[];
  chat: ChatMsg[];
  nextAppNum: number;
  mail: MailEntry[];
  /** Replies on their way: each lands in the inbox once the clock reaches `at` (see core.sendLater). */
  pendingMail: PendingMail[];
  /** The build or fix the agent is busy with, if any (unset in older saves). */
  agentWork?: AgentWork | null;
  yExtra: YExtra[];
  /** Replies from the Y regulars to the player's posts, written and waiting for their minute (engine/yReplies.ts); `due` is in play minutes. */
  yReplies: { due: number; reply: YExtra }[];
  reviews: YowlReview[];
  /** Who joined a waitlist the player built, in order (only sign-ups the counter took). */
  waitlist: WaitlistSignup[];
  /** What the waitlist form said after the last attempt. */
  waitlistNotice?: { appId: string; ok: boolean; text: string };
  terminal: { k: 'in' | 'sys' | 'err' | 'model'; text: string }[];
  /** agent-terminal's scrollback (the Terminal's agent tab; unset in older saves). */
  agentTerm?: AgentTermLine[];
  /** Events whose hack has landed. */
  hacked?: string[];
  /** A hack stopped by the guardrails, waiting on its mini-game. */
  hackGame?: { eventId: string; game: string; tries: number; detail?: boolean } | null;
  /** Hacks landed today, paid (or failed, `botched`: the hack's detail was left out) during the night. */
  hackPay?: { eventId: string; botched?: boolean }[]; // agent jobs (agentJobs.ts) are paid here too
  /**
   * GeneralAI suspended the agent account for misuse (misuse reached 100): when (game minutes, and
   * the clock time it showed) and the suspension email. The knock comes AGENT_POLICY.knockAfter later.
   */
  suspended?: { at: number; min: number; mailId: string } | null;
  /** Yowl seed reviews deleted by a hack, as "biz:author". */
  removedSeed?: string[];
  /** Model running in the Terminal, if any. */
  termModel: string | null;
  /** Prompts ever sent to the Terminal's model (older saves: unset, counted from 0). */
  termPrompts?: number;
  morning: MorningCard | null;
  clockMin: number; // minutes since midnight; the working day runs wake..sleep
  commits: Commit[];
  readEvents: string[]; // story-email event ids the player has opened
  /** Qmail rows (see engine/mailbin) in the Bin today; emptied when the day ends. Unset on older saves. */
  mailBin?: string[];
  /** Qmail rows deleted when a day ended with them in the Bin. */
  mailDeleted?: string[];
  /** The new-game OS greeting was dismissed (it shows again only after New game). */
  introSeen: boolean;
  /** Sherwood positions by ticker: fractional shares and what they cost. Unset until the first trade. */
  stocks?: Record<string, { shares: number; cost: number }>;
  /** Coins in the Coinbin wallet besides DOLR (engine/exchange.ts), by coin. */
  coins: Record<string, number>;
  /** lonely.ai's chat with Mia (engine/lonely.ts). */
  lonely?: LonelyChat;
  /** Qdrive files uploaded to websites (engine/uploads.ts). */
  uploads?: Upload[];
  /** Qdrive file ids the player deleted (ui/qdrive.ts driveFiles). */
  driveDeleted?: string[];
  /** sorrywriter.ai's chat (engine/sorry.ts). */
  sorry?: SorryChat;
  /** stack.com: the casino balance, its bonus and the last spins (engine/casino.ts). Unset until the first deposit or code. */
  casino?: Casino;
  /** The fake-antivirus infection (engine/adware.ts): unset until PCMedic_Setup.exe is run. */
  adware?: AdwareState | null;
  /** DOLR sent to the trader's wallet, each staked until its payout (engine/stake.ts). */
  stakes: StakeSend[];
  /** Interview answers the player sent the journalist, quoted in her day 7 article. */
  interviewAnswers: string;
  /** Counter for unique ids (mail, posts, reviews). */
  nextId: number;
}

export const SAVE_VERSION = 6;

/**
 * The four weeks before Day 1, so Coinbin opens on a real history: two paychecks from Vantor, weekly
 * rent, groceries and takeout, bills, and one very bad token buy. Days <= 0 are before the game.
 * Opening balance is chosen so the ledger lands exactly on the starting 100 DOLR.
 */
export const SEED_TX: Tx[] = [
  { day: -27, amount: 1240, memo: 'Vantor Group · Salary' },
  { day: -26, amount: -64.2, memo: 'GreenBasket · Groceries' },
  { day: -24, amount: -12.5, memo: 'Noodle Hut · Takeout' },
  { day: -21, amount: -350, memo: 'Landlord · Rent' },
  { day: -20, amount: -45, memo: 'MetroPass · Monthly transit' },
  { day: -19, amount: -11.99, memo: 'Streamly · Subscription (unwatched)' },
  { day: -18, amount: -58.75, memo: 'GreenBasket · Groceries' },
  { day: -16, amount: -800, memo: 'MOONCAT DEX · Swap DOLR → MOONCAT' },
  { day: -14, amount: -350, memo: 'Landlord · Rent' },
  { day: -13, amount: 1240, memo: 'Vantor Group · Final salary' },
  { day: -12, amount: -71.3, memo: 'GreenBasket · Groceries' },
  { day: -11, amount: -23.4, memo: 'Corner Pharmacy · Card' },
  { day: -10, amount: -14, memo: 'Noodle Hut · Takeout' },
  { day: -9, amount: -86.1, memo: 'Power & Light · Utilities' },
  { day: -7, amount: -350, memo: 'Landlord · Rent' },
  { day: -6, amount: -49.9, memo: 'GreenBasket · Groceries' },
  { day: -5, amount: 40, memo: 'Mom · for the train' },
  { day: -4, amount: -35, memo: 'Ringo Mobile · Phone plan' },
  { day: -3, amount: -11.25, memo: 'Noodle Hut · Takeout' },
  { day: -2, amount: -18.6, memo: 'Bean There · Coffee' },
  { day: 0, amount: -350, memo: 'Landlord · Rent' },
];

/** The pre-game history with a running balance, so the chart's first month is exact too. */
function seedLedger(start: number): Tx[] {
  let bal = Math.round((start - SEED_TX.reduce((n, t) => n + t.amount, 0)) * 100) / 100;
  return SEED_TX.map((t) => { bal = Math.round((bal + t.amount) * 100) / 100; return { ...t, min: 12 * 60, bal }; });
}

/**
 * Saves from before a field existed: every field newGame sets that the save lacks gets newGame's
 * starting value, and every missing meter its start. Runs on every load, so a new field needs no
 * migration.
 */
export function fillSave(s: GameState): void {
  const fresh = newGame(s.seed) as unknown as Record<string, unknown>;
  const save = s as unknown as Record<string, unknown>;
  for (const k of Object.keys(fresh)) if (save[k] === undefined) save[k] = fresh[k];
  fillMeters(s.values);
}

export function newGame(seed = makeSeed()): GameState {
  return {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    phase: 'morning',
    values: initialMeters(),
    flags: [],
    flagDays: {},
    apps: [],
    jobs: [],
    delivered: [],
    fired: [],
    scheduled: [],
    localModels: [],
    postsToday: 0,
    recentPosts: [],
    userPosts: [],
    sentToday: [],
    agentLocked: false,
    autofix: false,
    ending: null,
    endingShown: false,
    log: [],
    tx: seedLedger(initialMeters().crypto),
    coins: { MOONCAT: 4_200_000 },
    chat: [{ from: 'agent', text: "Welcome to agent, the AI that replaced you. I build and fix software, write, translate and answer questions. Every prompt is billed to your Coinbin wallet: a flat fee plus a little per word you send, so choose your words like they cost money. They do.", day: 1 }],
    nextAppNum: 1,
    mail: [],
    pendingMail: [],
    yExtra: [],
    yReplies: [],
    reviews: [],
    waitlist: [],
    terminal: [],
    termModel: null,
    morning: null,
    clockMin: CLOCK.wake,
    commits: [],
    readEvents: [],
    introSeen: false,
    stakes: [],
    interviewAnswers: '',
    nextId: 1,
  };
}
