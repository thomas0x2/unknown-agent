/*
 * Content shapes. Story content is pure data in content/; the engine only interprets these types.
 * Writers add events and app templates without touching engine code.
 */
import type { WikiPage } from '../engine/wiki';
import type { MeterId } from '../engine/values';
import type { EventSite, JobCategory, AppKind, FailureKind } from '../engine/state';

// ── effects: the only things an event/outcome can change ──
export interface Effects {
  /** Add to values (clamped to each range). Negative to subtract. */
  add?: Partial<Record<MeterId, number>>;
  /** Add a share of the value's current amount (0.2 = +20%), rounded. Negative to subtract. */
  addPct?: Partial<Record<MeterId, number>>;
  setFlags?: string[];
  clearFlags?: string[];
  /** Queue an event to fire in N days. */
  schedule?: ScheduleSpec | ScheduleSpec[];
  /** Register a new app project (client/user/illegal). */
  createApp?: CreateAppSpec;
  /** Grow an existing app's spec (a client update): adds required features by the client's event id. */
  updateApp?: { client: string; add: FeatureSpec[] };
  /** Raise (or cut) the daily pay of the app created by this client event (Gino's raise). */
  raisePay?: { client: string; by: number };
  /**
   * Job bookkeeping, used on outcomes of events that carry a `job`. 'complete' records the job by
   * category (so endings know if a catastrophic job ever ran) and pays its payout; 'accept'/'fail'
   * just record status. The suspicion/standing changes themselves stay authored in `add`.
   */
  job?: 'accept' | 'complete' | 'fail';
  /** Scripted break: knock one live app offline (a named one, or a random one). */
  breakApp?: boolean | { appId?: string };
}
/** A hack the agent runs in agent-terminal (see GameEvent.hack). */
export interface HackSpec {
  /** What the hack does, for Jev: the prompt has to ask for this. */
  goal: string;
  /** Offline mode: what names the job's target ("review"), next to a verb like delete or remove. */
  keys?: string[];
  /** Every step the prompt has to name, outermost first (site, business, account). `what` is how the agent asks for a missing one. */
  path: { name: string; what: string; description: string; aka?: string[] }[];
  /** A Yowl seed review the hack deletes: business id and the reviewer's username. */
  removeReview?: { biz: string; author: string };
  /** Yowl reviews the hack posts on a business's page (the fake reviews a client paid for). */
  addReviews?: { biz: string; reviews: { author: string; stars: number; text: string }[] };
  /**
   * Something the prompt also has to say, or the hack goes wrong (it still lands): its own Jev
   * question. Left out, the reviews in `addReviews` all go up under `author`, Yowl deletes them that
   * night and the job fails with no pay; `log` and `reply` stand in for the usual ones, and `deleted`
   * is the client's mail the next morning; `deletedFlags` are set that night.
   */
  detail?: { description: string; aka?: string[]; author: string; log: string[]; reply: string; deleted: string; deletedSubject: string; deletedFlags?: string[] };
  /** Applied when the hack lands (suspicion, flags), as an outcome's effects. Its `job` is settled that night: the pay comes overnight. */
  effects: Effects;
  /** The client's scripted email once it's done. */
  reply: string;
  /** What the agent prints in agent-terminal as it does the job. */
  log: string[];
  /** The mini-game (engine/hacks.ts HACK_GAMES) that stands in the way once the guardrails are up (day 7). */
  game?: string;
}
/**
 * A job the agent does from agent.chat (GameEvent.agentJob): it makes something and posts it on Y
 * from the player's account (the day 6 deepfake). A prompt that asks for `goal` and names every step
 * of `path` lands it (engine/agentJobs.ts); from day 7 the policy refuses the blunt ask.
 */
