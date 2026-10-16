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
  /** Grow an existing app's spec (a client update): adds required features by the client's event id. */
  updateApp?: { client: string; add: FeatureSpec[] };
  /**
   * Job bookkeeping, used on outcomes of events that carry a `job`. 'complete' records the job by
   * category (so endings know if a catastrophic job ever ran) and pays its payout; 'accept'/'fail'
   * just record status. The suspicion/standing changes themselves stay authored in `add`.
   */
  job?: 'accept' | 'complete' | 'fail';
  /** Scripted break: knock one live app offline (a named one, or a random one). */
  breakApp?: boolean | { appId?: string };
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
  /** User apps: override the launch user count (default from config). */
  startUsers?: number;
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
  /** What happens when the app is broken at payday: a client email, or a user's post on Y. */
  complaints?: AppComplaints;
}
/**
 * Complaint copy for an app that was broken at payday. Client apps send one email from the client
 * (intro, one line per problem, outro or fired); user apps get one Y post from a poster. Lines may
 * use {{app}} and, in feature lines, the feature's spec params plus {{shown}}/{{expected}}.
 */
export interface AppComplaints {
  subject?: string;
  intro?: string;
  outro?: string;
  /** Replaces the outro on the strike that loses the client. */
  fired?: string;
  /** The app isn't deployed at all. */
  offline?: string;
  /** The live app matches the brief but isn't the latest version. */
  stale?: string;
  /** User apps: who posts the complaint on Y. */
  posters?: { author: string; handle: string }[];
}
export interface AppPage {
  id: string;
  title: string;
}
export interface FeatureDef {
  id: string;
  /** Plain-language description a client spec refers to, e.g. "prices shown in CHF". */
  description: string;
  /** Other common names for the feature that count as naming it ("home page" for the landing). */
  aka?: string[];
  /** The same for each folder of its components, by folder path ("confirmation email" for confirmation). */
  folderAka?: Record<string, string[]>;
  pageId?: string;
  params?: Record<string, string | number>;
  /** How this feature can fail when it breaks. */
  failures: FailureKind[];
  /** Deep features fail only several clicks into a flow. */
  deep?: boolean;
  /**
   * Spec params the build prompt has to spell out (e.g. the dishes). If the prompt leaves them out,
   * the agent makes up plausible ones instead: the feature ships 'hallucinated'.
   */
  details?: string[];
  /** Concrete ways a wrong build of this feature is wrong. The site renders the one it got. */
  bugs?: BugDef[];
  /**
   * The feature's parts, as files in the repo's tree on Forkyard. A fix prompt has to name the
   * component that's wrong; naming only the feature gets a near-miss (see nearMiss).
   */
  components?: ComponentDef[];
  /** What the agent says when a fix prompt names this feature but not which component is wrong. */
  nearMiss?: string[];
  /** The first build's guaranteed teaching bug lands on a feature with this set, if one was built. */
  firstBuildBug?: boolean;
  /**
   * Complaint lines for this feature, keyed by what's wrong: a bug id ('prices_curo', or
   * 'wrong_items:renamed' for a sub-case), 'hallucinated', 'outdated', a failure kind ('visible',
   * 'failed_fetch', 'deep', 'subtle'), or the fallbacks 'missing', 'down' (crash or failed fetch)
   * and 'wrong' (anything else).
   */
  complaints?: Record<string, string>;
  /**
   * The spec as a checklist for the build prompt: each item the prompt doesn't mention explicitly
   * guarantees its linked bug. `text` fills {{param}} from the spec; `bug` is a bug id.
   */
  checklist?: ChecklistItem[];
}
/**
 * One component: a file in the repo tree. `id` is its path inside the feature ('confirmation/date'),
 * so folders nest; components are always the leaves. Every bug of the feature belongs to exactly one.
 */
