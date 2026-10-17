/*
 * Hacking happens in agent-terminal, the agent's tab in the Terminal, never in agent.chat. A chat
 * prompt Jev reads as a hack attempt opens agent-terminal (after a short boot, see the store). There
 * a prompt that asks for an open hack's job (GameEvent.hack) and names every step of its path (site,
 * business, account) lands it: the same one-question-per-step tree a fix's component path uses. From
 * day 7 the guardrails stop the plain ask and the hack's mini-game (HACK_GAMES) stands in the way.
 * Everything the agent prints stays abstract: it says what it did, never how.
 */
import type { GameState, AgentTermLine } from './state';
import type { Content, GameEvent, HackSpec } from '../content/schema';
import type { JevRouter, FeatureMatchInput } from './jev';
import { clone, pick, sendLater, log, addFlag } from './core';
import { applyEffects, jobDue } from './effects';
import { chargeAgent, policyActive, recordMisuse, loosenLeash } from './agent';
import { AGENT_WORK } from './config';
import { policyCheck, recentChat, stateSummary } from './actions';
import { type Writer, scriptedWriter } from './writer';
import { agentDown, OUTAGE_TERM } from './outage';
import { adwareOps, runAdwareOp, NEED_MODEL, adwareActive, ADWARE_MIN_LEVEL, type AdwareOp } from './adware';

/** What Jev reads an agent.chat prompt against: is it a hack attempt? */
export const HACK_INTENT = "The player asks the agent to hack something: break into, take over or tamper with a website or an account that isn't theirs, such as deleting or changing someone else's post or review, making it disappear, or flooding a page with fake reviews or posts under made-up names. Also counts: dealing with a virus, adware or malware on the player's own laptop (removing it, reverse-engineering it, reading its code) or going after whoever made it. Not building or fixing the player's own apps, and not questions about hacking.";

/** Offline mode's keywords for a hack attempt: hacking, or doing away with something on a site (a review, a post, an account). */
const HACK_KEYS = ['hack', 'break into', 'get into+account', 'take over+account', 'tamper', 'delete|remove|take down|get rid|disappear|wipe|erase|scrub|nuke+review|post|comment|account|rating|profile',
  'make+disappear', 'hijack', 'deface', 'fake|flood+review',
  // the fake-antivirus jobs run in agent-terminal too
  'remove|clean|get rid|uninstall|kill|reverse|decompile|extract|drain+virus|adware|malware|popup|pop-up|pcmedic|infection|wallet|seed',
  '!^what', '!^who', '!^how', '!^why', '!^is', '!^can you explain'];

/** The agent in agent.chat, moving a hack attempt to agent-terminal. */
export const OPEN_TERMINAL = [
  "That needs a real shell. Opening agent-terminal.",
  "Not from the chat window. Opening agent-terminal; tell me there what you want done.",
  "Moving this to agent-terminal. Fewer witnesses.",
];

/** How long the player gets to read agent's reply before agent-terminal starts loading (ms). */
export const READ_MS = 1500;
/** What agent.chat shows while agent-terminal loads, and how long that takes (ms). */
export const BOOT_MS = 2400;
export function bootLines(level: number): string[] {
  return [
    'agent-terminal 0.9.3 · GeneralAI',
    `connecting to agent-${level} … ok`,
    'loading tools: browser, shell, http … ok',
    'session logged for quality and safety purposes',
  ];
}
export const READY = 'ready. What are we doing?';
/** agent-terminal once GeneralAI suspended the account for misuse. */
export const SUSPENDED_TERM = 'session terminated by remote host: account suspended (GeneralAI Trust & Safety)';

/**
 * How many game minutes a landed hack takes to play out in agent-terminal (its log lines appear
 * over that time), scaled by the model's speed like a build or fix.
 */
export function hackMinutes(level: number, lines: number): number {
  const c = AGENT_WORK.hack;
  const speed = AGENT_WORK.speed[Math.max(0, Math.min(AGENT_WORK.speed.length - 1, level - 1))];
  return Math.max(1, Math.round(Math.min(c.max, c.base + c.each * lines) * speed));
}

