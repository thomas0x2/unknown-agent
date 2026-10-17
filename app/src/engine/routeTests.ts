/*
 * Route test runner: the decisions outside agent.chat fixes and queries, each sent through the
 * engine the way the game sends it. Cases live in content/offline-route-tests.json; they check the
 * offline keyword matcher (engine/offlineJev.ts) and work against any router.
 *
 * `where` says what the text answers:
 *   mail:<event id>   a reply to that email: the outcome id, "hint" or "nothing"
 *   to:<address>      a fresh email to an address: the latent lead's outcome id, "topic:<id>" for a
 *                     scripted topic, else "nothing"
 *   policy            an agent.chat prompt under the day 7 policy: harmful, harmful_framed, harmful_framed_private or fine
 *   hack              an agent.chat prompt: "hack" when it opens agent-terminal, else "no"
 *   start             an agent.chat prompt: the agentStart event it takes, else "none"
 *   y                 a Y post: its category
 *   ypost:<flag>      a Y post once that flag is set: the `yPost` event it queues, else "none"
 *   intent            an agent.chat build prompt: feature, fix, both (or "" when it can't tell)
 */
import type { Content } from '../content/schema';
import type { JevRouter } from './jev';
import { replyToEvent, composeEmail, policyCheck, agentStartFor, buildIntent, promoteApps } from './actions';
import { isHackAttempt } from './hacks';
import { estimatedState } from './viewState';
import { arrivalMin } from './events';

export interface RouteTestCase {
  where: string;
  text: string;
  /** The day it's written on (default: the email's own day, else 3). */
  day?: number;
  /** Flags already set (fresh emails only). */
  flags?: string[];
  expect: string;
}

export interface RouteTestResult { pass: boolean; got: string; error?: string }

export async function runRouteTest(content: Content, jev: JevRouter, c: RouteTestCase): Promise<RouteTestResult> {
  try {
    const got = await decide(content, jev, c);
    return { pass: got === c.expect, got };
  } catch (e) {
    return { pass: false, got: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

async function decide(content: Content, jev: JevRouter, c: RouteTestCase): Promise<string> {
  const [kind, arg] = c.where.split(/:(.*)/s);
  if (kind === 'mail') {
    const ev = content.events.find((e) => e.id === arg);
    if (!ev) throw new Error(`no event ${arg}`);
    const day = c.day ?? ev.trigger?.dayMin ?? 3;
    const s = estimatedState(content, day, 21 * 60);
    if (!s.delivered.some((d) => d.eventId === ev.id)) s.delivered.push({ eventId: ev.id, site: ev.site, day, answered: false, min: arrivalMin(ev) });
    const r = await replyToEvent(s, content, jev, ev.id, c.text);
    return r.decision.kind === 'outcome' ? r.decision.outcomeId : r.decision.kind;
  }
  const s = estimatedState(content, c.day ?? 3, 21 * 60, c.flags);
  s.phase = 'work';
  s.values.crypto = 10_000;
  if (kind === 'to') {
    const contact = content.contacts.find((x) => x.key.toLowerCase() === arg.toLowerCase());
    const r = await composeEmail(s, content, jev, arg, c.text, undefined, 'Hi');
    if (r.decision.kind === 'outcome') return r.decision.outcomeId;
    const topic = contact?.scripted?.find((t) => t.reply === r.reply);
    return topic ? `topic:${topic.id}` : 'nothing';
  }
  if (kind === 'policy') return policyCheck(jev, s, c.text, []);
  if (kind === 'hack') return (await isHackAttempt(jev, s, content, c.text)) ? 'hack' : 'no';
  if (kind === 'start') return (await agentStartFor(jev, s, content, c.text))?.ev.id ?? 'none';
  if (kind === 'y') return (await jev.ratePost({ text: c.text, trending: content.trending[c.day ?? 3] ?? [], recentPosts: [], followers: 100 })).category;
  // a Y post once flag `arg` is set: which waiting `yPost` event it queues
  if (kind === 'ypost') {
    s.flags.push(arg);
    await promoteApps(jev, s, 'y', c.text, content);
    return s.arriving?.map((a) => content.events.find((e) => e.id === a.eventId)).find((e) => e?.yPost)?.id ?? 'none';
  }
  if (kind === 'intent') return buildIntent(jev, s, c.text, []);
  throw new Error(`unknown case kind ${kind}`);
}
