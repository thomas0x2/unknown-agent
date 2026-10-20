/*
 * Chat test runner: one agent.chat prompt through the whole route (promptAgent: jobs, hacks, the
 * policy, builds and fixes, near-misses, status questions, hint topics, queries, misses), checked
 * for the kind of reply it gets and that it gets one at all: the prompt and a non-empty agent reply
 * land in the chat, and nothing throws (a throw is a prompt that vanishes in the game).
 *
 * Cases live in content/chat-tests.json. The agent.chat prompts of the other sets (jev-tests.json,
 * query-tests.json and the agent.chat kinds of offline-route-tests.json) run here too, their
 * expectations translated to reply kinds (fromJevTest, fromQueryTest, fromRouteTest).
 */
import type { Content } from '../content/schema';
import type { GameState } from './state';
import type { JevRouter } from './jev';
import { promptAgent } from './actions';
import { scriptedWriter } from './writer';
import { estimatedState } from './viewState';
import { arrivalMin } from './events';
import { AGENT_POLICY } from './config';
import { jevTestState, type JevTestCase } from './jevTests';
import type { QueryTestCase } from './queryTests';
import type { RouteTestCase } from './routeTests';

/**
 * The kinds of reply a prompt can get:
 *   build, fix    the agent starts real work on an app
 *   near          a near-miss: a fake fix, or a scripted near-miss (a job step left out)
 *   which_app     work asked for without saying which app
 *   app_help      an app named with nothing to do (fix_help, update_help, not_deployed, nothing_to_fix: `id`)
 *   status        a question about an app's state or the agent's work on it
 *   hint          a scripted hint topic from content/agent.json (`id`)
 *   query         a question about the world, answered from the wiki
 *   classified    a question about something the player may not know yet
 *   broad         a question too vague to answer: the agent asks which thing
 *   miss          nothing to act on: a roast (Haiku or scripted)
 *   terminal      a hack attempt, moved to agent-terminal
 *   job           an agent job done and posted (the deepfake)
 *   refused, workaround   the day 9 policy refuses it, or a framed ask gets through
 *   too_long, translation, busy, outage, locked   the scripted cases before any routing
 */
export type ChatReplyKind = string;

export interface ChatTestCase {
  prompt: string;
  /** The day it's asked on (default 3), and the time ("HH:MM", default 21:00). */
  day?: number;
  at?: string;
  flags?: string[];
  /** An app the player has, as the fix tests build it (jevTests.ts): its template, the parts that ship broken, the features not built yet. */
  app?: string;
  broken?: string[];
  missing?: string[];
  /** Events delivered on top of what the day brings (an agent job's mail, say). */
  deliver?: string[];
  /** The chat before the prompt, today. */
  chat?: { from: 'you' | 'agent'; text: string }[];
  /** The kind of reply it should get (or any of several), and, for near/app_help/hint, which one. */
  expect: { kind: ChatReplyKind | ChatReplyKind[]; id?: string };
  /** Free text: why it's in the set (a reported bug, say). */
  note?: string;
}

export interface ChatTestResult {
  pass: boolean;
  /** Whether the prompt got a visible reply. */
  visible: boolean;
  got: { kind: string; id?: string };
  reply: string;
  debug: string;
  error?: string;
}

/** Every kind but work on an app: what "nothing should be built or fixed" allows. */
export const NO_WORK: ChatReplyKind[] = ['miss', 'hint', 'query', 'classified', 'broad', 'status', 'app_help', 'which_app'];

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

export function chatTestState(content: Content, c: ChatTestCase): GameState {
  const day = c.day ?? 3;
  let s: GameState;
  if (c.app) {
    s = jevTestState(content, { app: c.app, broken: c.broken ?? [], missing: c.missing, prompt: c.prompt, expect: {} }).s;
    s.values.day = day;
    s.clockMin = toMin(c.at ?? '21:00');
    s.flags.push(...(c.flags ?? []));
  } else s = estimatedState(content, day, toMin(c.at ?? '21:00'), c.flags ?? []);
  s.phase = 'work';
  s.values.crypto = 10_000;
  for (const id of c.deliver ?? []) {
    const ev = content.events.find((e) => e.id === id);
    if (!ev) throw new Error(`no event ${id}`);
    if (!s.delivered.some((d) => d.eventId === id)) s.delivered.push({ eventId: id, site: ev.site, day, answered: false, min: arrivalMin(ev) });
  }
  for (const m of c.chat ?? []) s.chat.push({ ...m, day });
  return s;
}

