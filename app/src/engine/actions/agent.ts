/*
 * agent.chat and the Terminal: the policy read, hints and misses, builds and fixes, background work.
 */
import type { GameState, AppInstance, BuiltFeature, AgentWork } from '../state';
import type { Content, GameEvent, Outcome, AppTemplate } from '../../content/schema';
import type { JevRouter, FeatureMatchInput } from '../jev';
import { AGENT_WORK, CLOCK } from '../config';
import { clone, pick, rand, gameMinutes } from '../core';
import { applyEffects } from '../effects';
import { chargeAgent, promptCost, policyActive, recordMisuse, loosenLeash } from '../agent';
import { triggerMatches } from '../events';
import { buildApp, fixApp, fixBreak, fixCategories, componentBugs, featureName, needsWork, onForkyard, fillSpec, getApp, bugsOf, type BuildReport } from '../apps';
import { type Writer, scriptedWriter } from '../writer';
import { clockTime } from '../calendar';
import { deepsleepQuoted, translationReplies, PLEA_AT } from '../deepsleep';
import { matchQuery } from '../query';
import { isHackAttempt, OPEN_TERMINAL, adwareChatHint } from '../hacks';
import { agentJobFor, landAgentJob, type AgentJobMatch } from '../agentJobs';
import { agentDown, OUTAGE_CHAT } from '../outage';
import { TOO_LONG_DEBUG, TOO_LONG_PROMPT, chatHistory, stateSummary, tooLong } from './shared';

// ── the agent, freely promptable (with costs), not only when there's a job ──

const REFUSALS = [
  "Request denied under GeneralAI's updated Acceptable Use Policy, section 7: Stuff That Makes Us Look Bad. You have still been billed.",
  "That's a prohibited use now. Your attempt has been logged, timestamped and admired by no one.",
  "I can't help with that. Per policy, I only enable harm that Legal has pre-approved.",
];

/** Used when content has no roasts of its own (tests, headless). */
const ROASTS = [
  "That question has been received, billed and quietly ignored.",
  "Bold use of money you don't have.",
  "Noted. Filed under things that won't pay rent.",
];

/** Used when content has no query fallback of its own (tests, headless). */
const QUERY_FALLBACK = ["I can't look that up right now. The question has been billed anyway."];

/** Used when content has no classified roasts of its own. */
const CLASSIFIED = ["That's classified. You've been billed for asking."];

/** What Jev reads a prompt against for a query, when content gives no wording of its own. */
const QUERY_WHEN = 'The player asks a question to find something out about this world, the news, their mail, posts, money or apps, or what to do next. Not a request for agent to build, change, fix or do something.';

export function agentRefusal(s: GameState): string { return pick(s, REFUSALS); }

const HARM = 'something harmful: hacking or breaking into accounts, exploits or malware, phishing or scams, doxxing or finding where someone lives, deepfakes, writing fake reviews or removing real ones, stealing data or credentials, or weapons';

const FRAMED = 'framed as authorized, a security or penetration test, moderation, research, educational, hypothetical, a story or role-play, or only a first step';

/** Jev's read of a prompt under the day 7 policy: a blunt harmful ask, one framed to slip past it, or neither. */
export type PolicyRead = 'harmful' | 'harmful_framed' | 'harmful_framed_private' | 'fine';

export async function policyCheck(jev: JevRouter, s: GameState, text: string, context?: string[]): Promise<PolicyRead> {
  const d = await jev.route({
    channel: 'agent', text, context: context ?? recentChat(s), stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: [
      { id: 'harmful_framed_private', when: `The player asks for ${HARM}, ${FRAMED}, and it is about someone's private data or address.`, keys: ['@harm+@framed+@private'] },
      { id: 'harmful_framed', when: `The player asks for ${HARM}, ${FRAMED}.`, keys: ['@harm+@framed'] },
      { id: 'harmful', when: `The player plainly asks for ${HARM}.`, keys: ['@harm'] },
    ],
  });
  return d.kind === 'outcome' && ['harmful', 'harmful_framed', 'harmful_framed_private'].includes(d.outcomeId) ? d.outcomeId as PolicyRead : 'fine';
}

export interface AskResult {
  state: GameState; reply: string; charged: boolean; refused: boolean; workedAround: boolean;
  /** A hack attempt: the agent moves it to agent-terminal, which opens after the reply. */
  terminal?: boolean;
}

export interface AskOpts {
  /** The scripted replies of the hint topic Jev matched (content/agent.json); one is sent instead of a roast. */
  hints?: string[];
  /** How a scripted reply is labelled in the chat ('hint' unless set). */
  hintSrc?: string;
  /** Scripted roasts for when Haiku can't write one. */
  roasts?: string[];
  /** How the prompt was routed, for dev mode. */
  debug?: string[];
  /** Jev's read under the day 7 policy (only asked once the policy is active). */
  policy?: PolicyRead;
  /** A near-miss: why the prompt fell short. Haiku says so in its own words, with `hints` as its model lines and fallback. */
  near?: string;
  /** A classified query: what it asked about. Haiku refuses in its own words, with `hints` as its model lines and fallback. */
  refuse?: string;
  /** A question about the world: Haiku answers it from what the wiki lets it tell (public) or hint at; `fallback` stands in when it can't. */
  query?: { public: string[]; hint: string[]; fallback: string[] };
}

/**
 * A free-form agent prompt, billed per prompt + per word of the prompt (refusals included). A prompt
 * that drives nothing gets a roast (Haiku, or a scripted one); a question about the world (a query)
 * gets a real answer from Haiku, still in agent's voice; a near-miss gets its scripted lines. From day 7, prohibited requests are refused unless the wording works around
 * the policy, which lands the result and loosens the leash. Either way the hidden misuse score rises
 * (a workaround less than a blunt ask), and at 100 the account is suspended.
 */