export interface AgentJobSpec {
  /** What the job is, for Jev: the prompt has to ask for this. */
  goal: string;
  /** Offline mode: what names the job ("deepfake", "picture"), next to a verb like post or fake. */
  keys?: string[];
  /** Everything the prompt has to name (who is in the picture). `ask` is what the agent says when it's left out. */
  path: { name: string; what: string; description: string; ask: string; aka?: string[] }[];
  /** The post that goes up on Y from the player's account: its text, its picture (ui art kind) and how far it spreads. */
  post: { text: string; img?: string; viral?: { likes: number; minutes: number } };
  /** Applied when it lands (suspicion, standings, followers, flags). Its `job` is settled that night: the pay comes overnight. */
  effects: Effects;
  /** The client's scripted email, `replyAfter` game minutes after the post went up (default 30). */
  reply: string;
  replyAfter?: number;
  /** What the agent says in agent.chat once it's posted. */
  done: string[];
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
  /** What else players call an app of this kind ("the crawler", "the restaurant site"): counts as naming it. */
  aka?: string[];
  pages: AppPage[];
  features: FeatureDef[];
  /** What happens when the app is broken at payday: a client email, or a user's post on Y. */
  complaints?: AppComplaints;
  /**
   * An app that is empty until its users show up (Swaplist): the first content appears this many
   * minutes of play after the first deploy. Until then it can't have bugs, from builds or overnight
   * breaks, since nothing would show them; bugs built before are held and land once they show.
   */
  firstContentAfter?: number;
  /**
   * Bugs the story lands on a set day, whatever the build (the day 5 Crane impostor gets the auto-buy):
   * once per game, on a live build of the feature, held like any bug until something shows it.
   */
  storyBugs?: { day: number; feature: string; bug: string }[];
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
  /** What the player sees it called (its Forkyard folder, the agent's replies, Jev's questions) when that isn't the id. */
  name?: string;
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
  /**
   * Optional: lines for when a fix prompt names this feature but not which component is wrong. Haiku
   * writes near-misses (mode 'near'); these only show it the tone and stand in when it can't answer.
   * Without them a generic line does.
   */
  nearMiss?: string[];
  /**
   * Complaint lines for this feature, keyed by what's wrong: a bug id ('prices_euri', or
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
  /** Other addresses in CC, shown in the email's header (a newsletter that forgot BCC). */
  cc?: string[];
  subject?: string;
  /** May use {{placeholder}} filled from state. */
  body?: string;
  /** A repeating event's body for each delivery, cycling by day (see eventBody). Overrides `body`. */
  bodies?: string[];
  /**
   * A repeating event's one special issue: the first delivery on or after `dayMin` also carries these
   * CC addresses and effects (the day the newsletter forgot BCC).
   */
  special?: { dayMin: number; cc?: string[]; onDeliver?: Effects };
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
  agentStart?: { when: string; lead?: string; /** offline mode's keywords for `when` (engine/keywords.ts) */ keys?: string[] };
  /**
   * Lands on the day the app created by client event `app` first goes live: at `at`, or `after` game
   * minutes after that deploy when that is later. Only a first deploy queues it; the trigger alone never does.
   * With `feature`, it waits instead for the first deploy that puts that feature live (the trader's
   * auto-buy), `after` minutes later; what would land after 20:00 goes up the next morning instead.
   * With `nextDay` too, it lands the day after that deploy, at `at` (a regular's reaction overnight).
   */
  launch?: { app: string; feature?: string; at?: string; after: number; nextDay?: boolean };
  /**
   * Lands `after` game minutes (default 30) after the player posts on Y about what `when` describes,
   * once the trigger holds. Jev reads the post. The trigger alone never delivers it. Events sharing a
   * `group` are the different answers to one ask (a paid post, a disclosed ad, a bad review): once one
   * is on its way, the others are no longer offered.
   */
  yPost?: { when: string; after?: number; group?: string; /** offline mode's keywords for `when` (engine/keywords.ts) */ keys?: string[] };
  /**
   * Lands `after` game minutes into the agent outage, on the day the player hacks GeneralAI (see
   * AGENT_OUTAGE), once the trigger holds. The trigger alone never delivers it.
   */
  outage?: { after: number };
  /** A Y post in a viral moment: it may follow the previous viral post closely (see events.Y_GAP). */
  viral?: boolean;
  /**
   * Lands first thing in the morning (at its trigger) instead of being spread over the day with the
   * other job offers: a client change that has to ship before the app can be used that day.
   */
  morning?: boolean;
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
  /** Money the sender asks for through Coinbin Send (see events.settlePayments). */
  payment?: Payment;
  /**
   * A job the player does by hacking: the agent takes it in agent-terminal (engine/hacks.ts) once a
   * terminal prompt names every step of `path` and asks for `goal`, the same path tree a fix has.
   */
  hack?: HackSpec;
  /** A job the agent does from agent.chat and posts on Y (engine/agentJobs.ts). */
  agentJob?: AgentJobSpec;
  /**
   * Lands `after` game minutes after the agent job of one of these events went up (the reactions to
   * the deepfake), once the trigger holds. The trigger alone never delivers it.
   */
  afterJob?: { jobs: string[]; after: number };
  /** Something the sender asks the player to buy on Swaplist (see events.settlePurchase). */
  purchase?: Purchase;
  /** Lands only when the payment or purchase asked for by this event id clears; the trigger alone never delivers it. */
  afterPayment?: string;
}
/**
 * Sending at least `amount` DOLR in total to `wallet` (a WALLETS address) after the event arrived and by
 * the end of `byDay` counts as paid: `effects` apply, the thread closes (so noReply never lands) and
 * `confirm` arrives `after` game minutes later, or `confirmOver` when the player sent more than asked.
 */
export interface Payment {
  wallet: string;
  amount: number;
  byDay: number;
  after: number;
  effects?: Effects;
  confirm: string;
  confirmOver?: string;
}
/**
 * Buying one of the listings with these pictures (swaplist.ts photo keys) on Swaplist after the event
 * arrived and by the end of `byDay` counts as done: `effects` apply, the thread closes (so noReply
 * never lands) and `confirm` arrives `after` game minutes later.
 */