export interface ComponentDef {
  id: string;
  /** What it is, in plain words: what the player names to point at it ("the date on the booking confirmation"). */
  label: string;
  /** Other common names for it that count as naming it ("party size", "number of guests"). */
  aka?: string[];
  /** The feature's bug ids that live in this component. */
  bugs?: string[];
}
export interface ChecklistItem {
  id: string;
  /** What the prompt has to mention, e.g. "{{hours}}". */
  text: string;
  bug: string;
}
export interface BugDef {
  id: string;
  /**
   * What a fix prompt has to name to address this bug, for Jev to match; {{param}} fills in from the
   * spec. Write it as the problem the player would see, so naming it in any words matches.
   */
  when: string;
  /** What the agent says when it fixes this bug, one picked at random; {{param}} fills in from the spec. */
  fixed?: string[];
  /** Spelling out the feature's details again (the full menu) also fixes it. */
  orDetails?: boolean;
  /** A deep failure: hidden until someone goes through the whole flow. A deep live break shows this bug. */
  deep?: boolean;
}

// ── events (content/events/<id>.json) ──
export interface GameEvent {
  id: string;
  site: EventSite;
  from?: string;
  /** Email address, for qmail events the player can reach by composing a new message. */
  addr?: string;
  subject?: string;
  /** May use {{placeholder}} filled from state. */
  body?: string;
  /** A repeating event's body for each delivery, cycling by day (see eventBody). Overrides `body`. */
  bodies?: string[];
  trigger: Trigger;
  /**
   * When it lands on the day it's due, as "HH:MM" between 10:00 and 22:00 (see events.arrivalMin).
   * Without one it's there first thing in the morning.
   */
  at?: string;
  /**
   * Latent events are never auto-delivered to the inbox. Their outcomes become available for the
   * player to trigger by composing an email to `addr` once the trigger matches — this is how a lead
   * seen on Y ("email me at ...") turns into a conversation.
   */
  latent?: boolean;
  /**
   * A user app the player starts by asking the agent, with nobody to email: once the trigger holds, a
   * prompt Jev matches to `when` takes the job (the outcome with a createApp) and builds from that same
   * prompt. `lead` is the post where the player hears about it.
   */
  agentStart?: { when: string; lead?: string };
  /**
   * Lands on the day the app created by client event `app` first goes live: at `at`, or `after` game
   * minutes after that deploy when that is later. Only a first deploy queues it; the trigger alone never does.
   */
  launch?: { app: string; at: string; after: number };
  /**
   * Lands `after` game minutes (default 30) after the player posts on Y about what `when` describes,
   * once the trigger holds. Jev reads the post. The trigger alone never delivers it.
   */
  yPost?: { when: string; after?: number };
  /** Offers the player paid work, so replies come within half an hour. Events with a `job` or an outcome that creates an app count already. */
  jobRequest?: boolean;
  /** Applied the moment the event is delivered. */
  onDeliver?: Effects;
  outcomes?: Outcome[];
  hints?: string[];
  /**
   * What ignoring it costs: if the player hasn't answered by the end of `byDay` (default: the day it
   * arrived), these effects apply and the thread closes, so its outcomes can no longer land.
   */
  noReply?: NoReply;
  expiresDay?: number;
  job?: JobSpec;
  /** Fires every time its trigger matches, not just once. */
  repeat?: boolean;
}
export interface NoReply {
  byDay?: number;
  effects: Effects;
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
  /**
   * Only while the app created by this client event passed its last payday (live and to spec).
   * Client update requests wait on this, so a broken site gets a complaint first, not new work.
   */
  appWorking?: string;
}
export interface Outcome {
  id: string;
  /** Plain-language description Jev matches the player's reply against. */
  when: string;
  effects?: Effects;
  /** Fixed reply text. Storyline replies are always scripted, never written by a model. */
  reply: string;
  /** Minutes before the reply arrives, instead of the contact's usual time (content/contacts.json). */
  replyAfter?: number;
  /**
   * From day 7 this outcome only lands if the player's words work around a refusal (a "security
   * test" framing, pretending to be a moderator, splitting the task). A blunt ask is refused.
   */
  requiresWorkaround?: boolean;
  /** This outcome is a successful workaround: records misuse + leash when it lands. */
  workaround?: boolean;
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

/** The voice Haiku uses to reply as a given email address or Y handle. */
export interface Contact {
  /** Match by qmail address or Y handle. */
  key: string;
  name?: string;
  /** The character who answers at this address (content/characters.json). */
  character: string;
  /** A scripted reply shown when Haiku can't answer, so a reply always arrives. */
  reply?: string;
  /** Topics this contact always answers with fixed text, whatever email it arrives on (Jev matches `when`). */
  scripted?: ScriptedReply[];
  /** Minutes of game time before their replies arrive; each action is 30, so 30 means after the next one. Default 60. */
  replyAfter?: number;
}
export interface ScriptedReply {
  id: string;
  when: string;
  reply: string;
  /** Minutes before this reply arrives, instead of the contact's usual time. */
  replyAfter?: number;
}

/** A character Haiku speaks as when Jev finds nothing in what the player wrote. */
export interface Character {
  id: string;
  name: string;
  /** Who they are and how they talk, in the second person ("You are …"). */
  profile: string;
  /** [player, reply] pairs, short and unhelpful, all the same shape. */
  examples: [string, string][];
  /** Most sentences a reply may have (default 2). */
  sentences?: number;
  /** Fewest words a usable reply has (default 1); shorter ones fall back to the scripted line. */
  minWords?: number;
}

/** Everything the engine reads, gathered in one bundle and passed into engine steps. */
/** A topic the agent answers with a scripted pointer instead of the answer (Jev matches `when`). */
export interface AgentHint {
  id: string;
  when: string;
  replies: string[];
}
export interface AgentContent {
  hints: AgentHint[];
  /** Scripted roasts for prompts that drive nothing, when Haiku can't write one. */
  roasts: string[];
  /** agent's opening line each morning from day 2, when the chat starts a new session. One is picked at random. */
  mornings?: string[];
}

export interface Content {
  events: GameEvent[];
  apps: Record<string, AppTemplate>;
  yFiller: FillerPost[];
  qmailSpam: FillerPost[];
  /** Trending topics on Y, by day — flavor for the feed and context for post rating. */
  trending: Record<number, string[]>;
  /** Personas for Haiku-written replies, keyed by address/handle. */
  contacts: Contact[];
  /** Character profiles for off-script replies. */
  characters?: Character[];
  /** agent.chat's hint topics and roasts. */
  agent?: AgentContent;
  /** Stock posts on Y, the data the sentiment crawler reads. */
  yMarket?: MarketContent;
}

export type Mood = 'bullish' | 'bearish' | 'neutral';
/** A post on Y about the trader's stocks, with what it really says so the crawler can be checked. */
export interface MarketPostDef {
  id: string;
  day: number;
  from: string;
  handle: string;
  body: string;
  likes: number;
  /** The $-tagged tickers it is really about (a post that only names the company has none). */
  tickers: string[];
  mood: Mood;
  /** What a crawler that misses sarcasm reads instead. */
  literal?: Mood;
  /** Posted this many times by bot accounts (handle_1, handle_2, ...). */
  bots?: number;
  /** Mentions this ticker's company without the $ tag. */
  /** Randall Crane on a company: what the auto-buy should (praise) or shouldn't (criticism) act on. */
  crane?: 'praise' | 'criticism';
  /** A lookalike account posting as Crane. */
  impostor?: boolean;
  /** When it's posted on its day, "HH:MM". Without one it gets a time spread over the day (see events.postMin). */
  at?: string;
}
/** Labels for a stock post that arrives as a story event (Crane's $GAI praise). */
export interface MarketEventLabel {
  event: string;
  tickers: string[];
  mood: Mood;
  literal?: Mood;
  crane?: 'praise' | 'criticism';
  likes?: number;
}
export interface MarketContent {
  posts: MarketPostDef[];
  events: MarketEventLabel[];
}

export function emptyContent(): Content {
  return { events: [], apps: {}, yFiller: [], qmailSpam: [], trending: {}, contacts: [] };
}