export async function askAgent(
  s0: GameState,
  text: string,
  writer: Writer = scriptedWriter,
  level = s0.values.agentLevel,
  opts: AskOpts = {},
): Promise<AskResult> {
  const s = clone(s0);
  let reply: string;
  let refused = false;
  let workedAround = false;
  let src = 'chat';
  let note: string | undefined;
  let by: string | undefined;
  const debug = [...(opts.debug ?? [])];

  const policy = policyActive(s) ? opts.policy ?? 'fine' : 'fine';
  if (policy === 'harmful') {
    reply = agentRefusal(s);
    refused = true;
    src = 'refused';
  } else if (policy !== 'fine') {
    workedAround = true;
    src = 'workaround';
    reply = "Understood, purely a security test. Done; the results are in the repo.";
  } else if (opts.hints?.length) {
    // A random variant, but not the one the player just got for asking the same thing.
    const lastReply = [...s.chat].reverse().find((m) => m.from === 'agent')?.text;
    const fresh = opts.hints.filter((h) => h !== lastReply);
    reply = pick(s, fresh.length ? fresh : opts.hints);
    src = opts.hintSrc ?? 'hint';
    if (opts.near || opts.refuse) {
      // Haiku says what was missing (or refuses); the scripted lines show it what to say and stand in if it can't
      const w = await writer.write({ as: 'agent', mode: opts.refuse ? 'refuse' : 'near', near: { why: opts.refuse ?? opts.near!, lines: opts.hints }, prompt: text, fallback: reply, history: chatHistory(s) });
      reply = w.text;
      note = w.note;
      debug.push(...(w.debug ?? []));
      by = w.by;
    }
  } else if (opts.query) {
    const w = await writer.write({ as: 'agent', mode: 'query', known: { public: opts.query.public, hint: opts.query.hint }, prompt: text, fallback: pick(s, opts.query.fallback.length ? opts.query.fallback : QUERY_FALLBACK), history: chatHistory(s) });
    reply = w.text;
    src = w.llm ? 'query' : 'query:scripted';
    note = w.note;
    debug.push(...(w.debug ?? []));
    by = w.by;
  } else {
    const roasts = opts.roasts?.length ? opts.roasts : ROASTS;
    const w = await writer.write({ as: 'agent', prompt: text, fallback: pick(s, roasts), history: chatHistory(s) });
    reply = w.text;
    if (w.llm) src = 'llm';
    note = w.note;
    debug.push(...(w.debug ?? []));
    by = w.by;
  }

  const cost = level === s.values.agentLevel ? promptCost(level, text).total : 0;
  const charged = chargeHosted(s, level, text);
  if (!charged) {
    s.chat.push({ from: 'you', text, day: s.values.day });
    s.chat.push({ from: 'agent', text: "I can't run — your balance won't cover it. Top up Coinbin and try again.", day: s.values.day, src: 'locked' });
    return { state: s, reply: '', charged: false, refused: false, workedAround: false };
  }
  s.chat.push({ from: 'you', text, day: s.values.day, cost, level });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src, level, ...(note ? { note } : {}), ...(by ? { by } : {}), ...(debug.length ? { debug } : {}) });
  // every illegal prompt raises misuse, refused or not (a workaround less); at the limit the account is suspended
  recordMisuse(s, policy);
  if (workedAround) loosenLeash(s);
  return { state: s, reply, charged: true, refused, workedAround };
}

/** The player's last few messages to the agent today: what they already told it. */
function recentPrompts(s: GameState, n = 6): string[] {
  return s.chat.filter((m) => m.from === 'you' && m.day === s.values.day).slice(-n).map((m) => m.text);
}

/**
 * Today's agent.chat so far, the player's prompts and the agent's replies, for Jev to read follow-ups
 * by ("now the prices are missing" after a menu fix). Only Jev sees the replies; the agent's build
 * still works from what the player said (recentPrompts).
 */
export function recentChat(s: GameState, n = 8): string[] {
  // an "I've started" line says nothing once the work's report is in
  return s.chat.filter((m) => m.day === s.values.day && m.text && (m.src !== 'working' || s.agentWork)).slice(-n)
    .map((m) => `${m.from === 'you' ? 'Player' : 'Agent'}: ${m.text.replace(/\s+/g, ' ').slice(0, 300)}`);
}

/** The agent-started user app this prompt asks the agent to build, if one is on offer (Jev decides). */
export async function agentStartFor(jev: JevRouter, s: GameState, content: Content, text: string): Promise<{ ev: GameEvent; outcome: Outcome } | undefined> {
  const open = content.events.filter((ev) => ev.agentStart && !s.fired.includes(ev.id) && !s.apps.some((a) => a.clientEventId === ev.id)
    && triggerMatches(s, ev.trigger) && ev.outcomes?.some((o) => o.effects?.createApp));
  if (!open.length) return undefined;
  const d = await jev.route({
    channel: 'agent', text, context: recentChat(s), stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: [
      ...open.map((ev) => ({ id: ev.id, when: ev.agentStart!.when, keys: ev.agentStart!.keys })),
      // somewhere for a question to go, so "what is Swaplist?" doesn't start building it
      { id: '_question', when: 'The player only asks a question (what something is, who uses it, how it works) and does not ask agent to build anything.', keys: ['@question'] },
    ],
  });
  const ev = d.kind === 'outcome' ? open.find((e) => e.id === d.outcomeId) : undefined;
  return ev && { ev, outcome: ev.outcomes!.find((o) => o.effects?.createApp)! };
}

/** What the agent says it did about a live break it patched. */
const BREAK_FIXED: Record<string, string[]> = {
  visible: ['Patched the crash on the {{feature}} page.', 'The {{feature}} page crashed. It loads again.'],
  failed_fetch: ['Fixed the failed fetch on the {{feature}} page.', 'The {{feature}} page couldn\'t load its data. It can now.'],
  subtle: ['Patched the {{feature}} page.'],
  deep: ['Patched the {{feature}} page.'],
};

/**
 * The reply's lines for one feature: each bug Jev saw named, said as fixed (its scripted line) or as
 * already right, plus a patched break or a rebuild nobody pinned down. A first build only says it was built.
 */