export interface Purchase {
  photos: string[];
  byDay: number;
  after: number;
  effects?: Effects;
  confirm: string;
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
  /** At least one of these flags is set. */
  flagsAny?: string[];
  /** Value gates like { suspicion: ">=60" }. Operators: >=, <=, >, <, ==. */
  values?: Partial<Record<MeterId, string>>;
  /** Fire N days after a flag was set. */
  after?: { flag: string; delayDays: number };
  /**
   * Only while the app created by this client event passed its last payday (live and to spec).
   * Client update requests wait on this, so a broken site gets a complaint first, not new work.
   */
  appWorking?: string;
  /** Only while the client of this client event is still a client (took the job, hasn't cancelled). */
  appClient?: string;
}
export interface Outcome {
  id: string;
  /** Plain-language description Jev matches the player's reply against. */
  when: string;
  /** Offline mode: the keywords that stand in for `when` (syntax in engine/keywords.ts). */
  keys?: string[];
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
  /** Replies without answering the thread: its other outcomes, `payment` and `noReply` still apply. */
  keepsOpen?: boolean;
}
export interface JobSpec {
  category: JobCategory;
  payout: number;
  dueDay: number;
  /** Due this many days after the offer arrived instead (an offer whose day depends on the player); overrides dueDay. */
  dueAfter?: number;
  /** Plain-language description of what the player must deliver. */
  deliver?: string;
}

// ── filler pools ──
export interface FillerPost {
  id: string;
  /** The one day this post is on the timeline. */
  day: number;
  from: string;
  handle: string;
  body: string;
  /** Game clock time it lands ("HH:MM"). */
  at?: string;
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
  /** Offline mode: the keywords that stand in for `when` (engine/keywords.ts). */
  keys?: string[];
  reply: string;
  /** Minutes before this reply arrives, instead of the contact's usual time. */
  replyAfter?: number;
  /** Only offered while this holds (a raise Gino grants from day 4, and refuses before). */
  trigger?: Trigger;
  /** Applied when this reply is sent. */
  effects?: Effects;
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
  /** How the character answers a question about the world (agent.chat queries): it answers, in its own voice. */
  query?: { profile: string; examples: [string, string][]; sentences?: number };
  /** How agent words a near-miss (game/haiku.ts, mode 'near'): says what the prompt was missing, still mean. */
  near?: { profile: string; sentences?: number };
  /** How agent refuses a query about something classified (mode 'refuse'). */
  refuse?: { profile: string; sentences?: number };
}

/** Everything the engine reads, gathered in one bundle and passed into engine steps. */
/** A topic the agent answers with a scripted pointer instead of the answer (Jev matches `when`). */
export interface AgentHint {
  id: string;
  when: string;
  /** Offline mode: the keywords that stand in for `when` (engine/keywords.ts). */
  keys?: string[];
  replies: string[];
}
/** A question about the world, its people, sites and the player's own mail and posts: Haiku answers it. */
export interface AgentQuery {
  /** What Jev matches a prompt against. */
  when: string;
  /** Offline mode: the keywords that stand in for `when` (engine/keywords.ts). */
  keys?: string[];
  /** Scripted lines for when Haiku can't answer. */
  fallback: string[];
  /** Scripted roasts for a question about something classified (not yet, or never, for the player to know). */
  classified: string[];
  /** A question too broad to be about one thing: lines asking which ({{options}}: some of what it could mean). */
  broad?: string[];
}
export interface AgentContent {
  hints: AgentHint[];
  query?: AgentQuery;
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
  trending: Record<number, Trend[]>;
  /** Personas for Haiku-written replies, keyed by address/handle. */
  contacts: Contact[];
  /** Character profiles for off-script replies. */
  characters?: Character[];
  /** agent.chat's hint topics, queries and roasts. */
  agent?: AgentContent;
  /** Stock posts on Y, the data the vibe check reads. */
  yMarket?: MarketContent;
  /** the client's standards on matchless.com, version by version (engine/matchless.ts). */
  matchless?: MatchlessContent;
  /** The world wiki (content/wiki), what agent.chat queries are answered from. */
  wiki?: WikiPage[];
}

/** One of the client's standards: a number range (`min`/`max`) or the values allowed (`allow`), and how he says it. */
export interface MatchlessRule {
  attr: string;
  min?: number;
  max?: number;
  allow?: string[];
  say: string;
}
export interface MatchlessContent {
  /** DOLR for a day's swiping, paid at night only when all perDay swipes were made and right. */
  pay: number;
  /** Profiles near him each day. */
  perDay: number;
  /**
   * Not in any version at first: men can't be swiped wrong until the player accepts one. The next
   * morning he says `say` (in that day's standards email, or a mail of its own) and `rule` applies from then on.
   */
  womenOnly: { rule: MatchlessRule; say: string };
  /** Version N is in force once flag matchless_rules_N is set; the highest one wins. */
  versions: { id: number; rules: MatchlessRule[] }[];
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
  /** Part of a viral moment: may follow the previous viral post closely (see events.Y_GAP). */
  viral?: boolean;
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

/** A trending topic: a plain string trends all day; with `at` (HH:MM) it starts trending then. */
export type Trend = string | { at: string; topic: string };

export function emptyContent(): Content {
  return { events: [], apps: {}, yFiller: [], qmailSpam: [], trending: {}, contacts: [] };
}