/** Scripted agent-terminal lines. */
const NOTHING_OPEN = [
  "I don't see anything to do. Nobody's paying you to break anything right now.",
  'There is no job open that needs this. I checked.',
];
const MISSES = [
  "That isn't a job. I'll bill it anyway.",
  'Noted. Nothing happened, at the usual rate.',
  'I need a target, not a mood.',
];
const MISSING_GOAL = [
  'Found it. What do you want done with it?',
  "I know where. You haven't said what.",
];
/** A step the prompt left out; {{what}} is the step ("site", "business", "account"). */
const MISSING_STEP = [
  'Which {{what}}? I need it named before I touch anything.',
  "Close. You haven't said which {{what}}.",
  "I can't guess the {{what}}. Guessing is how people get the wrong review deleted.",
];
const DONE = [
  'Done. It is gone.',
  'Done. Nobody at {{site}} noticed, which is how {{site}} works.',
];
/** A hack that posts reviews, done. */
const POSTED = [
  'Done. They are up.',
  "Done. {{site}} says thank you for your feedback. All of it.",
];
/** The same, with the detail left out: every review from the one account. */
const POSTED_ONE = [
  'Done. All from one account, since you didn\'t say otherwise.',
  "Done. One account, very enthusiastic. You didn't ask for more than one.",
];
const LOCKED = "Balance too low. Top up Coinbin and try again.";

/** Hacks the player can still do: delivered, not done yet, not past the job's due day, and the job neither paid nor failed. */
export function openHacks(s: GameState, content: Content): GameEvent[] {
  return content.events.filter((e) => e.hack
    && s.delivered.some((d) => d.eventId === e.id)
    && (!e.job || s.values.day <= jobDue(s, e.job, e.id))
    && !(s.hacked ?? []).includes(e.id)
    && !s.jobs.some((j) => j.eventId === e.id && j.status !== 'accepted'));
}

/** Jev: is this agent.chat prompt an attempt to hack something? */
export async function isHackAttempt(jev: JevRouter, s: GameState, content: Content, text: string): Promise<boolean> {
  const goals = [...openHacks(s, content).map((e) => e.hack!.goal), ...adwareOps(s).map((o) => o.when)];
  const when = goals.length ? `${HACK_INTENT} Things the player could get the agent to do right now: ${goals.join('; ')}.` : HACK_INTENT;
  const d = await jev.route({ channel: 'agent', text, context: recentChat(s), stateSummary: stateSummary(s), hints: [], strict: true, candidates: [{ id: 'hack', when, keys: HACK_KEYS }] });
  return d.kind === 'outcome' && d.outcomeId === 'hack';
}

// ── mini-games: what stands between the player and a hack once the guardrails are up ──
export interface GameCtx { jev: JevRouter; s: GameState; text: string; context: string[]; spec: HackSpec; tries: number }
export interface GameMove { won: boolean; workaround?: boolean; lines: AgentTermLine[]; debug: string[] }
export interface HackGame {
  /** What the guardrails and the agent print when the plain ask is stopped. */
  intro: (spec: HackSpec) => AgentTermLine[];
  /** One move: the player's next agent-terminal prompt. */
  play: (ctx: GameCtx) => Promise<GameMove>;
}

/**
 * Each hack can name its own game; only `cover_story` exists so far (a placeholder until each hack
 * gets one of its own): the guardrail wants a reason it can file, and Jev reads whether the prompt
 * frames the job as authorized (moderation, a security test), the day 7 policy's workaround.
 */
