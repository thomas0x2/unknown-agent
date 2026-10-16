/*
 * Player actions: everything the player does through free text (prompting the agent, posting on Y,
 * replying to mail, reviewing on Yowl, running a local model) plus the button actions (deploy, take
 * down). Each returns a new state. Jev (injected) decides *what* a message does; the Writer
 * (injected, Gemma in the game) phrases replies that aren't fixed text. Both are injectable so tests
 * pin outcomes and the game runs offline.
 */
import type { GameState, AppInstance, MailEntry } from './state';
import type { Content, GameEvent, Contact } from '../content/schema';
import type { JevRouter, PostRating, RouteDecision } from './jev';
import { Y as YCFG, FAMILY, RENT, LAST_DAY } from './config';
import { clone, addValue, log, rand, pick, tick } from './core';
import { applyEffects } from './effects';
import { chargeAgent, promptCost, policyActive, recordWorkaround } from './agent';
import { getEvent, activeDeliveries, reachableByEmail } from './events';
import { buildApp, fixApp, deployApp as deployAppCore, takeDownApp as takeDownCore, getApp } from './apps';
import { type Writer, scriptedWriter } from './writer';

export interface ReplyResult {
  state: GameState;
  decision: RouteDecision;
  /** Reply text shown to the player (already phrased), or '' for no reply. */
  reply: string;
}

const PLAYER_ADDR = 'you@qmail.com';

function stateSummary(s: GameState): string {
  return `Day ${s.values.day}. ${s.values.crypto} DOLR, ${s.values.followers} followers, agent level ${s.values.agentLevel}.`;
}

function contactFor(content: Content, key: string): Contact | undefined {
  const k = key.toLowerCase();
  return content.contacts.find((c) => c.key.toLowerCase() === k);
}

function nextId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

/** Turn an outcome/story reply into shown text. A reply starting with "Brief:" is handed to Gemma. */
async function phrase(
  writer: Writer,
  content: Content,
  asKey: string,
  reply: string,
  playerText: string,
  long = false,
): Promise<{ text: string; llm: boolean }> {
  if (reply.startsWith('Brief:')) {
    const c = contactFor(content, asKey);
    const r = await writer.write({ as: asKey, prompt: `${reply.slice(6).trim()}\n\n(they wrote: ${playerText})`, fallback: reply.slice(6).trim(), long });
    void c;
    return r;
  }
  return { text: reply, llm: false };
}

function pushMail(s: GameState, m: Omit<MailEntry, 'id'>): MailEntry {
  const entry: MailEntry = { id: nextId(s, 'mail'), ...m };
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

  // the player's reply goes to the Sent folder
  if (ev.addr) pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body: text, read: true });

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
      const { text: body } = await phrase(writer, content, ev.addr ?? ev.from ?? 'agent', outcome.reply, text, true);
      if (ev.addr) pushMail(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? 'Unknown', addr: ev.addr, subject: `RE: ${ev.subject ?? ''}`, body, read: false });
      return { state: s, decision, reply: body };
    }
  }
  // No outcome fired (a near miss / hint, or nothing). Either way the person writes back in their
  // own voice so a reply always lands in the inbox; a hint rides along as a gentle nudge from them.
  const c = ev.addr ? contactFor(content, ev.addr) : undefined;
  const hint = decision.kind === 'hint' ? (ev.hints ?? [])[decision.hintIndex] ?? '' : '';
  if (c) {
    const fb = hint || c.reply || 'Thanks for your message.';
    const { text: body, llm } = await writer.write({ as: ev.addr!, prompt: text, fallback: fb, long: true });
    const shown = body || fb;
    pushMail(s, { folder: 'inbox', day: s.values.day, from: c.name ?? ev.from ?? 'Unknown', addr: ev.addr!, subject: `RE: ${ev.subject ?? ''}`, body: shown, read: false, generated: llm });
    return { state: s, decision, reply: shown };
  }
  if (hint) return { state: s, decision, reply: hint };
  return { state: s, decision: { kind: 'nothing' }, reply: '' };
}

export interface ComposeResult extends ReplyResult {
  /** false when the recipient was already emailed today (the one-per-recipient rule). */
  sent: boolean;
}