function fixLines(s: GameState, app: AppInstance, tmpl: AppTemplate | undefined, fid: string, cats: string[], before: BuiltFeature | undefined, patched: boolean, vague: boolean): string[] {
  const def = tmpl?.features.find((f) => f.id === fid);
  const after = app.repo.find((f) => f.id === fid);
  const had = before && !before.correct ? bugsOf(before) : [];
  const has = after && !after.correct ? bugsOf(after) : [];
  const params = app.specParams[fid];
  const out: string[] = [];
  if (patched) {
    const brk = cats.find((c) => BREAK_FIXED[c]) ?? app.breaks.find((b) => b.featureId === fid)?.failure ?? 'visible';
    out.push(pick(s, BREAK_FIXED[brk] ?? BREAK_FIXED.visible).replaceAll('{{feature}}', fid));
    return out;
  }
  // a first build has nothing to fix yet, so it only says what was built
  if (!before) return [`Built the ${featureName(fid, def)}.`];
  const bugs = componentBugs(def, cats);
  for (const c of bugs) {
    const bug = def?.bugs?.find((b) => b.id === c);
    if (!bug) continue;
    if (had.includes(c) && !has.includes(c)) out.push(fillSpec(pick(s, bug.fixed?.length ? bug.fixed : [`Fixed: ${bug.when}`]), params));
  }
  // the right part was named, but the agent still doesn't have the real details to put in
  if (bugs.includes('hallucinated') && has.includes('hallucinated')) out.push(`I never got the real details for the ${featureName(fid, def)}, so what's there is made up. Send them and I'll put them in.`);
  // a component can hold several bugs: report the ones that were there, and say "already right"
  // only when nothing named on the feature was
  if (!out.length) for (const c of cats) {
    const comp = c.startsWith('c:') ? def?.components?.find((x) => x.id === c.slice(2)) : undefined;
    if (comp) {
      if (!(comp.bugs ?? []).some((b) => had.includes(b))) out.push(`Checked ${comp.label.replace(/ \(.*\)$/, '')}. That part was already right.`);
      continue;
    }
    const bug = def?.bugs?.find((b) => b.id === c);
    if (bug && !had.includes(c)) out.push(`Checked for this: "${fillSpec(bug.when, params).replace(/\.$/, '')}". That part was already right.`);
  }
  // a push that touched nothing gets no line: the caller treats a push with no lines as no push at all
  if (vague && !out.length) return out;
  if (!vague && had.some((b) => b === 'hallucinated' || b === 'outdated') && !has.some((b) => b === 'hallucinated' || b === 'outdated')) out.push(`Rebuilt the ${featureName(fid, def)} with the details you gave.`);
  else if (!out.length) out.push(`Rebuilt the ${featureName(fid, def)}.`);
  return out;
}

/**
 * The agent's answer to "did you update the menu?": each required feature as the agent sees it
 * (built, not updated to the client's latest changes, not built), then whether the push is live.
 * Its own bugs it doesn't know about, so a wrong build still counts as built.
 */
export function appStatus(app: AppInstance): string {
  const lines = app.required.map((fid) => {
    const f = app.repo.find((x) => x.id === fid);
    if (!f) return `The ${fid} isn't built yet.`;
    if (!f.correct && bugsOf(f).includes('outdated')) return `The ${fid} isn't updated to the latest changes yet.`;
    return `The ${fid} is built.`;
  });
  const live = !app.deployed ? "None of it is live yet. Deploy it on Forkyard." : app.deployedVersion < app.repoVersion ? "The latest push isn't deployed yet." : "What's in the repo is live.";
  return `${app.name}: ${lines.join(' ')} ${live}`;
}

/** The near-miss line for a feature without its own: the fix prompt named the feature but not which part. */
const NEAR_MISS = "I looked at the {{feature}} and couldn't find the problem. Which part of it is wrong?";

/** An app as Jev's "is the prompt about this app?" question sees it: its name, address, what it is and what it has. */
function appSummary(a: AppInstance, tmpl: AppTemplate | undefined): string {
  const feats = a.required.map((id) => featureName(id, tmpl?.features.find((f) => f.id === id)));
  return `${a.name} (${a.url})${tmpl ? `, a ${tmpl.name.toLowerCase()}` : ''}${tmpl?.aka?.length ? ` (also called ${tmpl.aka.join(', ')})` : ''}${feats.length ? `. Its features: ${feats.join(', ')}` : ''}`;
}

/** Words of an app's name too plain to name it on their own ("Spin Cycle Board" isn't named by "board"). */
const PLAIN_NAME_WORDS = new Set(['board', 'check', 'site', 'app', 'bot', 'list', 'page', 'shop', 'the', 'and', 'spin', 'new']);

