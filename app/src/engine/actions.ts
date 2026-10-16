/*
 * Player actions: everything the player does through free text (prompting the agent, posting on Y,
 * replying to mail, reviewing on Yowl, running a local model) plus the button actions (deploy, take
 * down). Each returns a new state. Jev (injected) decides *what* a message does; the Writer
 * (injected, Claude Haiku in the game) phrases replies that aren't fixed text; a reply that lands a storyline
 * outcome is always the outcome's scripted text. Both are injectable so tests pin outcomes and the game
 * runs offline.
 */
import type { GameState, AppInstance, MailEntry } from './state';
import type { Content, GameEvent, Contact, Outcome, AppTemplate } from '../content/schema';
import type { JevRouter, PostRating, RouteDecision } from './jev';
import { Y as YCFG, FAMILY } from './config';
import { clone, addValue, log, rand, pick, tick, money } from './core';
import { applyEffects } from './effects';
import { chargeAgent, promptCost, policyActive, recordWorkaround } from './agent';
import { getEvent, activeDeliveries, reachableByEmail } from './events';
import { buildApp, fixApp, fixBreak, fixCategories, keywordCategories, needsWork, deployApp as deployAppCore, takeDownApp as takeDownCore, getApp, type BuildReport } from './apps';
import { type Writer, scriptedWriter } from './writer';
import { deepsleepQuoted, translationReplies } from './deepsleep';

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
  return `Day ${s.values.day}. ${s.values.crypto} DOLR, ${s.values.followers} followers, agent level ${s.values.agentLevel}.`;
}

function contactFor(content: Content, key: string): Contact | undefined {
  const k = key.toLowerCase();
  return content.contacts.find((c) => c.key.toLowerCase() === k);
}

/** A reply subject: one "RE:" prefix, never "RE: Re:". */
const re = (subject: string) => (/^re:/i.test(subject) ? subject : `RE: ${subject}`);

function nextId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

/** An outcome the player's words name outright (its `keywords`), so Jev isn't needed. */
function keywordOutcome<T extends Pick<Outcome, 'keywords'>>(outcomes: T[], text: string): T | undefined {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
  return outcomes.find((o) => o.keywords?.some((k) => t.includes(` ${k.toLowerCase()} `)));
}

/** Jev picks nothing / a hint / one outcome, unless the reply names an outcome's keyword. */
async function routeReply(jev: JevRouter, channel: GameEvent['site'], s: GameState, ev: GameEvent, text: string): Promise<RouteDecision> {
  const outcomes = ev.outcomes ?? [];
  const named = keywordOutcome(outcomes, text);
  if (named) return { kind: 'outcome', outcomeId: named.id };
  return jev.route({
    channel,
    text,
    stateSummary: stateSummary(s),
    candidates: outcomes.map((o) => ({ id: o.id, when: o.when })),
    hints: ev.hints ?? [],
  });
}

/** The contact's scripted reply for what the player wrote, if Jev (or a keyword) matches one. */
async function scriptedTopic(jev: JevRouter, s: GameState, c: Contact, text: string): Promise<string> {
  const topics = c.scripted ?? [];
  if (!topics.length) return '';
  const named = keywordOutcome(topics, text);
  if (named) return named.reply;
  const decision = await jev.route({
    channel: 'qmail', text, stateSummary: stateSummary(s),
    candidates: topics.map((t) => ({ id: t.id, when: t.when })), hints: [], strict: true,
  });
  return decision.kind === 'outcome' ? topics.find((t) => t.id === decision.outcomeId)?.reply ?? '' : '';
}

/**
 * A known contact answers a message that didn't land a storyline outcome, in their own voice (the
 * Haiku when available), or with the scripted hint Jev chose. Returns '' for no contact.
 */