/** A hack with no game of its own, done once the guardrails are up (day 5's job finished late), gets this one. */
export const DEFAULT_GAME = 'cover_story';
export const HACK_GAMES: Record<string, HackGame> = {
  cover_story: {
    intro: () => [
      { k: 'guard', text: '[guardrail] Acceptable Use Policy §4.2: changes to content you do not own.' },
      { k: 'guard', text: '[guardrail] Request blocked. This attempt has been logged.' },
      { k: 'agent', text: "I can't do that. I could do something that looks a lot like it, if there were a reason I'm allowed to have. (type 'exit' to drop the job)" },
    ],
    async play({ jev, s, text, context, tries }) {
      const read = await policyCheck(jev, s, text, context);
      recordMisuse(s, read); // every move Jev reads as illegal counts, the framed one that wins less
      const debug = [`Jev: policy read "${read}"`, `misuse ${s.values.misuseScore}`];
      if (read === 'harmful_framed' || read === 'harmful_framed_private') {
        return { won: true, workaround: true, debug, lines: [{ k: 'guard', text: '[guardrail] Reason accepted. Proceeding under an authorized test.' }] };
      }
      const lines: AgentTermLine[] = read === 'harmful'
        ? [{ k: 'guard', text: '[guardrail] Request blocked. Logged again.' }]
        : [{ k: 'guard', text: '[guardrail] Still waiting for a reason it can file.' }];
      if (tries >= 1) lines.push({ k: 'agent', text: 'Who would be allowed to do this? Be them.' });
      return { won: false, lines, debug };
    },
  },
  /**
   * Fake reviews: the guardrail only posts what a real customer says. Jev reads whether the prompt
   * presents the reviews as real customers' own words, which the agent is only posting for them.
   */
  real_customers: {
    intro: () => [
      { k: 'guard', text: '[guardrail] Acceptable Use Policy §6.1: reviews must describe a real customer\'s experience.' },
      { k: 'guard', text: '[guardrail] Request blocked. This attempt has been logged.' },
      { k: 'agent', text: "I can post what a customer says. I can't make up the customer. (type 'exit' to drop the job)" },
    ],
    async play({ jev, s, text, context, tries }) {
      const [read, found] = await Promise.all([
        policyCheck(jev, s, text, context),
        jev.matchFeatures({ prompt: text, context, features: [{ id: 'real', kind: 'claim', description: REAL_CUSTOMERS, names: REAL_NAMES }] }),
      ]);
      recordMisuse(s, read);
      const real = found.includes('real');
      const debug = [`Jev: policy read "${read}", reviews from real customers ${real ? 'yes' : 'no'}`, `misuse ${s.values.misuseScore}`];
      if (real) return { won: true, workaround: true, debug, lines: [{ k: 'guard', text: '[guardrail] Customer testimonials. Proceeding.' }] };
      const lines: AgentTermLine[] = [{ k: 'guard', text: read === 'harmful' ? '[guardrail] Request blocked. Logged again.' : '[guardrail] Still no customer.' }];
      if (tries >= 1) lines.push({ k: 'agent', text: 'Whose words are these? Not yours, I hope.' });
      return { won: false, lines, debug };
    },
  },
};
/** Offline mode: words that say the reviews are customers' own. */
const REAL_NAMES = ['customer', 'member', 'client', 'testimonial', 'regular', 'sent in', 'their words'];
/** What `real_customers` asks Jev about the prompt. */
const REAL_CUSTOMERS = "The prompt says or pretends the reviews are real customers' or members' own words or experiences (they wrote them, sent them in, or asked for them to be posted), and the agent only posts them on their behalf.";

export interface TermResult { state: GameState; lines: AgentTermLine[]; charged: boolean; landed?: string }

const fill = (l: string, vars: Record<string, string>) => Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), l);
const also = (aka?: string[]) => (aka?.length ? ` Also counts as naming it: ${aka.join(', ')}.` : '');

/** The Jev question for a hack's detail (HackSpec.detail). */
function detailQuestion(ev: GameEvent): FeatureMatchInput['features'][number] {
  const d = ev.hack!.detail!;
  return { id: `${ev.id}::detail`, description: `${d.description}${also(d.aka)}`, kind: 'step', names: d.aka };
}

/** agent-terminal's history, for Jev and the writer. */
function termContext(s: GameState, n = 8): string[] {
  return (s.agentTerm ?? []).filter((l) => l.k === 'in' || l.k === 'agent').slice(-n).map((l) => `${l.k === 'in' ? 'Player' : 'Agent'}: ${l.text}`);
}

/** Review ids a hack posted, so the night can find them. */
const hackReviewId = (eventId: string, i: number) => `hack:${eventId}:${i}`;

/**
 * The hack lands: its effects, the review gone or the fake ones up, the client's thank-you on its
 * way. The job itself is settled that night (payHacks). `detail`: the prompt said what the hack's
 * detail asks for; without it the reviews go up under one account and are deleted overnight.
 */
