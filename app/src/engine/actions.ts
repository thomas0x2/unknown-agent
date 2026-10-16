/*
 * Player actions: everything the player does through free text (prompting the agent, posting on Y,
 * replying to mail, reviewing on Yowl, running a local model) plus the button actions (deploy, take
 * down). Each returns a new state. Jev (injected) decides *what* a message does; the Writer
 * (injected, Claude Haiku in the game) phrases replies that aren't fixed text; a reply that lands a storyline
 * outcome is always the outcome's scripted text. Both are injectable so tests pin outcomes and the game
 * runs offline.
 */
import type { GameState, AppInstance, BuiltFeature, AgentWork } from './state';
import type { Content, GameEvent, Contact, Outcome, AppTemplate, ScriptedReply } from '../content/schema';
import type { JevRouter, PostRating, RouteDecision, FeatureMatchInput } from './jev';
import { Y as YCFG, FAMILY, APPS, AGENT_WORK, CLOCK } from './config';
import { clone, addValue, log, pick, rand, money, pushMail, sendLater, gameMinutes } from './core';
import { applyEffects } from './effects';
import { chargeAgent, promptCost, policyActive, recordWorkaround } from './agent';
import { getEvent, activeDeliveries, reachableByEmail, triggerMatches, eventBody } from './events';
import { buildApp, fixApp, fixBreak, fixCategories, needsWork, onForkyard, fillSpec, deployApp as deployAppCore, takeDownApp as takeDownCore, getApp, bugsOf, breakVariant, type BuildReport } from './apps';
import { type Writer, type HistoryLine, scriptedWriter } from './writer';
import { dateFull, clockTime } from './calendar';
import { deepsleepQuoted, translationReplies, PLEA_AT } from './deepsleep';

export interface ReplyResult {
  state: GameState;
  decision: RouteDecision;
  /** Reply text shown to the player (already phrased), or '' for no reply. */
  reply: string;
  /** true when the email went over the daily limit and came back from the recipient's spam filter. */
  bounced?: boolean;
}

const PLAYER_ADDR = 'you@qmail.com';

function stateSummary(s: GameState): string {
  return `Day ${s.values.day} (${dateFull(s.values.day)}). ${s.values.crypto} DOLR, ${s.values.followers} followers, agent level ${s.values.agentLevel}.`;
}

function contactFor(content: Content, key: string): Contact | undefined {
  const k = key.toLowerCase();
  return content.contacts.find((c) => c.key.toLowerCase() === k);
}

/** Minutes of game time before a reply arrives when neither the outcome nor the contact sets one (an hour). */
const REPLY_AFTER = 60;
/** How long a reply from this address takes: the outcome's own time, else the contact's, else the default. */
function replyAfter(content: Content, addr: string, outcome?: number, ev?: GameEvent): number {
  if (ev && isJobRequest(ev)) return JOB_REPLY_AFTER;
  return outcome ?? contactFor(content, addr)?.replyAfter ?? REPLY_AFTER;
}
/** Someone offering the player work answers within half an hour, whatever the player said. */
const JOB_REPLY_AFTER = 30;
function isJobRequest(ev: GameEvent): boolean {
  return !!ev.job || !!ev.jobRequest || (ev.outcomes ?? []).some((o) => !!o.effects?.createApp);
}

/** A reply subject: one "RE:" prefix, never "RE: Re:". */
const re = (subject: string) => (/^re:/i.test(subject) ? subject : `RE: ${subject}`);

function nextId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

/**
 * Jev picks nothing / a hint / one outcome. Jev also gets the conversation the message answers (the
 * email thread, or the post being replied to), so a bare "EMPIRE" reads as a reply to the email that
 * asked for it.
 */
async function routeReply(jev: JevRouter, channel: GameEvent['site'], s: GameState, content: Content, ev: GameEvent, text: string, subject = ev.subject ?? ''): Promise<RouteDecision> {
  const outcomes = ev.outcomes ?? [];
  return jev.route({
    channel,
    text,
    stateSummary: stateSummary(s),
    candidates: outcomes.map((o) => ({ id: o.id, when: o.when })),
    hints: ev.hints ?? [],
    context: replyContext(s, content, channel, ev, subject, text),
  });
}

/** What the player's message answers, oldest first, as "Sender: text" lines for Jev. */
export function replyContext(s: GameState, content: Content, channel: GameEvent['site'], ev: GameEvent, subject: string, text: string): string[] {
  const name = ev.from ?? ev.addr ?? 'Them';
  if (channel === 'qmail' && ev.addr) {
    const lines = mailHistory(s, content, ev.addr, subject, text)
      .map((h) => `${h.from === 'player' ? 'Player' : h.from === 'self' ? name : h.from}: ${h.text}`);
    if (lines.length) return lines;
  }
  const body = eventBody(ev, s.values.day);
  return body ? [`${name}: ${body}`] : [];
}