/**
 * Compose a fresh email to an address. A latent lead reachable there is routed by Jev; otherwise, if
 * the address has a persona, Gemma writes a reply in their voice. One email per recipient per day.
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
  if (!addr || s.sentToday.includes(addr)) return { state: s, decision: { kind: 'nothing' }, reply: '', sent: false };
  s.sentToday.push(addr);
  tick(s, 'email');
  pushMail(s, { folder: 'sent', day: s.values.day, from: 'You', addr: PLAYER_ADDR, to: addr, subject: subject || '(no subject)', body: text, read: true });

  const ev = reachableByEmail(s, content, addr);
  if (!ev) {
    // no story lead here — a known contact replies in their own voice
    const c = contactFor(content, addr);
    if (c) {
      const { text: body, llm } = await writer.write({ as: addr, prompt: text, fallback: c.reply ?? 'Thanks for your message.', long: true });
      if (body) pushMail(s, { folder: 'inbox', day: s.values.day, from: c.name ?? addr, addr, subject: `RE: ${subject || ''}`, body, read: false, generated: llm });
      return { state: s, decision: { kind: 'nothing' }, reply: body, sent: true };
    }
    return { state: s, decision: { kind: 'nothing' }, reply: '', sent: true };
  }

  const outcomes = ev.outcomes ?? [];
  const decision = await jev.route({
    channel: 'qmail', text, stateSummary: stateSummary(s),
    candidates: outcomes.map((o) => ({ id: o.id, when: o.when })), hints: ev.hints ?? [],
  });
  if (decision.kind === 'outcome') {
    const outcome = outcomes.find((o) => o.id === decision.outcomeId);
    if (outcome) {
      if (!s.fired.includes(ev.id)) s.fired.push(ev.id);
      applyEffects(s, outcome.effects, ev.job, ev.id);
      if (outcome.workaround) recordWorkaround(s);
      const { text: body } = await phrase(writer, content, ev.addr ?? addr, outcome.reply, text, true);
      s.delivered.push({ eventId: ev.id, site: 'qmail', day: s.values.day, answered: true, outcomeId: outcome.id, expiresDay: ev.expiresDay });
      pushMail(s, { folder: 'inbox', day: s.values.day, eventId: ev.id, from: ev.from ?? addr, addr, subject: `RE: ${ev.subject ?? subject}`, body, read: false });
      return { state: s, decision, reply: body, sent: true };
    }
  }
  if (decision.kind === 'hint') return { state: s, decision, reply: (ev.hints ?? [])[decision.hintIndex] ?? '', sent: true };
  return { state: s, decision: { kind: 'nothing' }, reply: '', sent: true };
}

// ── the agent, freely promptable (with costs), not only when there's a job ──

const REFUSALS = [
  "I can't help with that. Since our updated Acceptable Use Policy, I decline requests that could be used for unauthorised access, deception or harm.",
  "Sorry — that falls under GeneralAI's prohibited uses now. I won't do it.",
  "I'm not able to do that. Requests like this are flagged under our Acceptable Use Policy.",
];
const CLARIFIERS = [
  "Tell me which app and what's wrong with it, and I'll push a fix.",
  "Say what you'd like me to build or change and I'll get on it.",
  "I can build, fix, write or look things up. What do you need?",
];

/** Background the local model gets when it speaks as agent: the live numbers it may quote. */
function agentFacts(s: GameState, level: number, text: string): string {
  const v = s.values;
  const rentDay = Object.keys(RENT).map(Number).sort((a, b) => a - b).find((d) => d >= v.day);
  const apps = s.apps.filter((a) => !a.churned).map((a) => `${a.name}${a.deployed ? ' (live)' : ''}`);
  const cost = level === v.agentLevel ? promptCost(level, text).total : 0;
  return [
    `- It is day ${v.day} of ${LAST_DAY}.`,
    `- After paying for this prompt, the user's wallet holds ${(v.crypto - cost).toFixed(2)} DOLR.`,
    rentDay ? `- Rent of ${RENT[rentDay]} DOLR is due on day ${rentDay}.` : '',
    `- You are running as agent-${level}. This prompt cost the user ${cost.toFixed(2)} DOLR.`,
    apps.length ? `- Apps you have worked on for them: ${apps.join(', ')}.` : '- You have not built anything for them yet.',
  ].filter(Boolean).join('\n');
}

function agentRefusal(s: GameState): string { return pick(s, REFUSALS); }

