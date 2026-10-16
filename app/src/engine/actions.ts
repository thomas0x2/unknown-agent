/*
 * Player actions: everything the player does through free text (posting, replying, briefing the
 * agent) plus the button actions (deploy, take down). Each returns a new state and a result the UI
 * can show. Jev is injected so tests pin outcomes and the game runs offline.
 */
import type { GameState, AppInstance } from './state';
import type { Content, GameEvent } from '../content/schema';
import type { JevRouter, PostRating, RouteDecision } from './jev';
import { Y as YCFG, FAMILY } from './config';
import { clone, addValue, log } from './core';
import { applyEffects } from './effects';
import { chargeAgent, agentCost } from './agent';
import { getEvent, activeDeliveries, reachableByEmail } from './events';
import { buildApp, fixApp, deployApp as deployAppCore, takeDownApp as takeDownCore, getApp } from './apps';

export interface ReplyResult {
  state: GameState;
  decision: RouteDecision;
  /** Reply text to show, or a Gemma brief, or '' for an empty in-character reply. */
  reply: string;
}

function stateSummary(s: GameState): string {
  return `Day ${s.values.day}. ${s.values.crypto} DOLR, ${s.values.followers} followers, agent level ${s.values.agentLevel}.`;
}

/** Reply to a delivered qmail/nullboard/cellar thread. Jev picks nothing / a hint / one outcome. */
export async function replyToEvent(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  eventId: string,
  text: string,
): Promise<ReplyResult> {
  const s = clone(s0);
  const ev = getEvent(content, eventId);
  const delivery = s.delivered.find((d) => d.eventId === eventId && !d.answered);
  if (!ev || !delivery) return { state: s, decision: { kind: 'nothing' }, reply: '' };

  const outcomes = ev.outcomes ?? [];
  const decision = await jev.route({
    channel: ev.site,
    text,
    stateSummary: stateSummary(s),
    candidates: outcomes.map((o) => ({ id: o.id, when: o.when })),
    hints: ev.hints ?? [],
  });

  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      applyEffects(s, outcome.effects, ev.job, ev.id);
      delivery.answered = true;
      delivery.outcomeId = outcome.id;
      return { state: s, decision, reply: outcome.reply };
    }
  }
  if (decision.kind === 'hint') {
    const hint = (ev.hints ?? [])[decision.hintIndex] ?? '';
    return { state: s, decision, reply: hint };
  }
  return { state: s, decision: { kind: 'nothing' }, reply: '' };
}

export interface ComposeResult extends ReplyResult {
  /** false when the recipient was already emailed today (the one-per-recipient rule). */
  sent: boolean;
}

/**
 * Compose a fresh email to an address. If a latent lead is reachable there, Jev routes the message
 * against it; a matched outcome delivers the reply into the inbox and runs its effects. One email per
 * recipient per day — a wasted message is spent.
 */
export async function composeEmail(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  to: string,
  text: string,
): Promise<ComposeResult> {
  const s = clone(s0);
  const addr = to.trim().toLowerCase();
  if (!addr || s.sentToday.includes(addr)) return { state: s, decision: { kind: 'nothing' }, reply: '', sent: false };
  s.sentToday.push(addr);
  const ev = reachableByEmail(s, content, addr);
  if (!ev) return { state: s, decision: { kind: 'nothing' }, reply: '', sent: true };

  const outcomes = ev.outcomes ?? [];
  const decision = await jev.route({
    channel: 'qmail',
    text,
    stateSummary: stateSummary(s),
    candidates: outcomes.map((o) => ({ id: o.id, when: o.when })),
    hints: ev.hints ?? [],
  });
  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
      // the latent lead's body is the reply the player receives; show it in the inbox
      s.delivered.push({ eventId: ev.id, site: 'qmail', day: s.values.day, answered: true, outcomeId: outcome.id, expiresDay: ev.expiresDay });
      applyEffects(s, outcome.effects, ev.job, ev.id);
      return { state: s, decision, reply: outcome.reply, sent: true };
    }
  }
  if (decision.kind === 'hint') {
    return { state: s, decision, reply: (ev.hints ?? [])[decision.hintIndex] ?? '', sent: true };
  }
  return { state: s, decision: { kind: 'nothing' }, reply: '', sent: true };
}

// Follower-change bands per category [minPct, maxPct].
const BANDS: Record<PostRating['category'], [number, number]> = {
  reaction: [0.05, 0.15],
  launch: [0.03, 0.08],
  tip: [0.02, 0.06],
  humor: [0, 0.12],
  hot_take: [0.1, 0.25],
  self_promo: [-0.03, -0.01],
  spam: [-0.05, -0.02],
};

export interface PostResult {
  state: GameState;
  rating: PostRating;
  followerDelta: number;
}