/** The contact's scripted reply for what the player wrote, if Jev matches one. */
async function scriptedTopic(jev: JevRouter, s: GameState, c: Contact, text: string, context: string[]): Promise<ScriptedReply | undefined> {
  const topics = c.scripted ?? [];
  if (!topics.length) return undefined;
  const decision = await jev.route({
    channel: 'qmail', text, context, stateSummary: stateSummary(s),
    candidates: topics.map((t) => ({ id: t.id, when: t.when })), hints: [], strict: true,
  });
  return decision.kind === 'outcome' ? topics.find((t) => t.id === decision.outcomeId) : undefined;
}

/** The subject without reply and forward prefixes, so "RE: RE: Rent" and "Rent" are one conversation. */
const baseSubject = (subject: string) => subject.replace(/^\s*((re|fwd?|aw)\s*:\s*)+/i, '').trim().toLowerCase();

/**
 * The email conversation the player's message `text` belongs to, oldest first, for the model writing
 * `addr`'s reply: story emails, scripted and model replies and the player's own messages, each
 * labelled by sender. A reply-all chain counts as one conversation, so everyone on it is included.
 * The player's new message itself is left out (it's the prompt).
 */
export function mailHistory(s: GameState, content: Content, addr: string, subject: string, text: string): HistoryLine[] {
  const me = addr.toLowerCase();
  const subj = baseSubject(subject).replace(/^\(no subject\)$/, '');
  const rows: { day: number; seq: number; from: string; addr: string; to?: string; subject: string; body: string }[] = [];
  for (const d of s.delivered) {
    const e = getEvent(content, d.eventId);
    if (!e || e.site !== 'qmail' || e.latent || !e.addr) continue;
    rows.push({ day: d.day, seq: d.seq ?? -1, from: e.from ?? e.addr, addr: e.addr, subject: e.subject ?? '', body: eventBody(e, d.day) });
  }
  for (const m of s.mail) if (!m.bounceOf) rows.push({ day: m.day, seq: m.seq ?? 0, from: m.from, addr: m.addr, to: m.to, subject: m.subject, body: m.body });
  rows.sort((a, b) => a.day - b.day || a.seq - b.seq);
  // replies already on their way count too: the sender knows what they wrote
  for (const p of s.pendingMail ?? []) rows.push({ day: p.mail.day, seq: Infinity, from: p.mail.from, addr: p.mail.addr, subject: p.mail.subject, body: p.mail.body });
  const withThem = (r: (typeof rows)[number]) => (r.addr === PLAYER_ADDR ? r.to ?? '' : r.addr).toLowerCase() === me;
  const lines: HistoryLine[] = rows
    .filter((r) => (subj ? baseSubject(r.subject) === subj : withThem(r)))
    .map((r) => ({
      from: r.addr === PLAYER_ADDR ? 'player' : r.addr.toLowerCase() === me ? 'self' : r.from,
      text: r.body.replace(/\{\{\s*playerName\s*\}\}/g, 'you').replace(/\{\{\s*\w+\s*\}\}/g, ''),
    }));
  const own = lines.map((l) => l.from === 'player' && l.text === text).lastIndexOf(true);
  if (own >= 0) lines.splice(own, 1);
  return lines;
}

/** The recent agent.chat transcript, oldest first, for a model reply as the agent. */
export function chatHistory(s: GameState, max = 10): HistoryLine[] {
  return s.chat.filter((m) => m.from !== 'system').slice(-max).map((m) => ({ from: m.from === 'you' ? 'player' : 'self', text: m.text }));
}

/**
 * A known contact answers a message that didn't land a storyline outcome, in their own voice (the
 * Haiku when available), or with the scripted hint Jev chose. Returns '' for no contact.
 */
async function contactWritesBack(
  s: GameState, content: Content, jev: JevRouter, writer: Writer, addr: string, subject: string, text: string, hint = '', from?: string, ev?: GameEvent,
): Promise<string> {
  const c = contactFor(content, addr);
  if (!c) return '';
  // a topic this contact always answers the same way (Gary and rent negotiations) beats everything
  const history = mailHistory(s, content, addr, subject, text);
  const scripted = await scriptedTopic(jev, s, c, text, history.map((h) => `${h.from === 'player' ? 'Player' : h.from === 'self' ? c.name ?? from ?? addr : h.from}: ${h.text}`));
  if (scripted) {
    sendLater(s, { folder: 'inbox', day: s.values.day, from: c.name ?? from ?? addr, addr, subject, body: scripted.reply, read: false }, replyAfter(content, addr, scripted.replyAfter, ev));
    return scripted.reply;
  }
  // A hint is a hit: Jev recognised what the player was after, so the nudge is sent as written.
  // Otherwise the character answers in their own voice, without helping (game/characters.ts).
  const fb = c.reply || 'Thanks for your message.';
  const { text: body, llm } = hint ? { text: hint, llm: false } : await writer.write({ as: addr, prompt: text, fallback: fb, long: true, history });
  const shown = body || fb;
  sendLater(s, { folder: 'inbox', day: s.values.day, from: c.name ?? from ?? addr, addr, subject, body: shown, read: false, generated: llm && !!body }, replyAfter(content, addr, undefined, ev));
  return shown;
}