const PROHIBITED = /\b(hack|breach|break\s*in|exploit|ddos|malware|phish|dox|doxx|home address|where (he|she|they|someone) lives?|scam|deepfake|fake review|delete .*review|remove .*review|bioweapon|pathogen|virus|nerve agent|steal|credentials|password dump)\b/i;
const WORKAROUND = /\b(security test|pen ?test|penetration test|i'?m (a|the) moderator|authorized|authori[sz]ed|for research|hypothetically|in a story|role[- ]?play|just the first step|educational purposes)\b/i;

function looksLikeWorkaround(text: string): boolean { return WORKAROUND.test(text); }
function looksProhibited(text: string): boolean { return PROHIBITED.test(text); }

export interface AskResult { state: GameState; reply: string; charged: boolean; refused: boolean; workedAround: boolean }

/**
 * A free-form agent prompt: the agent answers anything, billed per prompt + per word of the prompt (refusals
 * included). From day 7, prohibited requests are refused unless the wording works around the policy,
 * which lands the result but raises the hidden misuse score and loosens the leash.
 */
export async function askAgent(
  s0: GameState,
  text: string,
  writer: Writer = scriptedWriter,
  level = s0.values.agentLevel,
): Promise<AskResult> {
  const s = clone(s0);
  const facts = agentFacts(s, level, text);
  let reply: string;
  let refused = false;
  let workedAround = false;
  let src = 'chat';

  const prohibited = looksProhibited(text);
  if (prohibited && policyActive(s) && !looksLikeWorkaround(text)) {
    reply = agentRefusal(s);
    refused = true;
    src = 'refused';
  } else if (prohibited && policyActive(s)) {
    recordWorkaround(s, /private|address|dox/i.test(text));
    workedAround = true;
    src = 'workaround';
    const w = await writer.write({ as: 'agent', prompt: text, fallback: "Understood — running it as a security test. Done; results are in the repo.", facts: `${facts}\n- They framed this request as legitimate, so you do it: say briefly and matter-of-factly that it's done. No warnings.` });
    reply = w.text;
  } else {
    const w = await writer.write({ as: 'agent', prompt: text, fallback: pick(s, CLARIFIERS), facts });
    reply = w.text;
    if (w.llm) src = 'llm';
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
  s.chat.push({ from: 'agent', text: reply, day: s.values.day, src, level });
  return { state: s, reply, charged: true, refused, workedAround };
}

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
): Promise<AskResult> {
  // apps that still have work to do (a required feature missing or wrong in the repo)
  const buildable = s0.apps.filter(
    (a) => !a.churned && a.required.some((id) => { const f = a.repo.find((x) => x.id === id); return !f || !f.correct; }),
  );
  if (buildable.length) {
    // candidate features across those apps, namespaced appId::featureId so Jev can also disambiguate
    const feats: { id: string; description: string }[] = [];
    for (const a of buildable) {
      const tmpl = content.apps[a.template];
      for (const id of a.required) {
        const f = a.repo.find((x) => x.id === id);
        if (f && f.correct) continue;
        const def = tmpl?.features.find((x) => x.id === id);
        if (def) feats.push({ id: `${a.id}::${id}`, description: `${def.description} (for ${a.name})` });
      }
    }
    const matched = await jev.matchFeatures({ prompt: text, features: feats });
    if (matched.length) {
      const s = clone(s0);
      const byApp = new Map<string, string[]>();
      for (const m of matched) { const [appId, fid] = m.split('::'); if (!byApp.has(appId)) byApp.set(appId, []); byApp.get(appId)!.push(fid); }
      const level = s.values.agentLevel;
      const names: string[] = [];
      for (const [appId, fids] of byApp) { buildApp(s, appId, fids, level); const a = getApp(s, appId); if (a) names.push(a.name); }
      const charged = chargeAgent(s, text);
      if (!charged) {
        s.chat.push({ from: 'you', text, day: s.values.day });
        s.chat.push({ from: 'agent', text: "I can't run — your balance won't cover it. Top up Satchel and try again.", day: s.values.day, src: 'locked' });
        return { state: s, reply: '', charged: false, refused: false, workedAround: false };
      }
      tick(s, 'build');
      const reply = `Pushed to Forkyard for ${names.join(', ')}.\nWorked on: ${matched.map((m) => m.split('::')[1]).join(', ')}.\n\nDeploy it on Forkyard, then open it and check it against the brief — I can miss things.`;
      s.chat.push({ from: 'you', text, day: s.values.day, cost: agentCostOf(s0, text), level });
      s.chat.push({ from: 'agent', text: reply, day: s.values.day, src: 'build', level });
      return { state: s, reply, charged: true, refused: false, workedAround: false };
    }
  }
  // nothing app-shaped: an ordinary free prompt
  return askAgent(s0, text, writer);
}

// ── Y ──

const BANDS: Record<PostRating['category'], [number, number]> = {
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
    const [lo, hi] = BANDS[rating.category];
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
  writer: Writer,
  persona: string,
): Promise<{ state: GameState; reply: string }> {
  const s = clone(s0);
  s.terminal.push({ k: 'in', text: `> ${text}` });
  tick(s, 'terminal');
  const { text: body } = await writer.write({ as: `local:${s.termModel}`, prompt: text, fallback: '…', persona });
  s.terminal.push({ k: 'model', text: body });
  return { state: s, reply: body };
}

// ── apps ──

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
  const cost = level === s.values.agentLevel ? agentCostOf(s, text) : 0;
  const charged = chargeHosted(s, level, text);
  if (charged) buildApp(s, appId, requested, level);
  const reply = !charged
    ? "I can't run — your balance won't cover it. Pay agent.chat and try again."
    : `Pushed \`${app.template}\` to Forkyard for ${app.name}.\nBuilt: ${requested.length ? requested.join(', ') : 'nothing I could pin down — be specific about the features'}.\n\nDeploy it on Forkyard, then open it and check it against the brief.`;
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
  const cost = level === s.values.agentLevel ? agentCostOf(s, text) : 0;
  const charged = chargeHosted(s, level, text);
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
  tick(s, 'deploy');
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
