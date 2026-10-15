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
}

export interface AppBreak {
  featureId: string;
  failure: FailureKind;
  day: number;
  scripted?: boolean;
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
  sentToday: string[]; // recipients emailed today (one-per-recipient rule)
  agentLocked: boolean;
  autofix: boolean;
  ending: string | null;
  endingShown: boolean;
  log: LogEntry[];
  nextAppNum: number;
}

export const SAVE_VERSION = 1;

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
    sentToday: [],
    agentLocked: false,
    autofix: false,
    ending: null,
    endingShown: false,
    log: [],
    nextAppNum: 1,
  };
}
