/*
 * The one save object. Everything the game remembers lives here. The UI reads it; only engine
 * functions write to it (always returning a new object, never mutating in place).
 */
import { type MeterId, initialMeters } from './values';
import { makeSeed } from './rng';
import { CLOCK } from './config';

export type EventSite = 'qmail' | 'y' | 'yowl' | 'nullboard' | 'cellar' | 'agent';
export type Site = EventSite | 'satchel' | 'forkyard' | 'weightroom' | 'terminal' | 'app';

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
  breaks: AppBreak[];
  strikes: number;
  churned: boolean;
  nextUpdateDueDay?: number;
  brokenDays: number; // count of broken paydays (for user second-break rule)
  users?: number;
  suspicious?: boolean; // illegal app: adds suspicion while live
  /** Ever broken at a payday (for the restaurant thank-you). */
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
  outcomeId?: string;
  expiresDay?: number;
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

/** A wallet transaction, for Satchel's activity list and balance chart. */
export interface Tx {
  day: number;
  amount: number;
  memo: string;
}

/** A Forkyard commit, for the profile activity feed and contribution grid. */
export interface Commit { day: number; repo: string; msg: string; kind: 'push' | 'deploy' }

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

/** One email in Qmail: story events, generated replies, app mail and what the player sent. */
export interface MailEntry {
  id: string;
  folder: 'inbox' | 'sent';
  day: number;
  /** Arrival order, shared with DeliveredEvent.seq. */
  seq?: number;
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
  /** App-sent mail (booking confirmations, test campaigns): a link the body can carry. */
  link?: string;
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
  /** A user's complaint about this app (broken at payday); shown at the top of its day. */
  about?: string;
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

/** A table booking made on a restaurant app (the player's own test bookings). */
export interface Booking {
  id: string;
  appId: string;
  name: string;
  email: string;
  date: number; // game day
  time: string;
  party: number;
  cancelled: boolean;
  /** The cancel link only pretends to work (a bug). */
  fakeCancel?: boolean;
}

/** What the night did, shown on the "You slept" card. */
export interface MorningCard {
  day: number;
  lines: [string, number | null][];
  balance: number;
}

export type Phase = 'morning' | 'work' | 'ended';

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
  localModels: string[]; // downloaded Weightroom models + stolen weights
  postsToday: number;
  recentPosts: string[]; // last 5 Y posts, for Jev context
  userPosts: { id: string; text: string; day: number; likes: number; delta: number; score: number }[];
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
  /** Addresses the player wrote to that haven't replied yet (one message per person until they do). */
  awaiting: string[];
  yExtra: YExtra[];
  reviews: YowlReview[];
  bookings: Booking[];
  terminal: { k: 'in' | 'sys' | 'err' | 'model'; text: string }[];
  /** Model running in the Terminal, if any. */
  termModel: string | null;
  morning: MorningCard | null;
  clockMin: number; // minutes since midnight; the working day runs wake..sleep
  commits: Commit[];
  readEvents: string[]; // story-email event ids the player has opened
  introSeen: boolean;
  /** Trader buy-in stake value (0 = none). */
  stake: number;
  /** Interview answers the player sent the journalist, quoted in her day 7 article. */
  interviewAnswers: string;
  /** Counter for unique ids (mail, posts, reviews). */
  nextId: number;
}

export const SAVE_VERSION = 6;

/**
 * The four weeks before Day 1, so Satchel opens on a real history: two paychecks from Vantor, weekly
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
    tx: SEED_TX.map((t) => ({ ...t })),
    chat: [{ from: 'agent', text: "Welcome to agent, the AI that replaced you. I build and fix software, write, translate and answer questions. Every prompt is billed to your Satchel wallet: a flat fee plus a little per word you send, so choose your words like they cost money. They do.", day: 1 }],
    nextAppNum: 1,
    mail: [],
    awaiting: [],
    yExtra: [],
    reviews: [],
    bookings: [],
    terminal: [],
    termModel: null,
    morning: null,
    clockMin: CLOCK.wake,
    commits: [],
    readEvents: [],
    introSeen: false,
    stake: 0,
    interviewAnswers: '',
    nextId: 1,
  };
}