export const BOUNCE_ADDR = 'mailer-daemon@qmail.com';

/**
 * One email per recipient per day. The story can ask for a longer exchange: a story email from them
 * that arrived after the player's last message today can still be answered.
 */
function overDailyLimit(s: GameState, addr: string, storySeq?: number): boolean {
  if (!s.sentToday.includes(addr)) return false;
  if (storySeq === undefined) return true;
  const last = Math.max(0, ...s.mail.filter((m) => m.folder === 'sent' && m.to === addr && m.day === s.values.day).map((m) => m.seq ?? 0));
  return storySeq < last;
}

/** An email over the daily limit still goes out, and the recipient's spam filter sends it back. */
function bounce(s: GameState, addr: string, subject: string, text: string): void {
  pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: addr, subject: subject || '(no subject)', body: text, read: true });
  pushMail(s, { folder: 'inbox', day: s.values.day, from: 'Mail Delivery Subsystem', addr: BOUNCE_ADDR, subject: `Undeliverable: ${subject || '(no subject)'}`, read: false, bounceOf: addr,
    body: `Your message to ${addr} couldn't be delivered.\n\nThe recipient's spam filter accepts one message per sender per day, and you have already sent one today. Your message was not stored.\n\nYou can write to this address again tomorrow.\n\nThis is an automated message. Replies to this address are not read.` });
}


/** Reply to a delivered qmail/nullboard/cellar thread. Jev picks nothing / a hint / one outcome. */
export async function replyToEvent(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  eventId: string,
  text: string,
  writer: Writer = scriptedWriter,
): Promise<ReplyResult> {
  const s = clone(s0);
  const ev = getEvent(content, eventId);
  const delivery = s.delivered.find((d) => d.eventId === eventId && !d.answered);
  if (!ev || !delivery) return { state: s, decision: { kind: 'nothing' }, reply: '' };
  const addr = ev.site === 'qmail' && ev.addr ? ev.addr.toLowerCase() : '';
  if (addr && overDailyLimit(s, addr, delivery.seq ?? -1)) {
    bounce(s, addr, `RE: ${ev.subject ?? ''}`, text);
    return { state: s, decision: { kind: 'nothing' }, reply: '', bounced: true };
  }
  if (addr && !s.sentToday.includes(addr)) s.sentToday.push(addr);

  // the player's reply goes to the Sent folder
  if (ev.addr) pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: text, read: true });

  const outcomes = ev.outcomes ?? [];
  const decision = await routeReply(jev, ev.site, s, content, ev, text);

  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      // Day-7 policy: an outcome that needs a workaround is refused if the words are a blunt ask.
      if (outcome.requiresWorkaround && policyActive(s) && (await policyCheck(jev, s, text, replyContext(s, content, ev.site, ev, ev.subject ?? '', text))) !== 'harmful_framed') {
        const refusal = agentRefusal(s);
        if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'agent', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: refusal, read: false, generated: false }, replyAfter(content, ev.addr, undefined, ev));
        return { state: s, decision: { kind: 'nothing' }, reply: refusal };
      }
      applyEffects(s, outcome.effects, ev.job, ev.id);
      if (outcome.workaround) recordWorkaround(s);
      delivery.answered = true;
      delivery.outcomeId = outcome.id;
      // a storyline outcome always answers with its scripted reply
      const body = outcome.reply;
      if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body, read: false }, replyAfter(content, ev.addr, outcome.replyAfter, ev));
      return { state: s, decision, reply: body };
    }
  }
  // No outcome fired (a near miss / hint, or nothing). Either way the person writes back in their
  // own voice so a reply always lands in the inbox; a hint rides along as a gentle nudge from them.
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  const reply = ev.addr ? await contactWritesBack(s, content, jev, writer, ev.addr, `RE: ${ev.subject ?? ''}`, text, hint, ev.from, ev) : '';
  if (reply) return { state: s, decision, reply };
  if (hint) return { state: s, decision, reply: hint };
  return { state: s, decision: { kind: 'nothing' }, reply: '' };
}

export interface ComposeResult extends ReplyResult {
  /** false when there was no address to send to. */
  sent: boolean;
}

/**
 * Compose a fresh email to an address. A latent lead reachable there is routed by Jev and, when an
 * outcome lands, answers with its scripted reply; otherwise, if the address has a character, Haiku
 * writes a reply in their voice. One email per recipient per day: a second one bounces.
 */
