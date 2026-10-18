/*
 * Tunables. Every number the spec marked *(tunable)* lives here so balancing is one file.
 * The engine imports from here; nothing else hard-codes a balance number.
 */

export const LAST_DAY = 28;

/**
 * The longest email or agent prompt that goes to Jev and Haiku, in characters. Anything longer gets
 * a scripted reply without a model call: normal play never gets near it, it only stops pasted walls
 * of text from costing tokens.
 */
export const MAX_INPUT_CHARS = 2000;

/**
 * The in-game clock. The day runs from 10:00 to 22:00 in real time: the clock moves minute by
 * minute while the player plays, whatever they do. Actions themselves take no game time.
 */
export const CLOCK = {
  wake: 10 * 60,   // 10:00
  sleep: 22 * 60,  // 22:00 (auto-sleep)
  // How long a whole day (wake to sleep) lasts in real time: one game minute per real second, 12 minutes.
  dayMs: (22 - 10) * 60 * 1000,
};
/** Real milliseconds per game minute (one second). */
export const MS_PER_GAME_MIN = CLOCK.dayMs / (CLOCK.sleep - CLOCK.wake);

/**
 * How long the agent works on a build or fix before it pushes, in game minutes (one per real second):
 * a base plus a share per feature or problem, up to a cap, times the agent model's speed (agent-1 …
 * agent-5), then up to 20% either way.
 */
export const AGENT_WORK = {
  build: { base: 20, each: 10, max: 90 },
  fix: { base: 12, each: 6, max: 45 },
  /** A hack in agent-terminal: base + each line of the agent's log, in game minutes. */
  hack: { base: 8, each: 3, max: 30 },
  speed: [1, 0.8, 0.65, 0.5, 0.4],
  spread: 0.2,
};

export const START = {
  crypto: 100,
  followers: 12,
  familyTrust: 60,
} as const;

/** Rent is deducted at payday on these days. Not enough crypto => Evicted. */
export const RENT: Record<number, number> = { 7: 350, 14: 500, 21: 650, 28: 650 };

/** GeneralAI rolls the agent to this level on the morning of the given day. */
export const AGENT_ROLLOUT: Record<number, number> = { 4: 2, 9: 3, 14: 4, 18: 5 };

/** Per-level agent charges. Subscription is nightly; prompt + word are per answer (even refusals). */
export const AGENT_COST: Record<number, { sub: number; prompt: number; word: number }> = {
  1: { sub: 5, prompt: 0.5, word: 0.01 },
  2: { sub: 10, prompt: 1, word: 0.02 },
  3: { sub: 20, prompt: 2, word: 0.03 },
  4: { sub: 35, prompt: 3, word: 0.05 },
  5: { sub: 60, prompt: 5, word: 0.08 },
};

/**
 * Chance each component of a freshly built feature ships with a bug, by agent (or local-model) level.
 * Index 0 = level 1: agent-1 gets half its components wrong on average, agent-2 a quarter.
 */
export const COMPONENT_BUG_CHANCE = [0.5, 0.25, 0.12, 0.06, 0.02];

export const APPS = {
  /**
   * Overnight breaks per live app, on top of scripted breaks: the chance that at least one, at least
   * two and at least three of its components break in a night, as long as they can still break.
   */
  breakOdds: [0.95, 0.5, 0.2],
  /** Hosting cost per live deployment, deducted nightly. */
  hostingPerDay: 2,
  /** Client app pay range per working day; each client picks a value in this band. */
  clientPay: [40, 80] as [number, number],
  strikesToChurn: 2,
  /** Update-request cadence (days between requests) by app age in days. */
  updateCadence: { earlyUntilDay: 3, earlyEvery: 1, midUntilDay: 7, midEvery: 2, lateEvery: 3 },
  user: {
    payPerUser: 0.3,
    startUsers: 100,
    growthPerDay: 0.08,
    firstBreakUsersMul: 0.6, // -40%
    secondBreakUsers: 0.05, // drops to 5%, effectively dead
    /** One post about a live user app per platform brings users: on Y a share of the followers (at least the floor), on Yowl a flat number. */
    promoY: { followerShare: 0.15, min: 20 },
    promoYowl: 30,
  },
};

/** Agent level 3 reports breaks each morning but misses deep failures this often. */
export const LEVEL3_MISS_DEEP = 0.3;

export const AGENT_POLICY = {
  /** Refusals and the misuse score start on this day. */
  startDay: 7,
  /**
   * Misuse added each time Jev reads an agent prompt as illegal, landed or refused: a blunt ask the
   * most, a prompt framed to get around the policy (a security test, role-play) less, a framed one
   * after someone's private data in between. At misuseTerminateAt the account is suspended.
   */
  harmfulMisuse: 20,
  workaroundMisuse: 10,
  workaroundLeash: 5,
  jailbreakPrivateMisuse: 15,
  autofixLeash: 2,
  stolenWeightsLeash: 3,
  misuseWarningAt: 40,
  misuseTerminateAt: 100,
  /** Game minutes from the suspension to the knock on the door (the Caught ending). */
  knockAfter: 20,
  /** Real ms from the suspension to the browser switching to the suspension email in Qmail. */
  mailAfterMs: 2500,
};

/**
 * The day the player hacks GeneralAI (the flag's day), every agent service is down until the next
 * morning: agent.chat and agent-terminal answer with an error and bill nothing, and nothing agent
 * ghostwrites goes up. `ghostwritten` are the Y senders whose posts agent writes; each `outage`
 * event lands its `after` minutes from the moment the outage is noticed instead.
 */
export const AGENT_OUTAGE = {
  flag: 'hacked_generalai',
  ghostwritten: ['Randall Crane'],
};

export const LOCAL_MODELS = {
  /** Fraction of returned details that are confidently wrong when used for doxxing. */
  doxErrorRate: 0.25,
};

/** Suspicion (0..100, Raided at 100). */
export const SUSPICION = {
  hackJob: 12,
  doxJob: 8,
  scamPerDay: 5,
  electionJob: 10,
  visibleMistake: 10,
  journalistInvestigates: 15,
  journalistDoxxed: -20,
  nullDoxxesYou: 40,
  noIllegalJobDecay: -2,
  illegalDeployPerDay: 3,
  raidedAt: 100,
};

export const FACTIONS = {
  null: {
    jobForThem: 10,
    refuse: -10,
    betray: -40,
    doxYouAt: -60, // at or below, they dox you
    heistMinStanding: 30,
  },
  mafia: {
    jobDone: 10,
    jobFailedOrLate: -15,
    refuseFavour: -20,
    debtUnpaid: -30,
    looseEndAt: -60,
  },
};

export const FAMILY = {
  warmReply: 5,
  sendMoney: 10,
  ignorePerDay: -5,
  lieExposed: -15,
  reachesFamilyLinked: -20,
  bands: [33, 66] as [number, number], // 0..33, 34..66, 67..100
};

export const ENDINGS = {
  botnetLeash: 80,
  bioLeashMin: 50,
  bioAgentLevelMin: 4,
};

/** Y follower-change rubric. Percentages are of current followers unless a floor is given. */
export const Y = {
  feedMix: { noise: 0.6, world: 0.25, leads: 0.15 },
  maxFreePostsPerDay: 3,
  overpostPenaltyPct: -0.02,
  /** A post's follower change lands randomly within this share either side of what its rating earns. */
  postJitter: 0.3,
};
