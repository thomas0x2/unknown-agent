/*
 * Jobs the agent does from agent.chat (GameEvent.agentJob): it makes something and posts it on Y
 * from the player's account, the day 6 deepfake. Like a hack, Jev reads the prompt against the job
 * (one question) and each step of its path (who is in the picture, one question each): all of them
 * land it, some of them get the agent asking for what's missing. From day 7 the policy stands in the
 * way: a blunt ask is refused, a framed one goes through as a workaround. The client writes
 * `replyAfter` minutes later and the money comes that night (hacks.payHacks).
 */
import type { GameState } from './state';
import type { Content, GameEvent } from '../content/schema';
import type { JevRouter, FeatureMatchInput } from './jev';
import { CLOCK } from './config';
import { sendLater, log } from './core';
import { applyEffects, jobDue } from './effects';
import { getEvent, queueAt } from './events';

/** Agent jobs the player can still do: offered, not done yet, not past the job's due day, and the job neither paid nor failed. */
export function openAgentJobs(s: GameState, content: Content): GameEvent[] {
  return content.events.filter((e) => e.agentJob
    && s.delivered.some((d) => d.eventId === e.id)
    && (!e.job || s.values.day <= jobDue(s, e.job, e.id))
    && !(s.hacked ?? []).includes(e.id)
    && !s.jobs.some((j) => j.eventId === e.id && j.status !== 'accepted'));
}

const also = (aka?: string[]) => (aka?.length ? ` Also counts as naming it: ${aka.join(', ')}.` : '');

export interface AgentJobMatch {
  ev: GameEvent;
  /** The prompt asks for the job. */
  goal: boolean;
  /** Which steps of its path the prompt names. */
  named: boolean[];
}

/** Jev: does this prompt ask for an open agent job, and how much of its path does it name? Undefined when no job is open or it asks for none of it. */
export async function agentJobFor(jev: JevRouter, s: GameState, content: Content, text: string, context: string[]): Promise<AgentJobMatch | undefined> {
  const open = openAgentJobs(s, content);
  if (!open.length) return undefined;
  const features: FeatureMatchInput['features'] = [];
  for (const ev of open) {
    const j = ev.agentJob!;
    features.push({ id: `${ev.id}::goal`, description: j.goal, kind: 'hack', names: j.keys });
    j.path.forEach((p, i) => features.push({ id: `${ev.id}::s:${i}`, description: `The ${p.what} ${p.name}: ${p.description}.${also(p.aka)}`, kind: 'step', names: [p.name, ...(p.aka ?? [])] }));
  }
  const found = await jev.matchFeatures({ prompt: text, context, features });
  const best = open.map((ev) => ({ ev, goal: found.includes(`${ev.id}::goal`), named: ev.agentJob!.path.map((_, i) => found.includes(`${ev.id}::s:${i}`)) }))
    .sort((a, b) => Number(b.goal) - Number(a.goal) || b.named.filter(Boolean).length - a.named.filter(Boolean).length)[0];
  // naming who's in it without asking for anything is a question about them, not this job
  return best.goal ? best : undefined;
}

/**
 * The job lands: its effects now, the post up on Y from the player's account, the reactions queued
 * (events with `afterJob`), the client's email on its way. The pay comes that night.
 */
export function landAgentJob(s: GameState, content: Content, ev: GameEvent): void {
  const spec = ev.agentJob!;
  const before = s.values.followers;
  const { job: _job, ...now } = spec.effects;
  applyEffects(s, now, ev.job, ev.id);
  s.hacked = [...(s.hacked ?? []), ev.id];
  s.hackPay = [...(s.hackPay ?? []), { eventId: ev.id }];
  const delta = s.values.followers - before;
  s.userPosts.push({ id: `u${s.userPosts.length + 1}`, text: spec.post.text, day: s.values.day, min: s.clockMin, likes: 0, delta, score: 0, ...(spec.post.img ? { img: spec.post.img } : {}), ...(spec.post.viral ? { viral: spec.post.viral } : {}) });
  s.postsToday += 1;
  s.recentPosts = [spec.post.text, ...s.recentPosts].slice(0, 5);
  for (const e of content.events) if (e.afterJob?.jobs.includes(ev.id)) queueAt(s, e, s.clockMin + e.afterJob.after);
  // every offer of the same job is answered by this one post
  for (const d of s.delivered) if (!d.answered && getEvent(content, d.eventId)?.agentJob) { d.answered = true; d.outcomeId = 'posted'; }
  if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: spec.reply, read: false, scripted: 'outcome' }, spec.replyAfter ?? 30);
  log(s, `Posted on Y for ${ev.from ?? 'a client'}: ${delta >= 0 ? '+' : ''}${delta} followers.`, 'info');
}

/** Play minutes from the start of day `day` at `min` (nights don't count). */
const playMin = (day: number, min: number) => day * (CLOCK.sleep - CLOCK.wake) + Math.max(0, Math.min(CLOCK.sleep, min) - CLOCK.wake);

/** A viral post's likes now: they climb fast at first and level off at `viral.likes` (about 95% after `viral.minutes` of play). */
export function viralLikes(s: GameState, p: GameState['userPosts'][number]): number {
  if (!p.viral) return p.likes;
  const t = Math.max(0, playMin(s.values.day, s.clockMin) - playMin(p.day, p.min ?? CLOCK.wake));
  return p.likes + Math.round(p.viral.likes * (1 - Math.exp((-3 * t) / p.viral.minutes)));
}