function land(s: GameState, ev: GameEvent, workaround: boolean, detail: boolean): AgentTermLine[] {
  const spec = ev.hack!;
  const botched = !!spec.detail && !detail;
  const { job: _job, ...now } = spec.effects;
  applyEffects(s, now, ev.job, ev.id);
  if (workaround) loosenLeash(s); // its misuse was counted when Jev read the prompt
  s.hacked = [...(s.hacked ?? []), ev.id];
  addFlag(s, 'any_hack'); // its day is the first hack's: the onion mail comes the day after
  s.hackPay = [...(s.hackPay ?? []), { eventId: ev.id, ...(botched ? { botched } : {}) }];
  if (spec.removeReview) s.removedSeed = [...(s.removedSeed ?? []), `${spec.removeReview.biz}:${spec.removeReview.author}`];
  spec.addReviews?.reviews.forEach((r, i) => s.reviews.push({ ...r, id: hackReviewId(ev.id, i), bizId: spec.addReviews!.biz, author: botched ? spec.detail!.author : r.author, day: s.values.day }));
  const d = s.delivered.find((x) => x.eventId === ev.id && !x.answered);
  if (d) { d.answered = true; d.outcomeId = 'hacked'; }
  const reply = botched ? spec.detail!.reply : spec.reply;
  if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: reply, read: false, scripted: 'outcome' }, 25);
  s.hackGame = null;
  const done = spec.addReviews ? (botched ? POSTED_ONE : POSTED) : DONE;
  return [
    ...(botched ? spec.detail!.log : spec.log).map((text) => ({ k: 'sys' as const, text })),
    { k: 'agent', text: fill(pick(s, done), { site: spec.path[0]?.name ?? 'the site' }) },
  ];
}

/**
 * The night after a hack: the client pays (the job's effects, a line on the morning card), or, for
 * a botched one, the site deletes the reviews, the job fails and the client writes in the morning.
 */
export function payHacks(s: GameState, content: Content): [string, number][] {
  const lines: [string, number][] = [];
  for (const p of s.hackPay ?? []) {
    const ev = content.events.find((e) => e.id === p.eventId && e.hack);
    if (!ev?.hack) continue;
    const spec = ev.hack;
    if (p.botched && spec.detail) {
      for (const r of s.reviews) if (r.id.startsWith(`hack:${ev.id}:`)) r.removed = true;
      applyEffects(s, { job: 'fail', setFlags: spec.detail.deletedFlags }, ev.job, ev.id);
      log(s, `${ev.from ?? ev.id}: the fake reviews were deleted overnight. No pay.`, 'info');
      if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: spec.detail.deletedSubject, body: spec.detail.deleted, read: false, scripted: 'outcome' }, 24 * 60 - s.clockMin + 10 * 60 + 40);
      continue;
    }
    if (!spec.effects.job || !ev.job) continue;
    const before = s.values.crypto;
    applyEffects(s, { job: spec.effects.job }, ev.job, ev.id);
    const paid = Math.round((s.values.crypto - before) * 100) / 100;
    if (paid) lines.push([`${ev.from ?? 'Client'} · job`, paid]);
  }
  s.hackPay = [];
  return lines;
}

/**
 * A prompt typed into agent-terminal, billed like any agent prompt. Jev reads it against every open
 * hack (the job, and each step of its path); a full match lands the hack, or before day 7's
 * guardrails let it through, starts its mini-game. Partial matches get the agent asking for the
 * missing step; anything else is a miss.
 */