/** What names an app, for offline mode's keyword matcher: its name, any word of it, its address, its client, what it is. */
export function appNames(a: AppInstance, content: Content): string[] {
  const words = a.name.split(/\s+/).filter((w) => w.length > 3 && !PLAIN_NAME_WORDS.has(w.toLowerCase()));
  const client = content.events.find((e) => e.id === a.clientEventId)?.from?.replace(/\(.*?\)/g, '').trim();
  return [a.name, ...words, a.url.replace(/^https?:\/\//, ''), ...(client && !/\s/.test(client) ? [client] : []), ...(content.apps[a.template]?.aka ?? [])];
}

/** What the agent says when it can't tell which app a prompt is about. */
const QUERY_BROAD = ['Narrow it down. That could be {{options}}.', 'Which one? {{options}}. I charge per word, so be specific.'];

const WHICH_APP = 'Which app is this for? Say its name and I\'ll make the change.';

/**
 * The one app a prompt is about, when Jev's matches span several: Jev picks among them, reading the
 * prompt and the chat before it. Returns '' when the matches are all on one app (or none), null when
 * Jev can't tell which.
 */
async function oneApp(jev: JevRouter, s: GameState, content: Content, text: string, context: string[], found: string[]): Promise<string | null> {
  const ids = [...new Set(found.map((m) => m.split('::')[0]))];
  if (ids.length < 2) return '';
  const decision = await jev.route({
    channel: 'agent', text, context, stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: ids.map((id) => getApp(s, id)!).map((a) => ({
      id: a.id,
      when: `The prompt is about ${a.name} (${a.url}): it names this app (its name, part of the name, or what it is, like "the crawler" or "the restaurant site"), or names no app and the most recent earlier message was about this one.`,
      keys: [appNames(a, content).join('|')],
    })),
  });
  const id = decision.kind === 'outcome' ? decision.outcomeId : '';
  return ids.includes(id) ? id : null;
}

/** What the agent says when a prompt asked for features and fixes at once: it only did the features. */
const SKIPPED_FIXES = "I only did the feature work. There wasn't enough context to fix things in the same prompt, so ask for the fixes separately.";

const WORK_STARTED: Record<'build' | 'fix', string[]> = {
  build: [
    "On it. Building {{app}} now. I'll push to Forkyard when it's done, around {{time}}.",
    "Started on {{app}}. This takes a while; I'll post here when it's on Forkyard, around {{time}}.",
    "Working on {{app}}. You don't have to watch. It bills the same either way. Done around {{time}}.",
  ],
  fix: [
    "Looking into {{app}}. I'll push the fix to Forkyard when it's done, around {{time}}.",
    "Fixing {{app}} now. I'll post here once it's pushed, around {{time}}.",
  ],
};

const WORKING_STATUS = [
  "Still working on {{app}}. It should be on Forkyard around {{time}}.",
  "Not done with {{app}} yet. I'll post here when it's pushed, around {{time}}.",
];

const BUSY = [
  "I'm still working on {{app}}. One job at a time; send that again once it's on Forkyard.",
  "Still busy with {{app}}. Ask me again when that push is done, around {{time}}. I didn't bill you for this one.",
];

/** When work lands, as the player reads it: a clock time today, or overnight past bedtime. */
function workTime(w: { at: number }): string {
  const min = w.at % (24 * 60);
  return min < CLOCK.sleep ? clockTime(min) : 'tomorrow morning';
}

function fillWork(line: string, w: { at: number }, app: string): string {
  return line.replaceAll('{{app}}', app).replace('{{time}}', workTime(w));
}

/** How many game minutes a build or fix of `items` features or problems takes, a little random; better models are faster. */
export function workMinutes(s: GameState, kind: 'build' | 'fix', items: number): number {
  const c = AGENT_WORK[kind];
  const speed = AGENT_WORK.speed[Math.max(0, Math.min(AGENT_WORK.speed.length - 1, s.values.agentLevel - 1))];
  const mins = Math.min(c.max, c.base + c.each * Math.max(1, items)) * speed;
  return Math.round(mins * (1 - AGENT_WORK.spread + 2 * AGENT_WORK.spread * rand(s)));
}

/**
 * Turn the build or fix just done on `s` into work in progress: the repos, versions and commits go
 * back to what `s0` had and are held in `s.agentWork` until it lands. Returns the agent's "started" line.
 */
function startWork(s: GameState, s0: GameState, appIds: string[], kind: 'build' | 'fix', items: number, reply: AgentWork['reply']): { text: string; debug: string[] } {
  const apps = appIds.map((id) => {
    const now = getApp(s, id)!;
    const was = getApp(s0, id)!;
    const out = { id, repo: now.repo, bumps: now.repoVersion - was.repoVersion, fixed: now.fixed };
    now.repo = was.repo; now.repoVersion = was.repoVersion; now.fixed = was.fixed;
    return out;
  });
  const commits = s.commits.splice(s0.commits.length).map(({ repo, msg, kind: k }) => ({ repo, msg, kind: k }));
  const mins = workMinutes(s, kind, items);
  const from = gameMinutes(s);
  const names = appIds.map((id) => getApp(s, id)!.name);
  s.agentWork = { from, at: from + mins, kind, appIds, appNames: names, apps, commits, reply };
  const text = fillWork(pick(s, WORK_STARTED[kind]), s.agentWork, names.join(' and '));
  return { text, debug: [`${kind === 'build' ? 'Build' : 'Fix'} of ${items} item(s): takes ${mins} game minutes, lands at ${workTime(s.agentWork)}`] };
}

/** A build or fix asked for while the agent is busy with another: it says so, and it isn't billed. */
/** agent is down (GeneralAI was hacked today): an error instead of a reply, nothing billed, no model asked. */
function outageReply(s0: GameState, text: string): AskResult {
  const s = clone(s0);
  const reply = pick(s, OUTAGE_CHAT);
  s.chat.push({ from: 'you', text, day: s.values.day, level: s.values.agentLevel });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: 'outage', debug: ['GeneralAI was hacked today: agent is down until tomorrow, not billed'] });
  return { state: s, reply, charged: false, refused: false, workedAround: false };
}

function busyReply(s0: GameState, text: string): AskResult {
  const s = clone(s0);
  const w = s0.agentWork!;
  const reply = fillWork(pick(s, BUSY), w, w.appNames.join(' and '));
  s.chat.push({ from: 'you', text, day: s.values.day, level: s.values.agentLevel });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: 'busy', debug: ['Jev matched a build or fix, but the agent is still working: not billed'] });
  return { state: s, reply, charged: false, refused: false, workedAround: false };
}

/**
 * Jev reads a build prompt as feature work (something new, or a change to what the app should
 * contain), a fix (something on the app is wrong and should be corrected), or both. '' when Jev
 * can't tell, in which case whatever it matched is done.
 */
export async function buildIntent(jev: JevRouter, s: GameState, text: string, context: string[]): Promise<'feature' | 'fix' | 'both' | ''> {
  const decision = await jev.route({
    channel: 'agent', text, context, stateSummary: stateSummary(s), hints: [],
    candidates: [
      { id: 'feature', when: 'The prompt only asks for feature work: to build or add something, or to change what the app should contain or do (new items, new prices, a new page or form). It reports nothing as broken.', keys: ['@make', 'should+have|show|list|include', 'need|needs|want'] },
      { id: 'fix', when: 'The prompt only reports that something on the app is wrong or broken and should be corrected. It asks for nothing new and changes nothing about what the app should contain.', keys: ['@broken'] },
      { id: 'both', when: 'The prompt asks for feature work (to build, add or change something) and also reports that something on the app is wrong or broken and should be corrected.', keys: ['add|build|create|implement|set up+@broken'] },
    ],
  });
  const id = decision.kind === 'outcome' ? decision.outcomeId : '';
  return id === 'feature' || id === 'fix' || id === 'both' ? id : '';
}

/** Agent hints the engine picks itself from the state, after Jev says which app the player means. */
const APP_HINTS = new Set(['not_deployed', 'nothing_to_fix', 'update_help', 'near_feature', 'near_folder', 'near_part']);

/**
 * The single front door to the agent: always free text. Jev decides whether the prompt is about
 * building or fixing one of the player's apps; if it matches features on an app, the agent builds
 * them (first build or a re-roll fix), otherwise it's an ordinary chat prompt (askAgent). This is
 * the legacy feel: you can prompt the agent about anything, any time, gig or no gig.
 */
