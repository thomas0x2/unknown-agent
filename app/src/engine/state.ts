/*
 * The one save object. Everything the game remembers lives here. The UI reads it; only engine
 * functions write to it (always returning a new object, never mutating in place).
 */
import { type MeterId, initialMeters } from './values';
import { makeSeed } from './rng';

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
}

export interface AppBreak {
  featureId: string;
  failure: FailureKind;
  day: number;
  scripted?: boolean;
  /** Which concrete symptom the break shows (a bug id from the template). */
  variant?: string;
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

/** A line in the agent.chat transcript. */
export interface ChatMsg {
  from: 'you' | 'agent' | 'system';
  text: string;
  day: number;
  cost?: number;
  src?: string;
  /** Written by the local model (Gemma) rather than scripted. */
  llm?: boolean;
  level?: number;
}

/** One email in Qmail: story events, generated replies, app mail and what the player sent. */
export interface MailEntry {
  id: string;
  folder: 'inbox' | 'sent';
  day: number;
  /** Story event behind it (its outcomes are what a reply can trigger). */
  eventId?: string;
  from: string;
  addr: string;
  to?: string;
  subject: string;
  body: string;
  read: boolean;
  /** Written by the local model. */
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
  introSeen: boolean;
  /** Trader buy-in stake value (0 = none). */
  stake: number;
  /** Interview answers the player sent the journalist, quoted in her day 7 article. */
  interviewAnswers: string;
  /** Counter for unique ids (mail, posts, reviews). */
  nextId: number;
}

export const SAVE_VERSION = 3;

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
    tx: [],
    chat: [{ from: 'agent', text: "Hi, I'm agent. I build and fix software, write, translate and answer questions. Every prompt is billed to your Satchel wallet: a flat fee plus a little per word I write back. Ask me anything.", day: 1 }],
    nextAppNum: 1,
    mail: [],
    awaiting: [],
    yExtra: [],
    reviews: [],
    bookings: [],
    terminal: [],
    termModel: null,
    morning: null,
    introSeen: false,
    stake: 0,
    interviewAnswers: '',
    nextId: 1,
  };
}