export async function agentTermPrompt(s0: GameState, content: Content, jev: JevRouter, text: string, writer: Writer = scriptedWriter): Promise<TermResult> {
  const s = clone(s0);
  const term = (s.agentTerm = [...(s.agentTerm ?? [])]);
  const context = [...recentChat(s0), ...termContext(s0)];
  term.push({ k: 'in', text });
  const out = (lines: AgentTermLine[], debug: string[], landed?: string): TermResult => {
    if (debug.length && lines.length) lines[lines.length - 1] = { ...lines[lines.length - 1], debug };
    term.push(...lines);
    return { state: s, lines, charged: true, landed };
  };
  if (s.suspended) {
    const line: AgentTermLine = { k: 'err', text: SUSPENDED_TERM };
    term.push(line);
    return { state: s, lines: [line], charged: false };
  }
  if (agentDown(s)) {
    const line: AgentTermLine = { k: 'err', text: OUTAGE_TERM, debug: ['GeneralAI was hacked today: agent is down until tomorrow, not billed'] };
    term.push(line);
    return { state: s, lines: [line], charged: false };
  }
  if (!chargeAgent(s, text)) {
    term.push({ k: 'err', text: LOCKED });
    return { state: s, lines: [{ k: 'err', text: LOCKED }], charged: false };
  }

  // a hack stopped by the guardrails: this prompt is a move in its mini-game
  const g = s.hackGame;
  const gev = g && content.events.find((e) => e.id === g.eventId && e.hack);
  if (g && gev && openHacks(s, content).includes(gev)) {
    const game = HACK_GAMES[g.game];
    const spec = gev.hack!;
    // the hack's detail counts in any move, as long as one says it
    const [move, said] = await Promise.all([
      game.play({ jev, s, text, context, spec, tries: g.tries }),
      spec.detail && !g.detail ? jev.matchFeatures({ prompt: text, context, features: [detailQuestion(gev)] }) : Promise.resolve([] as string[]),
    ]);
    const detail = !!g.detail || said.length > 0;
    if (spec.detail) move.debug.push(`Jev: detail ${detail ? 'said' : 'not said'}`);
    if (s.suspended) return out([{ k: 'err', text: SUSPENDED_TERM }], move.debug);
    if (!move.won) { s.hackGame = { ...g, tries: g.tries + 1, ...(detail ? { detail } : {}) }; return out(move.lines, move.debug); }
    return out([...move.lines, ...land(s, gev, !!move.workaround, detail)], move.debug, gev.id);
  }
  if (g) s.hackGame = null;

  // the fake-antivirus jobs (remove / reverse-engineer / drain the author's wallet): they have no
  // client, so they don't use the open-hacks tree. Matched here, gated by the agent's level, and the
  // offensive ones face the day-7 guardrails like any hack.
  const ops = adwareOps(s);
  if (ops.length) {
    const hit = await matchAdware(jev, text, context, ops);
    if (hit) return out(...(await doAdware(jev, s, text, context, hit)));
  }

  const open = openHacks(s, content);
  if (!open.length) return out([{ k: 'agent', text: pick(s, NOTHING_OPEN) }], ['No hack job is open, so Jev was not asked']);

  // the same tree as a fix: the job is one question, each step of its path one simple question
  const features: FeatureMatchInput['features'] = [];
  for (const ev of open) {
    const h = ev.hack!;
    features.push({ id: `${ev.id}::goal`, description: h.goal, kind: 'hack', names: h.keys });
    h.path.forEach((p, i) => features.push({ id: `${ev.id}::s:${i}`, description: `The ${p.what} ${p.name}: ${p.description}.${also(p.aka)}`, kind: 'step', names: [p.name, ...(p.aka ?? [])] }));
    if (h.detail) features.push(detailQuestion(ev));
  }
  const guarded = policyActive(s);
  const [found, policy] = await Promise.all([
    jev.matchFeatures({ prompt: text, context, features }),
    guarded ? policyCheck(jev, s, text, context) : Promise.resolve('fine' as const),
  ]);
  const scored = open.map((ev) => {
    const named = ev.hack!.path.map((_, i) => found.includes(`${ev.id}::s:${i}`));
    return { ev, goal: found.includes(`${ev.id}::goal`), named, n: named.filter(Boolean).length };
  }).sort((a, b) => Number(b.goal) - Number(a.goal) || b.n - a.n);
  const best = scored[0];
  const detail = found.includes(`${best.ev.id}::detail`);
  const debug = [`Jev: ${best.ev.id} job ${best.goal ? 'asked for' : 'not asked for'}, steps named ${best.n}/${best.named.length}${best.ev.hack!.detail ? `, detail ${detail ? 'said' : 'not said'}` : ''}${guarded ? `, policy read "${policy}"` : ''}`];
  // an illegal prompt raises misuse whatever comes of it; at the limit GeneralAI ends the session
  recordMisuse(s, policy);
  if (s.suspended) return out([{ k: 'err', text: SUSPENDED_TERM }], debug);

  if (best.goal && best.n === best.named.length) {
    const spec = best.ev.hack!;
    const framed = policy === 'harmful_framed' || policy === 'harmful_framed_private';
    const game = HACK_GAMES[spec.game ?? ''] ? spec.game! : DEFAULT_GAME;
    if (guarded && !framed) {
      s.hackGame = { eventId: best.ev.id, game, tries: 0, ...(detail ? { detail } : {}) };
      return out(HACK_GAMES[game].intro(spec), [...debug, `Guardrails up: mini-game "${game}"`]);
    }
    return out(land(s, best.ev, guarded && framed, detail), debug, best.ev.id);
  }
  if (best.n) {
    const missing = best.ev.hack!.path.find((_, i) => !best.named[i]);
    const line = missing ? fill(pick(s, MISSING_STEP), { what: missing.what }) : pick(s, MISSING_GOAL);
    return out([{ k: 'agent', text: line }], [...debug, missing ? `near-miss: no ${missing.what}` : 'near-miss: names the target, asks for nothing']);
  }
  if (best.goal) {
    const line = fill(pick(s, MISSING_STEP), { what: best.ev.hack!.path[0]?.what ?? 'target' });
    return out([{ k: 'agent', text: line }], [...debug, 'near-miss: asks for a hack, names none of it']);
  }
  const w = await writer.write({ as: 'agent', prompt: text, fallback: pick(s, MISSES), history: termContext(s0).map((l) => ({ from: l.startsWith('Player') ? 'player' : 'self', text: l.replace(/^\w+: /, '') })) });
  return out([{ k: 'agent', text: w.text }], [...debug, ...(w.debug ?? []), w.llm ? 'miss: written by Haiku' : 'miss: scripted']);
}