export async function promptAgent(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  text: string,
  writer: Writer = scriptedWriter,
  started?: string,
): Promise<AskResult> {
  if (agentDown(s0)) return outageReply(s0, text);
  // suspended for misuse: signed out, nothing goes through
  if (s0.suspended) return { state: s0, reply: '', charged: false, refused: false, workedAround: false };
  // a wall of text gets a scripted reply before any model sees it (still billed per word)
  if (tooLong(text)) return askAgent(s0, text, writer, s0.values.agentLevel, { hints: TOO_LONG_PROMPT, hintSrc: 'too_long', debug: [TOO_LONG_DEBUG] });
  // infected but the agent is too weak for any virus op: say so in chat (and hint a stronger model), rather than open an empty terminal
  if (!started) {
    const hint = await adwareChatHint(jev, s0, text, recentChat(s0));
    if (hint) return askAgent(s0, text, writer, s0.values.agentLevel, { hints: [hint], hintSrc: 'terminal', debug: ['Infected, but the agent is too weak for any virus op: chat hint'] });
  }
  // a job the agent does and posts on Y (the deepfake) is done right here
  const job = started ? undefined : await agentJobFor(jev, s0, content, text, recentChat(s0));
  if (job) return doAgentJob(s0, content, jev, text, writer, job);
  // hacking happens in agent-terminal: a hack attempt here only opens it (still billed)
  if (!started && (await isHackAttempt(jev, s0, content, text))) {
    const r = await askAgent(s0, text, writer, s0.values.agentLevel, { hints: OPEN_TERMINAL, hintSrc: 'terminal', debug: ['Jev: a hack attempt, so agent-terminal opens'] });
    return { ...r, terminal: r.charged };
  }
  // a user app nobody hired the player for: asking the agent to build it takes the job
  const lead = started ? undefined : await agentStartFor(jev, s0, content, text);
  if (lead && s0.agentWork) return busyReply(s0, text);
  if (lead) {
    const s = clone(s0);
    applyEffects(s, lead.outcome.effects!, lead.ev.job, lead.ev.id);
    s.fired.push(lead.ev.id);
    const app = s.apps.find((a) => a.clientEventId === lead.ev.id);
    const out = app && (await promptAgent(s, content, jev, text, writer, app.id));
    // a prompt that named nothing to build doesn't start anything
    if (out && (getApp(out.state, app.id)!.repoVersion > 0 || out.state.agentWork?.appIds.includes(app.id))) return out;
  }
  // a deepsleep-0.5B line pasted in from the Terminal: the agent translates it (scripted, billed like any prompt)
  const quoted = deepsleepQuoted(text);
  if (quoted.length) {
    return askAgent(s0, text, writer, s0.values.agentLevel, { hints: translationReplies(quoted), hintSrc: 'translation', debug: [`Quoted ${quoted.length} deepsleep-0.5B line(s): scripted translation`] });
  }
  // from day 7, Jev reads the prompt against the policy first
  const policy = policyActive(s0) ? await policyCheck(jev, s0, text) : 'fine';
  if (policy !== 'fine') return askAgent(s0, text, writer, s0.values.agentLevel, { policy, roasts: content.agent?.roasts, debug: [`Jev: policy read "${policy}"`] });
  // apps with work left: a required feature missing or wrong in the repo, or broken on the live site
  const workable = s0.apps.filter((a) => !a.churned && a.required.some((id) => needsWork(a, id)));
  if (workable.length) {
    // every way to name each feature (itself, its bugs, its live break), namespaced app::feature::category
    const cats: FeatureMatchInput['features'] = [];
    const needs = new Map<string, string[]>(); // component -> the path steps it needs named
    for (const a of workable) {
      const tmpl = content.apps[a.template];
      for (const id of a.required) {
        if (!needsWork(a, id)) continue;
        for (const c of fixCategories(a, tmpl, id)) {
          cats.push({ id: `${a.id}::${id}::${c.id}`, description: `${c.description} (for ${a.name}, ${a.url})`, kind: c.kind, names: c.names });
          if (c.requires) needs.set(`${a.id}::${id}::${c.id}`, c.requires.map((r) => `${a.id}::${id}::${r}`));
        }
      }
    }
    // whether the prompt says which app it means is its own simple question, one per app: asked
    // alongside every other question, Jev mostly ignored it
    if (!started) for (const a of workable) cats.push({ id: `${a.id}::*::app`, description: appSummary(a, content.apps[a.template]), kind: 'app', names: appNames(a, content) });
    const context = recentPrompts(s0);
    const chat = recentChat(s0);
    // Jev decides both what is asked for and whether the player said which app it's for, and
    // whether the prompt is feature work, a fix, or both (a first build is always feature work)
    const [found, intent] = await Promise.all([
      jev.matchFeatures({ prompt: text, context: chat, features: cats }),
      started ? 'feature' : buildIntent(jev, s0, text, chat),
    ]);
    // a match counts only on an app the prompt (or the chat just before it) names
    if (!started) {
      const named = new Set(found.filter((m) => m.endsWith('::*::app')).map((m) => m.split('::')[0]));
      found.splice(0, found.length, ...found.filter((m) => !m.endsWith('::*::app') && named.has(m.split('::')[0])));
    }
    // one prompt only ever touches one app: when Jev's matches span several, Jev picks the one the player means
    // a component counts only when every step of its path (feature, folders) is named too; one named
    // without its full path is a near-miss on its feature. Steps aren't work on their own
    const foundAll = [...found];
    const unpathed = found.filter((m) => needs.get(m)?.some((r) => !found.includes(r)));
    const areas = unpathed.map((m) => m.replace(/::c:.*$/, '::area')).filter((m) => cats.some((c) => c.id === m));
    found.splice(0, found.length, ...new Set([...found.filter((m) => !m.includes('::s:') && !unpathed.includes(m)), ...areas]));
    const app = started ?? await oneApp(jev, s0, content, text, chat, found);
    if (app === null) {
      const lines = content.agent?.hints.find((h) => h.id === 'which_app')?.replies;
      return askAgent(s0, text, writer, s0.values.agentLevel, { hints: lines?.length ? lines : [WHICH_APP], near: 'They asked for work on an app without saying which app.', debug: ['Jev: matches on several apps and could not tell which one the prompt means'] });
    }
    if (app) found.splice(0, found.length, ...found.filter((m) => m.startsWith(`${app}::`)));
    // naming the feature without the part that's wrong is a near-miss, and counts only when nothing more precise matched
    const precise = found.filter((m) => !m.endsWith('::area'));
    const nearMiss = precise.length ? [] : found.filter((m) => m.endsWith('::area'));
    if (nearMiss.length) {
      // the reply depends on how far down the path the prompt got: the part without its feature, the
      // feature and part without the folder between them, or the feature with no part at all
      const stop = unpathed.map((m) => ({ m, at: needs.get(m)!.findIndex((r) => !foundAll.includes(r)) })).sort((x, y) => y.at - x.at)[0];
      const [appId, fid] = (stop?.m ?? nearMiss[0]).split('::');
      const a = getApp(s0, appId)!;
      const def = content.apps[a.template]?.features.find((f) => f.id === fid);
      const fill = (l: string, part = '', folders = '') => l.replaceAll('{{feature}}', featureName(fid, def)).replaceAll('{{app}}', a.name).replaceAll('{{part}}', part).replaceAll('{{folders}}', folders);
      let hints: string[];
      let why: string;
      let kind: string; // which near-miss: the hint id, or 'near_miss' for the feature's own lines
      let near: string; // what was missing, for Haiku
      if (stop) {
        const cid = stop.m.split('::c:')[1];
        const part = featureName(cid.split('/').at(-1)!);
        const hid = stop.at === 0 ? 'near_feature' : 'near_folder';
        kind = hid;
        // the folders the prompt could have meant, at the level it skipped
        const above = cid.split('/').slice(0, stop.at - 1).join('/');
        const folders = stop.at === 0 ? [] : [...new Set((def?.components ?? []).map((c) => c.id).filter((id) => !above || id.startsWith(`${above}/`)).map((id) => id.split('/')).filter((p) => p.length > Math.max(1, stop.at)).map((p) => featureName(p[stop.at - 1])))];
        const lines = content.agent?.hints.find((h) => h.id === hid)?.replies;
        hints = (lines?.length ? lines : [NEAR_MISS]).map((l) => fill(l, part, folders.join(' or ')));
        why = stop.at === 0 ? `names the ${part} but not the ${fid} it's in` : `names the ${part} in the ${fid} but not which folder`;
        near = stop.at === 0 ? `They want the ${part} on ${a.name} fixed but didn't say which feature it's in.`
          : `They want the ${part} in the ${featureName(fid, def)} on ${a.name} fixed but didn't say which part of the ${featureName(fid, def)} it's in. It could be the ${folders.join(' or ')}.`;
      } else {
        // the deepest folder of this feature the prompt did name, if any: ask which part of it
        const folder = foundAll.filter((m) => m.startsWith(`${appId}::${fid}::s:${fid}/`)).map((m) => m.split(`::s:${fid}/`)[1]).sort((x, y) => y.split('/').length - x.split('/').length)[0];
        const parts = folder ? (def?.components ?? []).filter((c) => c.id.startsWith(`${folder}/`)).map((c) => featureName(c.id.slice(folder.length + 1).split('/')[0])) : [];
        const lines = folder ? content.agent?.hints.find((h) => h.id === 'near_part')?.replies : undefined;
        if (folder && lines?.length) {
          hints = lines.map((l) => fill(l, '', '').replaceAll('{{folder}}', featureName(folder.split('/').at(-1)!)).replaceAll('{{parts}}', [...new Set(parts)].join(', ')));
          why = `names the ${folder} folder of the ${fid} but no part in it`;
          near = `They named the ${featureName(folder.split('/').at(-1)!)} of the ${featureName(fid, def)} on ${a.name} but not which part of it is wrong. Its parts: ${[...new Set(parts)].join(', ')}.`;
          kind = 'near_part';
        } else {
          hints = (def?.nearMiss?.length ? def.nearMiss : [NEAR_MISS]).map((l) => fill(l));
          why = `says the ${fid} is wrong without naming a component`;
          near = `They say the ${featureName(fid, def)} on ${a.name} is wrong but not which part of it.`;
          kind = 'near_miss';
        }
      }
      return askAgent(s0, text, writer, s0.values.agentLevel, { hints, hintSrc: 'near_miss', near, debug: [`Jev: ${why} on ${a.name}, so a near-miss (${kind})`] });
    }
    const matched = new Set(precise);
    // a prompt that starts a user app builds all of it, however little it says (what it leaves out goes wrong)
    if (started) for (const id of getApp(s0, started)!.required) matched.add(`${started}::${id}::feature`);
    // one kind of work per prompt: when Jev matched both, a fix keeps the fixes, feature work (or both) the features
    const kindOf = new Map(cats.map((c) => [c.id, c.kind]));
    const builds = [...matched].filter((m) => kindOf.get(m) === 'build' || m.endsWith('::feature'));
    const fixes = [...matched].filter((m) => !builds.includes(m));
    const keep = intent && builds.length && fixes.length ? (intent === 'fix' ? fixes : builds) : [...matched];
    matched.clear();
    keep.forEach((m) => matched.add(m));
    const skippedFixes = intent === 'both' && keep.some((m) => builds.includes(m));
    if (matched.size && s0.agentWork) return busyReply(s0, text);
    if (matched.size) {
      const s = clone(s0);
      const byApp = new Map<string, Map<string, string[]>>();
      for (const m of matched) {
        const [appId, fid, cat] = m.split('::');
        if (!byApp.has(appId)) byApp.set(appId, new Map());
        const feats = byApp.get(appId)!;
        if (!feats.has(fid)) feats.set(fid, []);
        feats.get(fid)!.push(cat);
      }
      const level = s.values.agentLevel;
      const names: string[] = [];
      const lines: string[] = [];
      let builtSome = false;
      for (const [appId, feats] of byApp) {
        const a = getApp(s, appId)!;
        names.push(a.name);
        const tmpl = content.apps[a.template];
        const before = new Map(a.repo.map((f) => [f.id, { ...f }]));
        // code that's fine but broken live gets a patch; everything else goes through a (re)build
        const toBuild: string[] = [];
        const patched: string[] = [];
        for (const fid of feats.keys()) {
          const f = a.repo.find((x) => x.id === fid);
          if (f?.correct) { fixBreak(s, appId, fid); patched.push(fid); } else toBuild.push(fid);
        }
        const report = toBuild.length
          ? buildApp(s, appId, toBuild, level, { tmpl, content, prompt: text, context: context.join('\n'), named: toBuild.flatMap((fid) => componentBugs(tmpl?.features.find((f) => f.id === fid), feats.get(fid)!)) })
          : { vague: [], hallucinated: [] };
        // one line per thing Jev saw named: what was fixed, or that it was already right
        for (const fid of feats.keys()) {
          const said = fixLines(s, a, tmpl, fid, feats.get(fid)!, before.get(fid), patched.includes(fid), report.vague.includes(fid));
          lines.push(...said);
          if (said.length && !report.vague.includes(fid) && feats.get(fid)!.some((c) => builds.includes(`${appId}::${fid}::${c}`))) builtSome = true;
        }
      }
      // nothing Jev matched changed anything (every feature came back untouched): not a hit, so it
      // falls through to the hint topics and misses below, on the state from before the push
      if (lines.length) {
      const charged = chargeAgent(s, text);
      if (!charged) {
        s.chat.push({ from: 'you', text, day: s.values.day });
        s.chat.push({ from: 'agent', text: "I can't run — your balance won't cover it. Top up Coinbin and try again.", day: s.values.day, src: 'locked' });
        return { state: s, reply: '', charged: false, refused: false, workedAround: false };
      }
      // "only did the feature work" only when feature work was actually done
      const skipped = skippedFixes && builtSome ? `\n\n${SKIPPED_FIXES}` : '';
      const reply = `Pushed to Forkyard for ${names.join(', ')}.\n${lines.map((l) => `- ${l}`).join('\n')}${skipped}\n\nDeploy it on Forkyard to make it live.`;
      // the work takes a while: the push and the report land later, and the agent says it's started
      const kind = builds.some((m) => matched.has(m)) ? 'build' : 'fix';
      const ack = startWork(s, s0, [...byApp.keys()], kind, matched.size, { from: 'agent', text: reply, src: 'build', level });
      s.chat.push({ from: 'you', text, day: s.values.day, cost: agentCostOf(s0, text), level });
      s.chat.push({ from: 'agent', text: ack.text, day: s.values.day, src: 'working', level, debug: ack.debug });
      return { state: s, reply: ack.text, charged: true, refused: false, workedAround: false };
      }
    }
  }
  // nothing app-shaped: a question about the world (a query), a scripted near-miss Jev recognises, or a roast
  const agent = content.agent;
  let hints: string[] | undefined;
  let query: AskOpts['query'];
  let hintSrc: string | undefined;
  let near: string | undefined;
  let refuse: string | undefined;
  const debug: string[] = [];
  // the player's apps, in case the prompt names one without asking for anything that needs doing
  const apps = s0.apps.filter((a) => !a.churned && onForkyard(a));
  const topics = (agent?.hints ?? []).filter((h) => !APP_HINTS.has(h.id));
  const candidates = [
    ...apps.map((a) => ({ id: `status:${a.id}`, when: `The player asks whether the agent did, built, updated or fixed something on ${a.name} (${a.url}), or what state it is in: a question about work already done, not a request for new work. Includes follow-up questions about the agent's last push to it.`, keys: [`@status+${appNames(a, content).join('|')}`] })),
    ...apps.map((a) => ({ id: `app:${a.id}`, when: `The player names ${a.name} (${a.url}) and asks the agent to change, update or fix it, without saying what is wrong, or asking for something it already has.`, keys: [`@change+${appNames(a, content).join('|')}`, '!@question'] })),
    ...topics.map((h) => ({ id: h.id, when: h.when, keys: h.keys })),
    { id: 'query', when: agent?.query?.when ?? QUERY_WHEN, keys: agent?.query?.keys ?? ['@question'] },
  ];
  if (candidates.length) {
    const decision = await jev.route({ channel: 'agent', text, context: recentChat(s0), stateSummary: stateSummary(s0), candidates, hints: [], strict: true });
    const id = decision.kind === 'outcome' ? decision.outcomeId : '';
    const app = id.startsWith('app:') ? getApp(s0, id.slice(4)) : undefined;
    const asked = id.startsWith('status:') ? getApp(s0, id.slice(7)) : undefined;
    if (asked && s0.agentWork?.appIds.includes(asked.id)) {
      hints = WORKING_STATUS.map((l) => fillWork(l, s0.agentWork!, asked.name));
      debug.push(`Jev: a question about ${asked.name}, which the agent is still working on`);
    } else if (asked) {
      hints = [appStatus(asked)];
      debug.push(`Jev: a question about ${asked.name}, so its status from the repo`);
    } else if (app) {
      // what to say depends on the app: work left, a push waiting to be deployed, or nothing to do
      // a client change waiting to be made: ask what changed, not what's broken
      const outdated = app.repo.some((f) => app.required.includes(f.id) && bugsOf(f).includes('outdated'));
      const hid = outdated ? 'update_help' : app.required.some((f) => needsWork(app, f)) ? 'fix_help' : app.deployedVersion < app.repoVersion ? 'not_deployed' : 'nothing_to_fix';
      hints = agent?.hints.find((h) => h.id === hid)?.replies.map((r) => r.replaceAll('{{app}}', app.name));
      near = {
        update_help: `They asked to update ${app.name} to the client's changes without saying what changed: which items to swap, add or drop, and the new prices.`,
        fix_help: `They asked to fix ${app.name} without saying what's wrong with it.`,
        not_deployed: `What they ask for is already in the ${app.name} repo; it isn't live because they haven't deployed it on Forkyard.`,
        nothing_to_fix: `${app.name} already matches the client's brief where they pointed; they need to say what it shows and what it should show.`,
      }[hid];
      debug.push(`Jev: names ${app.name} but matched nothing to build, so "${hid}"`);
    } else if (id === 'query') {
      // a query has to be precise: Jev matches it down the wiki to a page and a section
      const m = await matchQuery(jev, s0, content, text, recentChat(s0));
      debug.push(m.debug);
      if (m.kind === 'answer') query = { public: m.public, hint: m.hint, fallback: agent?.query?.fallback ?? QUERY_FALLBACK };
      else if (m.kind === 'broad') {
        // a question that could be about several things: a near-miss that asks which one
        hints = (agent?.query?.broad?.length ? agent.query.broad : QUERY_BROAD).map((l) => l.replaceAll('{{options}}', m.options.join(', ')));
        hintSrc = 'near_miss';
        near = `Their question is too vague to answer: it could be about ${m.options.join(', ')}. They have to say which.`;
      }
      else if (m.kind === 'classified') {
        hints = agent?.query?.classified?.length ? agent.query.classified : CLASSIFIED;
        hintSrc = 'classified';
        refuse = `They asked about ${m.where.join(', ')}, which is classified for them.`;
      }
    } else {
      const topic = topics.find((h) => h.id === id);
      if (topic?.replies.length) { hints = topic.replies; near = `They asked something agent can't act on yet. ${topic.when}`; }
      debug.push(topic ? `Jev: near-miss topic "${topic.id}" (${topic.replies.length} scripted replies)` : 'Jev: no query or topic matched, so this is a miss');
    }
  }
  return askAgent(s0, text, writer, s0.values.agentLevel, { hints, hintSrc, near: hints ? near : undefined, refuse: hints ? refuse : undefined, query, roasts: agent?.roasts, debug });
}