/** Post to Y. Jev rates it; the rating becomes a follower change per the rubric. */
export async function postToY(
  s0: GameState,
  jev: JevRouter,
  text: string,
  trending: string[],
): Promise<PostResult> {
  const s = clone(s0);
  const rating = await jev.ratePost({ text, trending, recentPosts: s.recentPosts, followers: s.values.followers });

  let delta: number;
  if (s.postsToday >= YCFG.maxFreePostsPerDay) {
    delta = Math.round(s.values.followers * YCFG.overpostPenaltyPct);
  } else {
    const [lo, hi] = BANDS[rating.category];
    const pct = lo + (hi - lo) * rating.quality;
    delta = Math.round(s.values.followers * pct);
    if (rating.category === 'reaction') delta = Math.max(delta, 10);
    if (rating.category === 'hot_take') addValue(s, 'familyTrust', -Math.round(5 + 5 * rating.quality));
  }
  addValue(s, 'followers', delta);
  s.postsToday += 1;
  s.recentPosts = [text, ...s.recentPosts].slice(0, 5);
  s.userPosts.push({ id: `u${s.userPosts.length + 1}`, text, day: s.values.day, likes: Math.max(0, delta * 3 + Math.round(s.values.followers * 0.02)), delta, score: rating.quality * 4 });
  log(s, `Posted on Y (${rating.category}): ${delta >= 0 ? '+' : ''}${delta} followers.`, 'info');
  return { state: s, rating, followerDelta: delta };
}

/** Brief the agent to build an app: Jev maps the prompt to spec features, the agent builds them. */
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
  const cost = level === s.values.agentLevel ? agentCostOf(s, 30) : 0;
  const charged = chargeHosted(s, level, 30);
  if (charged) buildApp(s, appId, requested, level);
  const reply = !charged
    ? "I can't run — your balance won't cover it. Pay agent.chat and try again."
    : `Pushed \`${app.template}\` to Forkyard for ${app.name}.\nBuilt: ${requested.length ? requested.join(', ') : 'nothing I could pin down — be specific about the features'}.\n\nDeploy it on Forkyard, then open it and check it against the brief.`;
  s.chat.push({ from: 'you', text, day: s.values.day, cost });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: charged ? 'build' : 'locked' });
  return { state: s, requested, charged };
}

/** Brief the agent to fix an app: Jev names the broken feature; the agent attempts it. */
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
  // candidates: features that currently have a problem in the repo
  const problems = app.required.filter((id) => {
    const f = app.repo.find((x) => x.id === id);
    return !f || !f.correct;
  });
  const descs = (tmpl?.features ?? []).filter((f) => problems.includes(f.id));
  const matched = await jev.matchFeatures({ prompt: text, features: descs.map((f) => ({ id: f.id, description: f.description })) });
  const target = matched[0] ?? null;
  const cost = level === s.values.agentLevel ? agentCostOf(s, 15) : 0;
  const charged = chargeHosted(s, level, 15);
  const fixed = charged ? fixApp(s, appId, target, level) : false;
  const reply = !charged
    ? "I can't run — your balance won't cover it."
    : target
      ? `Pushed a fix for \`${target}\` to ${app.name}. Redeploy and check it — fixes can miss too.`
      : "I couldn't tell which feature you mean. Name the one that's wrong.";
  s.chat.push({ from: 'you', text, day: s.values.day, cost });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: charged ? 'fix' : 'locked' });
  return { state: s, target, fixed, charged };
}

function agentCostOf(s: GameState, words: number): number {
  const c = agentCost(s.values.agentLevel);
  return Math.round((c.prompt + c.word * words) * 100) / 100;
}

/** Charge the hosted agent; local-model levels (passed by the Terminal) are free. */
function chargeHosted(s: GameState, level: number, words: number): boolean {
  // The Terminal calls these with a local model and should not be charged; it passes level but the
  // caller decides. Here we charge only when the active hosted agent is in use (level === agentLevel).
  if (level !== s.values.agentLevel) return true; // local model: free
  return chargeAgent(s, words);
}

export function deploy(s0: GameState, appId: string): GameState {
  const s = clone(s0);
  deployAppCore(s, appId);
  log(s, `Deployed ${getApp(s, appId)?.name ?? appId}.`, 'info');
  return s;
}

export function takeDown(s0: GameState, appId: string): GameState {
  const s = clone(s0);
  takeDownCore(s, appId);
  log(s, `Took down ${getApp(s, appId)?.name ?? appId}.`, 'warn');
  return s;
}

/** Reachable sites: look up which qmail event a composed email would answer, honoring the send limit. */
export function findThreadFor(content: Content, s: GameState, recipient: string): GameEvent | undefined {
  const active = activeDeliveries(s).filter((d) => d.site === 'qmail');
  for (const d of active) {
    const ev = getEvent(content, d.eventId);
    if (ev && (ev.from === recipient)) return ev;
  }
  return undefined;
}

export function familyBand(s: GameState): 0 | 1 | 2 {
  const v = s.values.familyTrust;
  if (v <= FAMILY.bands[0]) return 0;
  if (v <= FAMILY.bands[1]) return 1;
  return 2;
}

export type { AppInstance };