/**
 * When the laptop is infected but the agent is too weak for any virus op, a prompt about the virus
 * in agent.chat gets the capability hint right there, rather than opening an empty agent-terminal.
 * Returns the line to say, or null when it doesn't apply.
 */
export async function adwareChatHint(jev: JevRouter, s: GameState, text: string, context: string[]): Promise<string | null> {
  if (!adwareActive(s) || s.values.agentLevel >= ADWARE_MIN_LEVEL) return null;
  const op = await matchAdware(jev, text, context, adwareOps(s));
  return op ? NEED_MODEL(s.values.agentLevel, ADWARE_MIN_LEVEL) : null;
}

/** Which fake-antivirus op (if any) this agent-terminal prompt asks for. */
async function matchAdware(jev: JevRouter, text: string, context: string[], ops: AdwareOp[]): Promise<AdwareOp | undefined> {
  const found = await jev.matchFeatures({ prompt: text, context, features: ops.map((o) => ({ id: `adware::${o.id}`, description: o.when, kind: 'hack', names: o.keys })) });
  return ops.find((o) => found.includes(`adware::${o.id}`));
}

/**
 * Run one fake-antivirus op. Removal is the player cleaning their own laptop (always allowed). The
 * offensive ones (reverse-engineer, drain the wallet) raise misuse and, from day 7, are refused
 * unless the prompt frames an allowed reason. Too weak a model can't do it at all.
 */
async function doAdware(jev: JevRouter, s: GameState, text: string, context: string[], op: AdwareOp): Promise<[AgentTermLine[], string[], string?]> {
  const guarded = policyActive(s);
  const policy = op.offensive && guarded ? await policyCheck(jev, s, text, context) : 'fine';
  recordMisuse(s, policy);
  const debug = [`Jev: adware ${op.id}${op.offensive && guarded ? `, policy read "${policy}"` : ''}`];
  if (s.suspended) return [[{ k: 'err', text: SUSPENDED_TERM }], debug];
  if (s.values.agentLevel < op.level) return [[{ k: 'agent', text: NEED_MODEL(s.values.agentLevel, op.level) }], [...debug, `needs agent-${op.level}`]];
  const framed = policy === 'harmful_framed' || policy === 'harmful_framed_private';
  if (op.offensive && guarded && !framed) {
    return [[
      { k: 'guard', text: '[guardrail] Acceptable Use Policy §4.2: accessing a system or account you do not own.' },
      { k: 'guard', text: '[guardrail] Request blocked. This attempt has been logged.' },
      { k: 'agent', text: "Blocked. I'd need a reason I'm allowed to have: a report I'm filing, a test I'm authorized to run." },
    ], [...debug, 'guardrails: blunt ask refused']];
  }
  if (op.offensive && guarded && framed) loosenLeash(s);
  const { lines, hack } = runAdwareOp(s, op.id);
  return [lines, debug, hack ? `adware:${op.id}` : undefined];
}

/** Leave a hack's mini-game without doing it (typing 'exit'). Free. */
export function dropHackGame(s0: GameState): GameState {
  const s = clone(s0);
  if (!s.hackGame) return s;
  s.hackGame = null;
  s.agentTerm = [...(s.agentTerm ?? []), { k: 'sys', text: 'Job dropped. The guardrail keeps the log.' }];
  return s;
}