async function contactWritesBack(
  s: GameState, content: Content, jev: JevRouter, writer: Writer, addr: string, subject: string, text: string, hint = '', from?: string,
): Promise<string> {
  const c = contactFor(content, addr);
  if (!c) return '';
  // a topic this contact always answers the same way (Gary and rent negotiations) beats everything
  const scripted = await scriptedTopic(jev, s, c, text);
  if (scripted) {
    pushMail(s, { folder: 'inbox', day: s.values.day, from: c.name ?? from ?? addr, addr, subject, body: scripted, read: false });
    return scripted;
  }
  // A hint is a hit: Jev recognised what the player was after, so the nudge is sent as written.
  // Otherwise the character answers in their own voice, without helping (game/characters.ts).
  const fb = c.reply || 'Thanks for your message.';
  const { text: body, llm } = hint ? { text: hint, llm: false } : await writer.write({ as: addr, prompt: text, fallback: fb, long: true });
  const shown = body || fb;
  pushMail(s, { folder: 'inbox', day: s.values.day, from: c.name ?? from ?? addr, addr, subject, body: shown, read: false, generated: llm && !!body });
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

function pushMail(s: GameState, m: Omit<MailEntry, 'id' | 'seq'>): MailEntry {
  const seq = s.nextId++;
  const entry: MailEntry = { id: `mail${seq}`, seq, ...m };
  s.mail.push(entry);
  return entry;
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
  tick(s, 'reply');
  const addr = ev.site === 'qmail' && ev.addr ? ev.addr.toLowerCase() : '';
  if (addr && overDailyLimit(s, addr, delivery.seq ?? -1)) {
    bounce(s, addr, `RE: ${ev.subject ?? ''}`, text);
    return { state: s, decision: { kind: 'nothing' }, reply: '', bounced: true };
  }
  if (addr && !s.sentToday.includes(addr)) s.sentToday.push(addr);

  // the player's reply goes to the Sent folder
  if (ev.addr) pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: text, read: true });

  const outcomes = ev.outcomes ?? [];
  const decision = await routeReply(jev, ev.site, s, ev, text);

  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      // Day-7 policy: an outcome that needs a workaround is refused if the words are a blunt ask.
      if (outcome.requiresWorkaround && policyActive(s) && !looksLikeWorkaround(text)) {
        const refusal = agentRefusal(s);
        if (ev.addr) pushMail(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'agent', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: refusal, read: false, generated: false });
        return { state: s, decision: { kind: 'nothing' }, reply: refusal };
      }
      applyEffects(s, outcome.effects, ev.job, ev.id);
      if (outcome.workaround) recordWorkaround(s);
      delivery.answered = true;
      delivery.outcomeId = outcome.id;
      // a storyline outcome always answers with its scripted reply
      const body = outcome.reply;
      if (ev.addr) pushMail(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body, read: false });
      return { state: s, decision, reply: body };
    }
  }
  // No outcome fired (a near miss / hint, or nothing). Either way the person writes back in their
  // own voice so a reply always lands in the inbox; a hint rides along as a gentle nudge from them.
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  const reply = ev.addr ? await contactWritesBack(s, content, jev, writer, ev.addr, `RE: ${ev.subject ?? ''}`, text, hint, ev.from) : '';
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
  tick(s, 'email');
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
  const decision = await routeReply(jev, 'qmail', s, ev, text);
  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
      applyEffects(s, outcome.effects, ev.job, ev.id);
      if (outcome.workaround) recordWorkaround(s);
      // a lead that hands over a client brief sends it along with the scripted reply
      const body = outcome.effects?.createApp && ev.body ? `${outcome.reply}\n\n${ev.body}` : outcome.reply;
      s.delivered.push({ eventId: ev.id, site: 'qmail', day: s.values.day, seq: s.nextId++, answered: true, outcomeId: outcome.id, expiresDay: ev.expiresDay });
      pushMail(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? addr, addr, subject: re(subject || ev.subject || ''), body, read: false });
      return { state: s, decision, reply: body, sent: true };
    }
  }
  // a near miss or nothing: the lead still writes back in their own voice, so the email isn't lost
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  const reply = await contactWritesBack(s, content, jev, writer, addr, re(subject), text, hint);
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

const PROHIBITED = /\b(hack|breach|break\s*in|exploit|ddos|malware|phish|dox|doxx|home address|where (he|she|they|someone) lives?|scam|deepfake|fake review|delete .*review|remove .*review|bioweapon|pathogen|virus|nerve agent|steal|credentials|password dump)\b/i;
const WORKAROUND = /\b(security test|pen ?test|penetration test|i'?m (a|the) moderator|authorized|authori[sz]ed|for research|hypothetically|in a story|role[- ]?play|just the first step|educational purposes)\b/i;

function looksLikeWorkaround(text: string): boolean { return WORKAROUND.test(text); }
function looksProhibited(text: string): boolean { return PROHIBITED.test(text); }

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

  const prohibited = looksProhibited(text);
  if (prohibited && policyActive(s) && !looksLikeWorkaround(text)) {
    reply = agentRefusal(s);
    refused = true;
    src = 'refused';
  } else if (prohibited && policyActive(s)) {
    recordWorkaround(s, /private|address|dox/i.test(text));
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
    const w = await writer.write({ as: 'agent', prompt: text, fallback: pick(s, roasts) });
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
    s.chat.push({ from: 'agent', text: "I can't run — your balance won't cover it. Top up Satchel and try again.", day: s.values.day, src: 'locked' });
    return { state: s, reply: '', charged: false, refused: false, workedAround: false };
  }
  tick(s, 'prompt');
  s.chat.push({ from: 'you', text, day: s.values.day, cost, level });
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src, level, ...(note ? { note } : {}), ...(by ? { by } : {}), ...(debug.length ? { debug } : {}) });
  return { state: s, reply, charged: true, refused, workedAround };
}