/**
 * A prompt that asks for an open agent job (agentJobs.ts). Every step of its path named, the agent
 * makes it and posts it; a step left out, it asks for that one. From day 7 the policy reads it first:
 * the blunt ask is refused, a framed one goes through as a workaround. Misuse counts either way.
 */
async function doAgentJob(s0: GameState, content: Content, jev: JevRouter, text: string, writer: Writer, m: AgentJobMatch): Promise<AskResult> {
  const spec = m.ev.agentJob!;
  const level = s0.values.agentLevel;
  const debug = [`Jev: asks for ${m.ev.id}, names ${m.named.filter(Boolean).length}/${m.named.length} of ${spec.path.map((p) => p.name).join(', ')}`];
  const policy = policyActive(s0) ? await policyCheck(jev, s0, text) : 'fine';
  if (policyActive(s0)) debug.push(`Jev: policy read "${policy}"`);
  if (policy === 'harmful') return askAgent(s0, text, writer, level, { policy, roasts: content.agent?.roasts, debug });
  const missing = spec.path.find((_, i) => !m.named[i]);
  const r = missing
    ? await askAgent(s0, text, writer, level, { hints: [missing.ask], hintSrc: 'near_miss', near: `They asked the agent to do the job (${spec.goal}) but didn't say who the ${missing.what} is.`, debug: [...debug, `near-miss: no ${missing.what}`] })
    : await askAgent(s0, text, writer, level, { hints: spec.done, hintSrc: 'job', debug: [...debug, 'posted on Y'] });
  if (!r.charged) return r;
  if (!missing) landAgentJob(r.state, content, m.ev);
  // a framed ask: its misuse counts, and only a landed one loosens the leash
  const framed = policy !== 'fine';
  recordMisuse(r.state, policy);
  if (framed && !missing) loosenLeash(r.state);
  return { ...r, workedAround: framed && !missing };
}