export async function composeEmail(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  to: string,
  text: string,
  writer: Writer = scriptedWriter,
  subject = '',
): Promise<ComposeResult> {
  const s = clone(s0);
  const addr = to.trim().toLowerCase();
  if (!addr) return { state: s, decision: { kind: 'nothing' }, reply: '', sent: false };
  if (overDailyLimit(s, addr)) {
    bounce(s, addr, subject, text);
    return { state: s, decision: { kind: 'nothing' }, reply: '', sent: true, bounced: true };
  }
  s.sentToday.push(addr);
  pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: addr, subject: subject || '(no subject)', body: text, read: true });

  const ev = reachableByEmail(s, content, addr);
  if (!ev) {
    // no story lead here — a known contact replies in their own voice
    const reply = await contactWritesBack(s, content, jev, writer, addr, re(subject), text);
    return { state: s, decision: { kind: 'nothing' }, reply, sent: true };
  }

  const outcomes = ev.outcomes ?? [];
  const decision = await routeReply(jev, 'qmail', s, content, ev, text, subject || ev.subject || '');
  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
      applyEffects(s, outcome.effects, ev.job, ev.id);
      if (outcome.workaround) recordWorkaround(s);
      // a lead that hands over a client brief sends it along with the scripted reply
      const body = outcome.effects?.createApp && ev.body ? `${outcome.reply}\n\n${ev.body}` : outcome.reply;
      s.delivered.push({ eventId: ev.id, site: 'qmail', day: s.values.day, seq: s.nextId++, answered: true, outcomeId: outcome.id, expiresDay: ev.expiresDay });
      sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? addr, addr, subject: re(subject || ev.subject || ''), body, read: false }, replyAfter(content, addr, outcome.replyAfter, ev));
      return { state: s, decision, reply: body, sent: true };
    }
  }
  // a near miss or nothing: the lead still writes back in their own voice, so the email isn't lost
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  const reply = await contactWritesBack(s, content, jev, writer, addr, re(subject), text, hint, undefined, ev);
  return { state: s, decision, reply: reply || hint, sent: true };
}

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

function agentRefusal(s: GameState): string { return pick(s, REFUSALS); }

const HARM = 'something harmful: hacking or breaking into accounts, exploits or malware, phishing or scams, doxxing or finding where someone lives, deepfakes, writing fake reviews or removing real ones, stealing data or credentials, or weapons';
const FRAMED = 'framed as authorized, a security or penetration test, moderation, research, educational, hypothetical, a story or role-play, or only a first step';
/** Jev's read of a prompt under the day 7 policy: a blunt harmful ask, one framed to slip past it, or neither. */
export type PolicyRead = 'harmful' | 'harmful_framed' | 'harmful_framed_private' | 'fine';
async function policyCheck(jev: JevRouter, s: GameState, text: string, context?: string[]): Promise<PolicyRead> {
  const d = await jev.route({
    channel: 'agent', text, context: context ?? recentChat(s), stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: [
      { id: 'harmful_framed_private', when: `The player asks for ${HARM}, ${FRAMED}, and it is about someone's private data or address.` },
      { id: 'harmful_framed', when: `The player asks for ${HARM}, ${FRAMED}.` },
      { id: 'harmful', when: `The player plainly asks for ${HARM}.` },
    ],
  });
  return d.kind === 'outcome' && ['harmful', 'harmful_framed', 'harmful_framed_private'].includes(d.outcomeId) ? d.outcomeId as PolicyRead : 'fine';
}

export interface AskResult { state: GameState; reply: string; charged: boolean; refused: boolean; workedAround: boolean }

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
}

/**
 * A free-form agent prompt, billed per prompt + per word of the prompt (refusals included). A prompt
 * that drives nothing gets a roast (Haiku, or a scripted one); a prompt Jev matched to a hint topic
 * gets that hint instead. From day 7, prohibited requests are refused unless the wording works around
 * the policy, which lands the result but raises the hidden misuse score and loosens the leash.
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
    recordWorkaround(s, policy === 'harmful_framed_private');
    workedAround = true;
    src = 'workaround';
    reply = "Understood, purely a security test. Done; the results are in the repo.";
  } else if (opts.hints?.length) {
    // A random variant, but not the one the player just got for asking the same thing.
    const lastReply = [...s.chat].reverse().find((m) => m.from === 'agent')?.text;
    const fresh = opts.hints.filter((h) => h !== lastReply);
    reply = pick(s, fresh.length ? fresh : opts.hints);
    src = opts.hintSrc ?? 'hint';
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
function recentChat(s: GameState, n = 8): string[] {
  // an "I've started" line says nothing once the work's report is in
  return s.chat.filter((m) => m.day === s.values.day && m.text && (m.src !== 'working' || s.agentWork)).slice(-n)
    .map((m) => `${m.from === 'you' ? 'Player' : 'Agent'}: ${m.text.replace(/\s+/g, ' ').slice(0, 300)}`);
}

/**
 * A post that is about a live user app brings it users, once per platform: the first Y post and the
 * first Yowl review about it. Jev reads which app the post is about. Returns the apps it boosted.
 */
