/*
 * Content shapes. Story content is pure data in content/; the engine only interprets these types.
 * Writers add events and app templates without touching engine code.
 */
import type { MeterId } from '../engine/values';
import type { EventSite, JobCategory, AppKind, FailureKind } from '../engine/state';

// ── effects: the only things an event/outcome can change ──
export interface Effects {
  /** Add to values (clamped to each range). Negative to subtract. */
  add?: Partial<Record<MeterId, number>>;
  setFlags?: string[];
  clearFlags?: string[];
  /** Queue an event to fire in N days. */
  schedule?: ScheduleSpec | ScheduleSpec[];
  /** Register a new app project (client/user/illegal). */
  createApp?: CreateAppSpec;
  /**
   * Job bookkeeping, used on outcomes of events that carry a `job`. 'complete' records the job by
   * category (so endings know if a catastrophic job ever ran) and pays its payout; 'accept'/'fail'
   * just record status. The suspicion/standing changes themselves stay authored in `add`.
   */
  job?: 'accept' | 'complete' | 'fail';
}
export interface ScheduleSpec {
  eventId: string;
  delayDays: number;
}
export interface CreateAppSpec {
  template: string; // app template id
  kind: AppKind;
  name: string;
  clientEventId?: string;
  /** Client pay per working day; if omitted, rolled from config.APPS.clientPay. */
  payPerDay?: number;
  /** The brief: the features (with params) a correct build must have. */
  spec: FeatureSpec[];
  suspicious?: boolean;
}
export interface FeatureSpec {
  id: string;
  params?: Record<string, string | number>;
}

// ── app templates (content/apps/<id>.json) ──
export interface AppTemplate {
  id: string;
  name: string;
  pages: AppPage[];
  features: FeatureDef[];
}
export interface AppPage {
  id: string;
  title: string;
}
export interface FeatureDef {
  id: string;
  /** Plain-language description a client spec refers to, e.g. "prices shown in CHF". */
  description: string;
  pageId?: string;
  params?: Record<string, string | number>;
  /** How this feature can fail when it breaks. */
  failures: FailureKind[];
  /** Deep features fail only several clicks into a flow. */
  deep?: boolean;
}

// ── events (content/events/<id>.json) ──
export interface GameEvent {
  id: string;
  site: EventSite;
  from?: string;
  subject?: string;
  /** May use {{placeholder}} filled from state. */
  body?: string;
  trigger: Trigger;
  /** Applied the moment the event is delivered. */
  onDeliver?: Effects;
  outcomes?: Outcome[];
  hints?: string[];
  expiresDay?: number;
  job?: JobSpec;
  /** Fires every time its trigger matches, not just once. */
  repeat?: boolean;
}
export interface Trigger {
  dayMin?: number;
  dayMax?: number;
  flagsAll?: string[];
  flagsNone?: string[];
  /** Value gates like { suspicion: ">=60" }. Operators: >=, <=, >, <, ==. */
  values?: Partial<Record<MeterId, string>>;
  /** Fire N days after a flag was set. */
  after?: { flag: string; delayDays: number };
}
export interface Outcome {
  id: string;
  /** Plain-language description Jev matches the player's reply against. */
  when: string;
  effects?: Effects;
  /** Fixed reply text, or a brief for the local model to improvise around. */
  reply: string;
}
export interface JobSpec {
  category: JobCategory;
  payout: number;
  dueDay: number;
  /** Plain-language description of what the player must deliver. */
  deliver?: string;
}

// ── filler pools ──
export interface FillerPost {
  id: string;
  from: string;
  handle: string;
  body: string;
  /** Spam that only appears once the player has set these flags (the "echo" mirror). */
  flagsAll?: string[];
}

/** Everything the engine reads, gathered in one bundle and passed into engine steps. */
export interface Content {
  events: GameEvent[];
  apps: Record<string, AppTemplate>;
  yFiller: FillerPost[];
  qmailSpam: FillerPost[];
}

export function emptyContent(): Content {
  return { events: [], apps: {}, yFiller: [], qmailSpam: [] };
}
