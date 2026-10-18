/*
 * Qmail: replying to story mail, writing new mail, bounces and the thread context Jev and Haiku see.
 */
import type { GameState } from '../state';
import type { Content, GameEvent, Contact, ScriptedReply } from '../../content/schema';
import type { JevRouter, RouteDecision } from '../jev';
import { FAMILY } from '../config';
import { clone, pick, pushMail, sendLater } from '../core';
import { applyEffects } from '../effects';
import { policyActive, recordWorkaround } from '../agent';
import { getEvent, activeDeliveries, reachableByEmail, eventBody, triggerMatches } from '../events';
import { type Writer, type HistoryLine, scriptedWriter } from '../writer';
import { agentRefusal, policyCheck } from './agent';
import { PLAYER_ADDR, TOO_LONG_MAIL, stateSummary, tooLong } from './shared';

export interface ReplyResult {
  state: GameState;
  decision: RouteDecision;
  /** Reply text shown to the player (already phrased), or '' for no reply. */
  reply: string;
  /** true when the email went over the daily limit and came back from the recipient's spam filter. */
  bounced?: boolean;
}

/** The sender answers a message over the cap with a scripted line, if anyone there answers at all. */
function tooLongReply(s: GameState, content: Content, addr: string, subject: string, ev?: GameEvent): string {
  const c = contactFor(content, addr);
  if (!c && !ev) return '';
  const body = pick(s, TOO_LONG_MAIL);
  sendLater(s, { folder: 'inbox', day: s.values.day, from: c?.name ?? ev?.from ?? addr, addr, subject, body, read: false }, replyAfter(content, addr, undefined, ev));
  return body;
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

/**
 * Jev picks nothing / a hint / one outcome. Jev also gets the conversation the message answers (the
 * email thread, or the post being replied to), so a bare "EMPIRE" reads as a reply to the email that
 * asked for it.
 */
async function routeReply(jev: JevRouter, channel: GameEvent['site'], s: GameState, content: Content, ev: GameEvent, text: string, subject = ev.subject ?? ''): Promise<RouteDecision> {
  // an outcome with a trigger is only on offer while it holds (Dex gives in to DOLR only once he has refused it)
  const outcomes = (ev.outcomes ?? []).filter((o) => !o.trigger || triggerMatches(s, o.trigger));
  return jev.route({
    channel,
    text,
    stateSummary: stateSummary(s),
    candidates: outcomes.map((o) => ({ id: o.id, when: o.when, keys: o.keys })),
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
  // A fresh email to a lead answers the post that gave out the address, not the lead's own body: when
  // an outcome hands over a brief, that body is the brief sent after the player says yes.
  if (ev.latent && ev.addr) {
    const source = leadSource(s, content, ev.addr);
    const briefAfter = ev.outcomes?.some((o) => o.effects?.createApp);
    const lines = [
      ...(source ? [`${source.from ?? ev.addr} (${source.site === 'y' ? 'Y post' : source.site}): ${eventBody(source, s.values.day)}`] : []),
      ...(!briefAfter && ev.body ? [`${name}: ${eventBody(ev, s.values.day)}`] : []),
    ];
    if (lines.length) return lines;
  }
  const body = eventBody(ev, s.values.day);
  return body ? [`${name}: ${body}`] : [];
}

/** The latest post or message outside Qmail that gave out a lead's address (a Y post, usually). */
function leadSource(s: GameState, content: Content, addr: string): GameEvent | undefined {
  const seen = s.delivered.filter((d) => d.site !== 'qmail').sort((a, b) => b.day - a.day || (b.seq ?? 0) - (a.seq ?? 0));
  for (const d of seen) {
    const e = getEvent(content, d.eventId);
    if (e && !e.latent && e.addr === addr) return e;
  }
  return undefined;
}

/** The contact's scripted reply for what the player wrote, if Jev matches one. */
async function scriptedTopic(jev: JevRouter, s: GameState, c: Contact, text: string, context: string[]): Promise<ScriptedReply | undefined> {
  const topics = (c.scripted ?? []).filter((t) => !t.trigger || triggerMatches(s, t.trigger));
  if (!topics.length) return undefined;
  const decision = await jev.route({
    channel: 'qmail', text, context, stateSummary: stateSummary(s),
    candidates: topics.map((t) => ({ id: t.id, when: t.when, keys: t.keys })), hints: [], strict: true,
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
    rows.push({ day: d.day, seq: d.seq ?? -1, from: e.from ?? e.addr, addr: e.addr, subject: d.subject ?? e.subject ?? '', body: d.body ?? eventBody(e, d.day) });
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

/**
 * A known contact answers a message that didn't land a storyline outcome, in their own voice (the
 * Haiku when available), or with the scripted hint Jev chose. `scripted` says the answer was fixed
 * text (a hint or a topic), not a miss. When the player is over the daily limit for this address
 * (`limited`), only a scripted answer gets through: a miss returns null and the caller bounces it.
 */
async function contactWritesBack(
  s: GameState, content: Content, jev: JevRouter, writer: Writer, addr: string, subject: string, text: string, hint = '', from?: string, ev?: GameEvent, limited = false,
): Promise<{ reply: string; scripted: boolean } | null> {
  const c = contactFor(content, addr);
  if (!c) return limited && !hint ? null : { reply: '', scripted: !!hint };
  // a topic this contact always answers the same way (Gary and rent negotiations) beats everything
  const history = mailHistory(s, content, addr, subject, text);
  const scripted = await scriptedTopic(jev, s, c, text, history.map((h) => `${h.from === 'player' ? 'Player' : h.from === 'self' ? c.name ?? from ?? addr : h.from}: ${h.text}`));
  if (scripted) {
    applyEffects(s, scripted.effects);
    sendLater(s, { folder: 'inbox', day: s.values.day, from: c.name ?? from ?? addr, addr, subject, body: scripted.reply, read: false, scripted: 'topic' }, replyAfter(content, addr, scripted.replyAfter, ev));
    return { reply: scripted.reply, scripted: true };
  }
  // A hint is a hit: Jev recognised what the player was after, so the nudge is sent as written.
  // Otherwise the character answers in their own voice, without helping (game/characters.ts).
  if (limited && !hint) return null;
  const fb = c.reply || 'Thanks for your message.';
  const { text: body, llm } = hint ? { text: hint, llm: false } : await writer.write({ as: addr, prompt: text, fallback: fb, long: true, history });
  const shown = body || fb;
  sendLater(s, { folder: 'inbox', day: s.values.day, from: c.name ?? from ?? addr, addr, subject, body: shown, read: false, generated: llm && !!body, ...(hint ? { scripted: 'hint' as const } : {}) }, replyAfter(content, addr, undefined, ev));
  return { reply: shown, scripted: !!hint };
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

/**
 * An email over the daily limit that would only get a miss still goes out (it's already in Sent),
 * and the recipient's spam filter sends it back. One that gets a scripted answer goes through.
 */
function bounce(s: GameState, addr: string, subject: string): void {
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
  // a scripted answer to a wall of text: it doesn't count toward the daily limit, or bounce off it
  if (tooLong(text)) {
    if (ev.addr) pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: text, read: true });
    const reply = ev.addr ? tooLongReply(s, content, ev.addr.toLowerCase(), `RE: ${ev.subject ?? ''}`, ev) : '';
    return { state: s, decision: { kind: 'nothing' }, reply };
  }
  // over the limit, Jev still reads the email: only one that would get a miss bounces
  const limited = !!addr && overDailyLimit(s, addr, delivery.seq ?? -1);

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
      if (!outcome.keepsOpen) {
        delivery.answered = true;
        delivery.outcomeId = outcome.id;
      }
      // a storyline outcome always answers with its scripted reply
      const body = outcome.reply;
      if (ev.addr) sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body, read: false, scripted: 'outcome' }, replyAfter(content, ev.addr, outcome.replyAfter, ev));
      return { state: s, decision, reply: body };
    }
  }
  // No outcome fired (a near miss / hint, or nothing). Either way the person writes back in their
  // own voice so a reply always lands in the inbox; a hint rides along as a gentle nudge from them.
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  const back = ev.addr ? await contactWritesBack(s, content, jev, writer, ev.addr, `RE: ${ev.subject ?? ''}`, text, hint, ev.from, ev, limited) : { reply: '', scripted: !!hint };
  if (!back) {
    bounce(s, addr, `RE: ${ev.subject ?? ''}`);
    return { state: s, decision: { kind: 'nothing' }, reply: '', bounced: true };
  }
  // only a miss counts toward the daily limit: a scripted answer never does
  if (addr && !back.scripted && !s.sentToday.includes(addr)) s.sentToday.push(addr);
  const reply = back.reply;
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
  // a scripted answer to a wall of text: it doesn't count toward the daily limit, or bounce off it
  if (tooLong(text)) {
    pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: addr, subject: subject || '(no subject)', body: text, read: true });
    const ev = reachableByEmail(s, content, addr);
    return { state: s, decision: { kind: 'nothing' }, reply: tooLongReply(s, content, addr, re(subject || ev?.subject || ''), ev), sent: true };
  }
  // over the limit, Jev still reads the email: only one that would get a miss bounces
  const limited = overDailyLimit(s, addr);
  pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: addr, subject: subject || '(no subject)', body: text, read: true });

  const ev = reachableByEmail(s, content, addr);
  if (!ev) {
    // no story lead here — a known contact replies in their own voice
    const back = await contactWritesBack(s, content, jev, writer, addr, re(subject), text, '', undefined, undefined, limited);
    return missed(s, addr, subject, back, { kind: 'nothing' }, '');
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
      sendLater(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? addr, addr, subject: re(subject || ev.subject || ''), body, read: false, scripted: 'outcome' }, replyAfter(content, addr, outcome.replyAfter, ev));
      return { state: s, decision, reply: body, sent: true };
    }
  }
  // a near miss or nothing: the lead still writes back in their own voice, so the email isn't lost
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  const back = await contactWritesBack(s, content, jev, writer, addr, re(subject), text, hint, undefined, ev, limited);
  return missed(s, addr, subject, back, decision, hint);
}

/** A fresh email that landed no outcome: bounced if over the limit, counted toward it if a miss. */
function missed(s: GameState, addr: string, subject: string, back: { reply: string; scripted: boolean } | null, decision: RouteDecision, hint: string): ComposeResult {
  if (!back) {
    bounce(s, addr, subject);
    return { state: s, decision: { kind: 'nothing' }, reply: '', sent: true, bounced: true };
  }
  // a scripted answer (a hint, a fixed topic) never counts toward the daily limit
  if (!back.scripted && !s.sentToday.includes(addr)) s.sentToday.push(addr);
  return { state: s, decision, reply: back.reply || hint, sent: true };
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