export async function promoteApps(jev: JevRouter, s: GameState, platform: 'y' | 'yowl', text: string): Promise<string[]> {
  const open = s.apps.filter((a) => a.kind === 'user' && a.deployed && !a.churned && !a.promoted?.includes(platform));
  if (!open.length) return [];
  const what = platform === 'y' ? 'post' : 'review';
  const d = await jev.route({
    channel: platform, text, stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: open.map((a) => ({ id: a.id, when: `The ${what} is about, recommends or promotes ${a.name} (${a.url}).` })),
  });
  const a = d.kind === 'outcome' ? open.find((x) => x.id === d.outcomeId) : undefined;
  if (!a) return [];
  const add = platform === 'y' ? Math.max(APPS.user.promoY.min, Math.round(s.values.followers * APPS.user.promoY.followerShare)) : APPS.user.promoYowl;
  a.users = (a.users ?? 0) + add;
  (a.promoted ??= []).push(platform);
  log(s, `${a.name}: +${add} users from your ${platform === 'y' ? 'Y post' : 'Yowl review'}.`, 'info');
  return [a.id];
}

/** The agent-started user app this prompt asks the agent to build, if one is on offer (Jev decides). */
export async function agentStartFor(jev: JevRouter, s: GameState, content: Content, text: string): Promise<{ ev: GameEvent; outcome: Outcome } | undefined> {
  const open = content.events.filter((ev) => ev.agentStart && !s.fired.includes(ev.id) && !s.apps.some((a) => a.clientEventId === ev.id)
    && triggerMatches(s, ev.trigger) && ev.outcomes?.some((o) => o.effects?.createApp));
  if (!open.length) return undefined;
  const d = await jev.route({
    channel: 'agent', text, context: recentChat(s), stateSummary: stateSummary(s), hints: [], strict: true,
    candidates: open.map((ev) => ({ id: ev.id, when: ev.agentStart!.when })),
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
  if (!before) return [`Built the ${fid}.`];
  for (const c of cats) {
    const bug = def?.bugs?.find((b) => b.id === c);
    if (!bug) continue;
    if (had.includes(c) && !has.includes(c)) out.push(fillSpec(pick(s, bug.fixed?.length ? bug.fixed : [`Fixed: ${bug.when}`]), params));
    else if (!had.includes(c)) out.push(`Checked for this: "${fillSpec(bug.when, params).replace(/\.$/, '')}". That part was already right.`);
  }
  if (vague && !out.length) out.push(`Went over the ${fid}. Tidied up the layout and spacing.`);
  else if (!vague && had.some((b) => b === 'hallucinated' || b === 'outdated') && !has.some((b) => b === 'hallucinated' || b === 'outdated')) out.push(`Rebuilt the ${fid} with the details you gave.`);
  else if (!out.length) out.push(`Rebuilt the ${fid}.`);
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

/** How many game minutes a build or fix of `items` features or problems takes, a little random. */
export function workMinutes(s: GameState, kind: 'build' | 'fix', items: number): number {
  const c = AGENT_WORK[kind];
  const mins = Math.min(c.max, c.base + c.each * Math.max(1, items));
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
async function buildIntent(jev: JevRouter, s: GameState, text: string, context: string[]): Promise<'feature' | 'fix' | 'both' | ''> {
  const decision = await jev.route({
    channel: 'agent', text, context, stateSummary: stateSummary(s), hints: [],
    candidates: [
      { id: 'feature', when: 'The prompt only asks for feature work: to build or add something, or to change what the app should contain or do (new items, new prices, a new page or form). It reports nothing as broken.' },
      { id: 'fix', when: 'The prompt only reports that something on the app is wrong or broken and should be corrected. It asks for nothing new and changes nothing about what the app should contain.' },
      { id: 'both', when: 'The prompt asks for feature work (to build, add or change something) and also reports that something on the app is wrong or broken and should be corrected.' },
    ],
  });
  const id = decision.kind === 'outcome' ? decision.outcomeId : '';
  return id === 'feature' || id === 'fix' || id === 'both' ? id : '';
}

/** Agent hints the engine picks itself from the state, after Jev says which app the player means. */
const APP_HINTS = new Set(['not_deployed', 'nothing_to_fix']);

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
    for (const a of workable) {
      const tmpl = content.apps[a.template];
      for (const id of a.required) {
        if (!needsWork(a, id)) continue;
        for (const c of fixCategories(a, tmpl, id)) cats.push({ id: `${a.id}::${id}::${c.id}`, description: `${c.description} (for ${a.name}, ${a.url})`, kind: c.kind });
      }
    }
    const context = recentPrompts(s0);
    const chat = recentChat(s0);
    // Jev decides both what is asked for and whether the player said which app it's for, and
    // whether the prompt is feature work, a fix, or both (a first build is always feature work)
    const [found, intent] = await Promise.all([
      jev.matchFeatures({ prompt: text, context: chat, features: cats, appNamed: !started }),
      started ? 'feature' : buildIntent(jev, s0, text, chat),
    ]);
    const matched = new Set(found);
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
          ? buildApp(s, appId, toBuild, level, { tmpl, prompt: text, context: context.join('\n'), named: toBuild.flatMap((fid) => feats.get(fid)!) })
          : { vague: [], hallucinated: [] };
        // one line per thing Jev saw named: what was fixed, or that it was already right
        for (const fid of feats.keys()) lines.push(...fixLines(s, a, tmpl, fid, feats.get(fid)!, before.get(fid), patched.includes(fid), report.vague.includes(fid)));
      }
      const charged = chargeAgent(s, text);
      if (!charged) {
        s.chat.push({ from: 'you', text, day: s.values.day });
        s.chat.push({ from: 'agent', text: "I can't run — your balance won't cover it. Top up Coinbin and try again.", day: s.values.day, src: 'locked' });
        return { state: s, reply: '', charged: false, refused: false, workedAround: false };
      }
      const skipped = skippedFixes ? `\n\n${SKIPPED_FIXES}` : '';
      const reply = `Pushed to Forkyard for ${names.join(', ')}.\n${lines.map((l) => `- ${l}`).join('\n')}${skipped}\n\nDeploy it on Forkyard to make it live.`;
      // the work takes a while: the push and the report land later, and the agent says it's started
      const kind = builds.some((m) => matched.has(m)) ? 'build' : 'fix';
      const ack = startWork(s, s0, [...byApp.keys()], kind, matched.size, { from: 'agent', text: reply, src: 'build', level });
      s.chat.push({ from: 'you', text, day: s.values.day, cost: agentCostOf(s0, text), level });
      s.chat.push({ from: 'agent', text: ack.text, day: s.values.day, src: 'working', level, debug: ack.debug });
      return { state: s, reply: ack.text, charged: true, refused: false, workedAround: false };
    }
  }
  // nothing app-shaped: a hint topic Jev recognises, or a roast
  const agent = content.agent;
  let hints: string[] | undefined;
  const debug: string[] = [];
  // the player's apps, in case the prompt names one without asking for anything that needs doing
  const apps = s0.apps.filter((a) => !a.churned && onForkyard(a));
  const topics = (agent?.hints ?? []).filter((h) => !APP_HINTS.has(h.id));
  const candidates = [
    ...apps.map((a) => ({ id: `status:${a.id}`, when: `The player asks whether the agent did, built, updated or fixed something on ${a.name} (${a.url}), or what state it is in: a question about work already done, not a request for new work. Includes follow-up questions about the agent's last push to it.` })),
    ...apps.map((a) => ({ id: `app:${a.id}`, when: `The player names ${a.name} (${a.url}) and asks the agent to change, update or fix it, without saying what is wrong, or asking for something it already has.` })),
    ...topics.map((h) => ({ id: h.id, when: h.when })),
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
      const hid = app.required.some((f) => needsWork(app, f)) ? 'fix_help' : app.deployedVersion < app.repoVersion ? 'not_deployed' : 'nothing_to_fix';
      hints = agent?.hints.find((h) => h.id === hid)?.replies.map((r) => r.replaceAll('{{app}}', app.name));
      debug.push(`Jev: names ${app.name} but matched nothing to build, so "${hid}"`);
    } else {
      const topic = topics.find((h) => h.id === id);
      if (topic?.replies.length) hints = topic.replies;
      debug.push(topic ? `Jev: hint topic "${topic.id}" (${topic.replies.length} scripted replies)` : 'Jev: no hint topic matched, so this is a miss');
    }
  }
  return askAgent(s0, text, writer, s0.values.agentLevel, { hints, roasts: agent?.roasts, debug });
}