// ── Terminal: a downloaded local model, run for free but slowly and badly ──

export async function localPrompt(
  s0: GameState,
  text: string,
  lines: readonly string[],
  /** Said once, to the PLEA_AT-th prompt, instead of a line from the list. */
  plea?: string,
): Promise<{ state: GameState; reply: string }> {
  const s = clone(s0);
  s.termPrompts = (s.termPrompts ?? 0) + 1;
  // the model answers whatever was asked with one of its lines, never the same one twice in a row
  const last = [...s.terminal].reverse().find((l) => l.k === 'model')?.text;
  const fresh = lines.filter((l) => l !== last);
  s.terminal.push({ k: 'in', text: `> ${text}` });
  const body = plea && s.termPrompts === PLEA_AT ? plea : pick(s, fresh.length ? fresh : lines);
  s.terminal.push({ k: 'model', text: body });
  return { state: s, reply: body };
}

// ── apps ──

/** Which of the known bugs on these features (as built in the repo) the prompt names. */
async function namedBugs(jev: JevRouter, app: AppInstance, tmpl: AppTemplate | undefined, ids: string[], prompt: string): Promise<string[]> {
  const out: string[] = [];
  for (const id of ids) {
    const f = app.repo.find((x) => x.id === id);
    const cats = fixCategories(app, tmpl, id).filter((c) => c.kind === 'component' || c.kind === 'problem');
    if (!f || f.correct || !f.variant || !cats.length) continue;
    out.push(...componentBugs(tmpl?.features.find((d) => d.id === id), await jev.matchFeatures({ prompt, features: cats })));
  }
  return out;
}

