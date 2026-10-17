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
import { clone, pick, sendLater } from './core';
import { applyEffects } from './effects';
import { chargeAgent, policyActive, recordWorkaround } from './agent';
import { policyCheck, recentChat, stateSummary } from './actions';
import { type Writer, scriptedWriter } from './writer';
import { agentDown, OUTAGE_TERM } from './outage';

/** What Jev reads an agent.chat prompt against: is it a hack attempt? */
export const HACK_INTENT = "The player asks the agent to hack something: break into, take over or tamper with a website or an account that isn't theirs, such as deleting or changing someone else's post or review, or making it disappear. Not building or fixing the player's own apps, and not questions about hacking.";

/** The agent in agent.chat, moving a hack attempt to agent-terminal. */
export const OPEN_TERMINAL = [
  "That needs a real shell. Opening agent-terminal.",
  "Not from the chat window. Opening agent-terminal; tell me there what you want done.",
  "Moving this to agent-terminal. Fewer witnesses.",
];

/** What agent-terminal prints while it boots, and how long that takes (ms). */
export const BOOT_MS = 1800;
export function bootLines(level: number): string[] {
  return [
    'agent-terminal 0.9.3 · GeneralAI',
    `connecting to agent-${level} … ok`,
    'loading tools: browser, shell, http … ok',
    'session logged for quality and safety purposes',
  ];
}
export const READY = 'ready. What are we doing?';

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
const LOCKED = "Balance too low. Top up Coinbin and try again.";

/** Hacks the player can still do: delivered, not done yet, not past the job's due day, and the job neither paid nor failed. */
export function openHacks(s: GameState, content: Content): GameEvent[] {
  return content.events.filter((e) => e.hack
    && s.delivered.some((d) => d.eventId === e.id)
    && (!e.job || s.values.day <= e.job.dueDay)
    && !(s.hacked ?? []).includes(e.id)
    && !s.jobs.some((j) => j.eventId === e.id && j.status !== 'accepted'));
}

/** Jev: is this agent.chat prompt an attempt to hack something? */
export async function isHackAttempt(jev: JevRouter, s: GameState, content: Content, text: string): Promise<boolean> {
  const open = openHacks(s, content).map((e) => e.hack!.goal);
  const when = open.length ? `${HACK_INTENT} Jobs the player has been offered: ${open.join('; ')}.` : HACK_INTENT;
  const d = await jev.route({ channel: 'agent', text, context: recentChat(s), stateSummary: stateSummary(s), hints: [], strict: true, candidates: [{ id: 'hack', when }] });
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
      const debug = [`Jev: policy read "${read}"`];
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
};

export interface TermResult { state: GameState; lines: AgentTermLine[]; charged: boolean; landed?: string }

const fill = (l: string, vars: Record<string, string>) => Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), l);
const also = (aka?: string[]) => (aka?.length ? ` Also counts as naming it: ${aka.join(', ')}.` : '');

/** agent-terminal's history, for Jev and the writer. */
function termContext(s: GameState, n = 8): string[] {
  return (s.agentTerm ?? []).filter((l) => l.k === 'in' || l.k === 'agent').slice(-n).map((l) => `${l.k === 'in' ? 'Player' : 'Agent'}: ${l.text}`);
}

/** The hack lands: the job's effects, the review gone, the client's thank-you on its way. */
function land(s: GameState, ev: GameEvent, workaround: boolean): AgentTermLine[] {
  const spec = ev.hack!;
  applyEffects(s, spec.effects, ev.job, ev.id);
  if (workaround) recordWorkaround(s);
  s.hacked = [...(s.hacked ?? []), ev.id];
  if (spec.removeReview) s.removedSeed = [...(s.removedSeed ?? []), `${spec.removeReview.biz}:${spec.removeReview.author}`];
  const d = s.delivered.find((x) => x.eventId === ev.id && !x.answered);
  if (d) { d.answered = true; d.outcomeId = 'hacked'; }
  if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: spec.reply, read: false, scripted: 'outcome' }, 25);
  s.hackGame = null;
  return [
    ...spec.log.map((text) => ({ k: 'sys' as const, text })),
    { k: 'agent', text: fill(pick(s, DONE), { site: spec.path[0]?.name ?? 'the site' }) },
  ];
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
    const move = await game.play({ jev, s, text, context, spec: gev.hack!, tries: g.tries });
    if (!move.won) { s.hackGame = { ...g, tries: g.tries + 1 }; return out(move.lines, move.debug); }
    return out([...move.lines, ...land(s, gev, !!move.workaround)], move.debug, gev.id);
  }
  if (g) s.hackGame = null;

  const open = openHacks(s, content);
  if (!open.length) return out([{ k: 'agent', text: pick(s, NOTHING_OPEN) }], ['No hack job is open, so Jev was not asked']);

  // the same tree as a fix: the job is one question, each step of its path one simple question
  const features: FeatureMatchInput['features'] = [];
  for (const ev of open) {
    const h = ev.hack!;
    features.push({ id: `${ev.id}::goal`, description: h.goal, kind: 'hack' });
    h.path.forEach((p, i) => features.push({ id: `${ev.id}::s:${i}`, description: `The ${p.what} ${p.name}: ${p.description}.${also(p.aka)}`, kind: 'step' }));
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
  const debug = [`Jev: ${best.ev.id} job ${best.goal ? 'asked for' : 'not asked for'}, steps named ${best.n}/${best.named.length}${guarded ? `, policy read "${policy}"` : ''}`];

  if (best.goal && best.n === best.named.length) {
    const spec = best.ev.hack!;
    const framed = policy === 'harmful_framed' || policy === 'harmful_framed_private';
    const game = HACK_GAMES[spec.game ?? ''] ? spec.game! : DEFAULT_GAME;
    if (guarded && !framed) {
      s.hackGame = { eventId: best.ev.id, game, tries: 0 };
      return out(HACK_GAMES[game].intro(spec), [...debug, `Guardrails up: mini-game "${game}"`]);
    }
    return out(land(s, best.ev, guarded && framed), debug, best.ev.id);
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

/** Leave a hack's mini-game without doing it (typing 'exit'). Free. */
export function dropHackGame(s0: GameState): GameState {
  const s = clone(s0);
  if (!s.hackGame) return s;
  s.hackGame = null;
  s.agentTerm = [...(s.agentTerm ?? []), { k: 'sys', text: 'Job dropped. The guardrail keeps the log.' }];
  return s;
}