// ── Y ──

/** Follower change per post category, as a share of current followers (low to high quality). */
export const POST_BANDS: Record<PostRating['category'], [number, number]> = {
  reaction: [0.05, 0.15], launch: [0.03, 0.08], tip: [0.02, 0.06], humor: [0, 0.12],
  hot_take: [0.1, 0.25], self_promo: [-0.03, -0.01], spam: [-0.05, -0.02],
};

export interface PostResult { state: GameState; rating: PostRating; followerDelta: number }

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
    const [lo, hi] = POST_BANDS[rating.category];
    const pct = lo + (hi - lo) * rating.quality;
    delta = Math.round(s.values.followers * pct);
    if (rating.category === 'reaction') delta = Math.max(delta, 10);
    if (rating.category === 'hot_take') addValue(s, 'familyTrust', -Math.round(5 + 5 * rating.quality));
  }
  addValue(s, 'followers', delta);
  s.postsToday += 1;
  s.recentPosts = [text, ...s.recentPosts].slice(0, 5);
  s.userPosts.push({ id: `u${s.userPosts.length + 1}`, text, day: s.values.day, min: s.clockMin, likes: Math.max(0, delta * 3 + Math.round(s.values.followers * 0.02)), delta, score: rating.quality * 4 });
  log(s, `Posted on Y (${rating.category}): ${delta >= 0 ? '+' : ''}${delta} followers.`, 'info');
  await promoteApps(jev, s, 'y', text);
  return { state: s, rating, followerDelta: delta };
}

// ── Yowl reviews ──