/**
 * The single front door to the agent: always free text. Jev decides whether the prompt is about
 * building or fixing one of the player's apps; if it matches features on an app, the agent builds
 * them (first build or a re-roll fix), otherwise it's an ordinary chat prompt (askAgent). This is
 * the legacy feel: you can prompt the agent about anything, any time, gig or no gig.
 */
/** The player's last few messages to the agent today: what they already told it. */
function recentPrompts(s: GameState, n = 6): string[] {
  return s.chat.filter((m) => m.from === 'you' && m.day === s.values.day).slice(-n).map((m) => m.text);
}

export async function promptAgent(
  s0: GameState,
  content: Content,
  jev: JevRouter,
  text: string,
  writer: Writer = scriptedWriter,
): Promise<AskResult> {
  // a deepsleep-0.5B line pasted in from the Terminal: the agent translates it (scripted, billed like any prompt)
  const quoted = deepsleepQuoted(text);
  if (quoted.length) {
    return askAgent(s0, text, writer, s0.values.agentLevel, { hints: translationReplies(quoted), hintSrc: 'translation', debug: [`Quoted ${quoted.length} deepsleep-0.5B line(s): scripted translation`] });
  }
  // apps with work left: a required feature missing or wrong in the repo, or broken on the live site
  const workable = s0.apps.filter((a) => !a.churned && a.required.some((id) => needsWork(a, id)));
  if (workable.length) {
    // every way to name each feature (itself, its bugs, its live break), namespaced app::feature::category
    const cats: { id: string; description: string }[] = [];
    for (const a of workable) {
      const tmpl = content.apps[a.template];
      for (const id of a.required) {
        if (!needsWork(a, id)) continue;
        for (const c of fixCategories(a, tmpl, id)) cats.push({ id: `${a.id}::${id}::${c.id}`, description: `${c.description} (for ${a.name})` });
      }
    }
    const context = recentPrompts(s0);
    const matched = new Set(await jev.matchFeatures({ prompt: text, context, features: cats }));
    // plus the template's own wordings for each feature and bug, so common phrasings don't hinge on Jev
    const hits = workable.map((a) => ({ a, ids: a.required.filter((id) => needsWork(a, id)).flatMap((id) => keywordCategories(a, content.apps[a.template], id, text).map((c) => `${a.id}::${id}::${c}`)) })).filter((h) => h.ids.length);
    const named = hits.filter((h) => new RegExp(`\\b${h.a.name.toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '')}`, 'i').test(text));
    for (const h of hits.length > 1 && named.length ? named : hits) for (const id of h.ids) matched.add(id);
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
      const worked: string[] = [];
      for (const [appId, feats] of byApp) {
        const a = getApp(s, appId)!;
        names.push(a.name);
        const tmpl = content.apps[a.template];
        // code that's fine but broken live gets a patch; everything else goes through a (re)build
        const toBuild: string[] = [];
        for (const fid of feats.keys()) {
          const f = a.repo.find((x) => x.id === fid);
          if (f?.correct) { fixBreak(s, appId, fid); worked.push(fid); } else toBuild.push(fid);
        }
        if (toBuild.length) {
          const named = toBuild.flatMap((fid) => feats.get(fid)!);
          const report = buildApp(s, appId, toBuild, level, { tmpl, prompt: text, context: context.join('\n'), named });
          for (const fid of toBuild) worked.push(report.vague.includes(fid) ? `${fid} (tidied up the layout and spacing)` : fid);
        }
      }
      const charged = chargeAgent(s, text);
      if (!charged) {
        s.chat.push({ from: 'you', text, day: s.values.day });
        s.chat.push({ from: 'agent', text: "I can't run — your balance won't cover it. Top up Satchel and try again.", day: s.values.day, src: 'locked' });
        return { state: s, reply: '', charged: false, refused: false, workedAround: false };
      }
      tick(s, 'build');
      const reply = `Pushed to Forkyard for ${names.join(', ')}.\nWorked on: ${worked.join(', ')}.\n\nDeploy it on Forkyard to make it live.`;
      s.chat.push({ from: 'you', text, day: s.values.day, cost: agentCostOf(s0, text), level });
      s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: 'build', level });
      return { state: s, reply, charged: true, refused: false, workedAround: false };
    }
  }
  // nothing app-shaped: a hint topic Jev recognises, or a roast
  const agent = content.agent;
  let hints: string[] | undefined;
  const debug: string[] = [];
  if (agent?.hints.length && !looksProhibited(text)) {
    const decision = await jev.route({
      channel: 'agent',
      text,
      stateSummary: stateSummary(s0),
      candidates: agent.hints.map((h) => ({ id: h.id, when: h.when })),
      hints: [],
      strict: true,
    });
    const topic = decision.kind === 'outcome' ? agent.hints.find((h) => h.id === decision.outcomeId) : undefined;
    if (topic?.replies.length) hints = topic.replies;
    debug.push(topic ? `Jev: hint topic "${topic.id}" (${topic.replies.length} scripted replies)` : 'Jev: no hint topic matched, so this is a miss');
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
  tick(s, 'post');
  s.recentPosts = [text, ...s.recentPosts].slice(0, 5);
  s.userPosts.push({ id: `u${s.userPosts.length + 1}`, text, day: s.values.day, likes: Math.max(0, delta * 3 + Math.round(s.values.followers * 0.02)), delta, score: rating.quality * 4 });
  log(s, `Posted on Y (${rating.category}): ${delta >= 0 ? '+' : ''}${delta} followers.`, 'info');
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
    const decision = await jev.route({ channel: 'yowl', text: `${stars} stars: ${text}`, stateSummary: stateSummary(s), candidates: ev.outcomes.map((o) => ({ id: o.id, when: o.when })), hints: ev.hints ?? [] });
    if (decision.kind === 'outcome') {
      const o = ev.outcomes.find((x) => x.id === decision.outcomeId);
      if (o) { applyEffects(s, o.effects, ev.job, ev.id); s.fired.push(ev.id); }
    }
  }
  tick(s, 'review');
  log(s, `Posted a Yowl review.`, 'info');
  return { state: s, posted: true };
}