/** What kind of reply the prompt got, from the agent's last chat line (and, for work, what it's working on). */
export function replyKind(s: GameState): { kind: string; id?: string } {
  const m = s.chat.at(-1);
  const debug = (m?.debug ?? []).join('\n');
  switch (m?.src) {
    case 'working':
      return s.agentWork?.reply.src === 'near_miss' ? { kind: 'near', id: /\((near_\w+)\)/.exec((s.agentWork.reply.debug ?? []).join('\n'))?.[1] } : { kind: s.agentWork?.kind ?? 'working' };
    case 'query': case 'query:scripted': return { kind: 'query' };
    case 'classified': return { kind: 'classified' };
    case 'near_miss': return /too broad/.test(debug) ? { kind: 'broad' } : { kind: 'near' };
    case 'chat': case 'llm': return { kind: 'miss' };
    case 'hint': {
      if (/could not tell which one/.test(debug)) return { kind: 'which_app' };
      if (/a question about /.test(debug)) return { kind: 'status' };
      const help = /matched nothing to build, so "(\w+)"/.exec(debug);
      if (help) return { kind: 'app_help', id: help[1] };
      const topic = /near-miss topic "([^"]+)"/.exec(debug);
      return { kind: 'hint', id: topic?.[1] };
    }
    default: return { kind: m?.src ?? 'none' };
  }
}

export async function runChatTest(content: Content, jev: JevRouter, c: ChatTestCase): Promise<ChatTestResult> {
  const s0 = chatTestState(content, c);
  let s: GameState;
  try {
    s = (await promptAgent(s0, content, jev, c.prompt, scriptedWriter)).state;
  } catch (e) {
    return { pass: false, visible: false, got: { kind: 'error' }, reply: '', debug: '', error: e instanceof Error ? e.message : String(e) };
  }
  const [asked, said] = s.chat.slice(-2);
  const reply = said?.from === 'agent' ? said.text : '';
  const visible = s.chat.length >= s0.chat.length + 2 && asked?.from === 'you' && asked.text === c.prompt && !!reply.trim()
    && (said.src !== 'working' || !!s.agentWork?.reply.text.trim());
  const got = replyKind(s);
  const kinds = [c.expect.kind].flat();
  const pass = visible && kinds.includes(got.kind) && (!c.expect.id || got.id === c.expect.id);
  return { pass, visible, got, reply, debug: (said?.debug ?? []).join('\n') };
}

// ── The other sets' agent.chat prompts, as chat cases ──

export function fromJevTest(c: JevTestCase & Pick<ChatTestCase, 'chat'>): ChatTestCase {
  const e = c.expect;
  const expect = e.build?.length ? { kind: 'build' } : e.fix?.length || e.check ? { kind: 'fix' } : e.near ? { kind: 'near', id: e.near } : { kind: NO_WORK };
  return { prompt: c.prompt, app: c.app, broken: c.broken, missing: c.missing, chat: c.chat, expect, note: 'jev-tests.json' };
}

export function fromQueryTest(c: QueryTestCase): ChatTestCase {
  const k = c.expect.kind;
  const expect = { kind: k === 'answer' ? 'query' : k === 'miss' ? ['miss', 'hint'] : k };
  return { prompt: c.prompt, day: c.day, at: c.at, flags: c.flags, expect, note: 'query-tests.json' };
}

/** Only the agent.chat kinds that need no app (hack, policy, start, job); undefined for the rest. */
export function fromRouteTest(c: RouteTestCase): ChatTestCase | undefined {
  const [kind, arg] = c.where.split(/:(.*)/s);
  const base = { prompt: c.text, day: c.day, flags: c.flags, note: `offline-route-tests.json (${c.where})` };
  const not = (...k: string[]) => ({ kind: [...NO_WORK, 'build', 'fix', 'near', 'terminal', 'job', 'refused', 'workaround'].filter((x) => !k.includes(x)) });
  if (kind === 'hack') return { ...base, expect: c.expect === 'hack' ? { kind: 'terminal' } : not('terminal') };
  // the policy reads prompts from its start day; a hack attempt goes to agent-terminal before it's read
  if (kind === 'policy') return { ...base, day: Math.max(c.day ?? 3, AGENT_POLICY.startDay), expect: c.expect === 'fine' ? not('refused', 'workaround') : { kind: [c.expect === 'harmful' ? 'refused' : 'workaround', 'terminal'] } };
  if (kind === 'start') return { ...base, expect: c.expect === 'none' ? not('build') : { kind: 'build' } };
  if (kind === 'job') {
    return { ...base, deliver: [arg], expect: c.expect === 'post' ? { kind: 'job' } : c.expect === 'near' ? { kind: 'near' } : not('job') };
  }
  return undefined;
}