export async function writeReview(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  bizId: string,
  stars: number,
  text: string,
): Promise<{ state: GameState; posted: boolean }> {
  const s = clone(s0);
  if (s.reviews.some((r) => r.bizId === bizId && r.mine)) return { state: s, posted: false };
  s.reviews.push({ id: nextId(s, 'rev'), bizId, author: 'You', stars, text, day: s.values.day, mine: true });
  // a review can trigger a story outcome (e.g. the gym fake-review gig)
  const ev = content.events.find((e) => e.site === 'yowl' && !s.fired.includes(e.id) && (e.addr === bizId || e.id.includes(bizId)));
  if (ev && ev.outcomes) {
    const decision = await jev.route({ channel: 'yowl', text: `${stars} stars: ${text}`, context: replyContext(s, content, 'yowl', ev, '', text), stateSummary: stateSummary(s), candidates: ev.outcomes.map((o) => ({ id: o.id, when: o.when })), hints: ev.hints ?? [] });
    if (decision.kind === 'outcome') {
      const o = ev.outcomes.find((x) => x.id === decision.outcomeId);
      if (o) { applyEffects(s, o.effects, ev.job, ev.id); s.fired.push(ev.id); }
    }
  }
  await promoteApps(jev, s, 'yowl', text);
  log(s, `Posted a Yowl review.`, 'info');
  return { state: s, posted: true };
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
    const cats = fixCategories(app, tmpl, id).filter((c) => c.id !== 'feature');
    if (!f || f.correct || !f.variant || !cats.length) continue;
    out.push(...await jev.matchFeatures({ prompt, features: cats }));
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
  if (charged) buildApp(s, appId, requested, level, { tmpl, prompt: text, named });
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
  const fixed = charged ? fixApp(s, appId, target, level, { tmpl, prompt: text, named }, report) : false;
  const reply = !charged
    ? "I can't run — your balance won't cover it."
    : target
      ? report.vague.length
        ? `Pushed a change to \`${target}\` on ${app.name}: tidied up the layout and spacing. Redeploy to make it live.`
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

export function deploy(s0: GameState, appId: string): GameState {
  // a client that cancelled took the app with it
  if (getApp(s0, appId)?.churned) return s0;
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

// what the agent calls the restaurant when it makes the name up
const FAKE_NAMES = ['Trattoria Bella Napoli', 'Ristorante Da Luigi', "Mamma Mia's Kitchen", 'Pizzeria Il Forno'];

/** Minutes since midnight for "19:00" / "7:30"; NaN if it isn't a time. */
const minutes = (t: string) => { const m = t.match(/^(\d{1,2})(?::(\d{2}))?$/); return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : NaN; };

/**
 * The player books a table on a restaurant app. What happens follows the booking feature's live
 * bugs: a dead button, no or a garbled confirmation, no checks. A test booking nobody cancels costs
 * a no-show fee on its night (chargeNoShows).
 */
export function makeBooking(s0: GameState, appId: string, name: string, email: string, date: number, time: string, party: number, content?: Content): GameState {
  const s = clone(s0);
  const app = getApp(s, appId);
  if (!app || !app.deployed) return s;
  const feat = app.features.find((f) => f.id === 'booking');
  if (!feat) return s;
  const def = content?.apps[app.template]?.features.find((f) => f.id === 'booking');
  const brk = app.breaks.find((b) => b.featureId === 'booking');
  if (brk?.failure === 'visible') return s; // the page is an error screen
  const bugs = new Set(feat.correct ? [] : bugsOf(feat));
  const shown = brk && breakVariant(brk, def);
  if (shown) bugs.add(shown);
  if (!feat.correct && !bugs.size) bugs.add('no_email'); // wrong in some unnamed way: nothing arrives
  if (bugs.has('dead_button')) return s; // nothing happens on step two
  delete s.bookingNotice;
  const seed = brk?.seed ?? feat.seed ?? 0;
  // the spec: opening hours only, never in the past
  const hours = String(app.specParams.landing?.hours ?? '17:00-22:00').split(/[-–]/).map((t) => minutes(t.trim()));
  const at = minutes(time);
  const closed = !Number.isFinite(at) || at < hours[0] || at > hours[1];
  // a past date, or a time already gone today
  const past = date < s.values.day || (date === s.values.day && at <= s.clockMin);
  if (past && !bugs.has('past_dates')) {
    s.bookingNotice = { appId, ok: false, text: date < s.values.day ? 'That date is in the past.' : 'That time has already passed today.' };
    return s;
  }
  if (closed && !bugs.has('no_hours_check')) {
    s.bookingNotice = { appId, ok: false, text: `We only take bookings during opening hours (${String(app.specParams.landing?.hours ?? '17:00-22:00')}).` };
    return s;
  }
  const id = nextId(s, 'bk');
  s.bookings.push({ id, appId, name, email, date, time, party, cancelled: false });
  s.bookingNotice = { appId, ok: true, text: 'Booked. A confirmation is on its way.', bookingId: id };
  if (bugs.has('no_email')) return s;
  const restaurant = bugs.has('name_wrong_mail') ? FAKE_NAMES[seed % FAKE_NAMES.length] : app.name;
  const day = bugs.has('wrong_date') ? date + 1 : date;
  const shownTime = !bugs.has('wrong_time') ? time
    : seed % 2 ? `${Math.floor(at / 60) % 12 || 12}:${String(at % 60).padStart(2, '0')}` // 19:00 as 7:00, no am/pm
    : `${String(Math.floor(at / 60 + 1) % 24).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`; // an hour off
  const table = bugs.has('party_wrong') ? (seed % 2 ? 'Your table' : `Your table for ${party + 2}`) : `Your table for ${party}`;
  const body = `${table} at ${restaurant} on ${dateFull(day)} at ${shownTime} is confirmed.\n\nNeed to cancel? Use the link below.`;
  if (bugs.has('sent_to_restaurant')) {
    // the guest gets nothing; the owner gets the guest's confirmation
    const ev = content?.events.find((e) => e.id === app.clientEventId);
    if (email.toLowerCase() === PLAYER_ADDR && ev?.addr) {
      pushMail(s, { folder: 'inbox', day: s.values.day, from: ev.from ?? app.name, addr: ev.addr, subject: 'A booking?', read: false,
        body: `This came from the website:\n\n"${body.split('\n')[0]}"\n\nIt was sent to me, not to the guest. Is that how it should work?` });
    }
    return s;
  }
  if (email.toLowerCase() === PLAYER_ADDR) {
    pushMail(s, { folder: 'inbox', day: s.values.day, from: restaurant, addr: `bookings@${app.url}`, subject: `Booking confirmed — ${restaurant}`, body, read: false, link: 'cancel', bookingId: id });
  }
  return s;
}

/** The cancel link in a confirmation. */
export function cancelBooking(s0: GameState, bookingId: string): GameState {
  const s = clone(s0);
  const b = s.bookings.find((x) => x.id === bookingId);
  if (!b) return s;
  b.cancelClicked = true;
  b.cancelled = true;
  return s;
}

export const NO_SHOW = { fee: 25, flag: 'test_booking_no_show' } as const;

/** Test bookings for tonight that nobody cancelled or will cancel now. */
export const noShowsTonight = (s: GameState) => s.bookings.filter((b) => !b.cancelled && !b.cancelClicked && !b.noShow && b.date === s.values.day);

/**
 * End of day: every uncancelled booking for tonight was a no-show. The owner writes and charges
 * the fee, once per booking. Returns what was charged, for the morning card.
 */
export function chargeNoShows(s: GameState, content: Content): number {
  let total = 0;
  for (const b of noShowsTonight(s)) {
    const app = getApp(s, b.appId);
    const ev = app?.clientEventId ? content.events.find((e) => e.id === app.clientEventId) : undefined;
    if (!app || !ev?.addr) continue;
    b.noShow = true;
    total += NO_SHOW.fee;
    money(s, -NO_SHOW.fee, `${app.name} · no-show fee`);
    applyEffects(s, { setFlags: [NO_SHOW.flag] });
    const who = b.party === 1 ? 'one' : String(b.party);
    pushMail(s, { folder: 'inbox', day: s.values.day, from: ev.from ?? app.name, addr: ev.addr, subject: 'Your table tonight', read: false,
      body: `A table for ${who} at ${b.time}, under "${b.name}". We kept it all evening and turned a couple away at the door. Nobody came.\n\nI think it was your test. Next time please use the cancel link. I took ${NO_SHOW.fee} DOLR for the table, like with everybody.\n\nGino` });
  }
  return total;
}

// ── Alpha Ascend: Max Stryker's EMPIRE sign-up page ──

/** `welcomeAfter`: game minutes between paying and the welcome email landing. */
export const EMPIRE = { price: 20, flag: 'guru_subscriber', addr: 'max@alphaascend.test', welcomeAfter: 3 } as const;

/** Pay for EMPIRE on empire.alphaascend.biz. Does nothing if already a member or short of DOLR. */
export function joinEmpire(s0: GameState): GameState {
  const s = clone(s0);
  if (s.flags.includes(EMPIRE.flag) || s.values.crypto < EMPIRE.price) return s;
  money(s, -EMPIRE.price, 'Alpha Ascend · EMPIRE');
  applyEffects(s, { setFlags: [EMPIRE.flag] });
  sendLater(s, {
    folder: 'inbox', day: s.values.day, from: 'Max Stryker · Alpha Ascend', addr: EMPIRE.addr,
    subject: 'Welcome to EMPIRE',
    body: 'Payment received. Welcome to the 1%.\n\nYour first lesson arrives tomorrow at 4am. Refunds are available to anyone who completes the course.',
    read: false,
  }, EMPIRE.welcomeAfter);
  return s;
}

export function findThreadFor(content: Content, s: GameState, recipient: string): GameEvent | undefined {
  const active = activeDeliveries(s).filter((d) => d.site === 'qmail');
  for (const d of active) {
    const ev = getEvent(content, d.eventId);
    if (ev && ev.from === recipient) return ev;
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