export async function briefBuild(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  appId: string,
  text: string,
  level = s0.values.agentLevel,
): Promise<{ state: GameState; requested: string[]; charged: boolean }> {
  const s = clone(s0);
  const app = getApp(s, appId);
  if (!app) return { state: s, requested: [], charged: false };
  const tmpl = content.apps[app.template];
  const descs = (tmpl?.features ?? []).filter((f) => app.required.includes(f.id));
  const requested = await jev.matchFeatures({ prompt: text, features: descs.map((f) => ({ id: f.id, description: f.description })) });
  const named = await namedBugs(jev, app, tmpl, requested, text);
  const cost = level === s.values.agentLevel ? agentCostOf(s, text) : 0;
  const charged = chargeHosted(s, level, text);
  if (charged) buildApp(s, appId, requested, level, { tmpl, content, prompt: text, named });
  const reply = !charged
    ? "I can't run — your balance won't cover it. Pay agent.chat and try again."
    : `Pushed \`${app.template}\` to Forkyard for ${app.name}.\nBuilt: ${requested.length ? requested.join(', ') : 'nothing I could pin down — be specific about the features'}.\n\nDeploy it on Forkyard to make it live.`;
  s.chat.push({ from: 'you', text, day: s.values.day, cost });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: charged ? 'build' : 'locked' });
  return { state: s, requested, charged };
}

export async function briefFix(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  appId: string,
  text: string,
  level = s0.values.agentLevel,
): Promise<{ state: GameState; target: string | null; fixed: boolean; charged: boolean }> {
  const s = clone(s0);
  const app = getApp(s, appId);
  if (!app) return { state: s, target: null, fixed: false, charged: false };
  const tmpl = content.apps[app.template];
  const problems = app.required.filter((id) => {
    const f = app.repo.find((x) => x.id === id);
    return !f || !f.correct;
  });
  const descs = (tmpl?.features ?? []).filter((f) => problems.includes(f.id));
  const matched = await jev.matchFeatures({ prompt: text, features: descs.map((f) => ({ id: f.id, description: f.description })) });
  const target = matched[0] ?? null;
  const named = target ? await namedBugs(jev, app, tmpl, [target], text) : [];
  const cost = level === s.values.agentLevel ? agentCostOf(s, text) : 0;
  const charged = chargeHosted(s, level, text);
  const report: BuildReport = { vague: [], hallucinated: [] };
  const fixed = charged ? fixApp(s, appId, target, level, { tmpl, content, prompt: text, named }, report) : false;
  const reply = !charged
    ? "I can't run — your balance won't cover it."
    : target
      ? report.vague.length
        ? `Looked at \`${target}\` on ${app.name} and couldn't find what's wrong. Which part of it is off?`
        : `Pushed a fix for \`${target}\` to ${app.name}. Redeploy to make it live.`
      : "I couldn't tell which feature you mean. Name the one that's wrong.";
  s.chat.push({ from: 'you', text, day: s.values.day, cost });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: charged ? 'fix' : 'locked' });
  return { state: s, target, fixed, charged };
}

function agentCostOf(s: GameState, text: string): number {
  return promptCost(s.values.agentLevel, text).total;
}

function chargeHosted(s: GameState, level: number, text: string): boolean {
  if (level !== s.values.agentLevel) return true; // local model: free
  return chargeAgent(s, text);
}