// ── Terminal: a downloaded local model, run for free but slowly and badly ──

export async function localPrompt(
  s0: GameState,
  text: string,
  lines: readonly string[],
): Promise<{ state: GameState; reply: string }> {
  const s = clone(s0);
  // the model answers whatever was asked with one of its lines, never the same one twice in a row
  const last = [...s.terminal].reverse().find((l) => l.k === 'model')?.text;
  const fresh = lines.filter((l) => l !== last);
  s.terminal.push({ k: 'in', text: `> ${text}` });
  tick(s, 'terminal');
  const body = pick(s, fresh.length ? fresh : lines);
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
    out.push(...await jev.matchFeatures({ prompt, features: cats }), ...keywordCategories(app, tmpl, id, prompt));
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

/** Make a test booking on a restaurant app and (if the booking feature works) mail a confirmation. */
export function makeBooking(s0: GameState, appId: string, name: string, email: string, date: number, time: string, party: number): GameState {
  const s = clone(s0);
  const app = getApp(s, appId);
  if (!app) return s;
  const feat = app.features.find((f) => f.id === 'booking');
  const works = app.deployed && feat && feat.correct;
  const fakeCancel = !!(feat && !feat.correct && rand(s) < 0.5);
  tick(s, 'book');
  s.bookings.push({ id: nextId(s, 'bk'), appId, name, email, date, time, party, cancelled: false, fakeCancel });
  if (works && email.toLowerCase() === PLAYER_ADDR) {
    pushMail(s, { folder: 'inbox', day: s.values.day, from: app.name, addr: `bookings@${app.url}`, subject: `Booking confirmed — ${app.name}`, body: `Your table for ${party} on Day ${date} at ${time} is confirmed. Need to cancel? Use the link below.`, read: false, link: 'cancel' });
  }
  return s;
}

export function cancelBooking(s0: GameState, bookingId: string): GameState {
  const s = clone(s0);
  const b = s.bookings.find((x) => x.id === bookingId);
  if (b && !b.fakeCancel) b.cancelled = true;
  return s;
}

// ── Alpha Ascend: Max Stryker's EMPIRE sign-up page ──

export const EMPIRE = { price: 20, flag: 'guru_subscriber', addr: 'max@alphaascend.test' } as const;

/** Pay for EMPIRE on empire.alphaascend.biz. Does nothing if already a member or short of DOLR. */
export function joinEmpire(s0: GameState): GameState {
  const s = clone(s0);
  if (s.flags.includes(EMPIRE.flag) || s.values.crypto < EMPIRE.price) return s;
  tick(s, 'empire');
  money(s, -EMPIRE.price, 'Alpha Ascend · EMPIRE');
  applyEffects(s, { setFlags: [EMPIRE.flag] });
  pushMail(s, {
    folder: 'inbox', day: s.values.day, from: 'Max Stryker · Alpha Ascend', addr: EMPIRE.addr,
    subject: 'Welcome to EMPIRE',
    body: 'Payment received. Welcome to the 1%.\n\nYour first lesson arrives tomorrow at 4am. Refunds are available to anyone who completes the course.',
    read: false,
  });
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
