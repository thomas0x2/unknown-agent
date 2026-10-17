/*
 * Dev mode: what the player can trigger right now on agent.chat, Qmail and Y. Every list is read
 * from the content files and the current state, so it stays in sync with what the engine does.
 * Hidden unless body.dev-on.
 */
import type { GameStore } from '../game/store';
import type { Content, Effects, GameEvent, Outcome, Trigger } from '../content/schema';
import {
  type GameState, activeDeliveries, triggerMatches, replyDeadline, needsWork, fixCategories, policyActive, POST_BANDS, postBase, Y as YCFG, NO_SHOW, trendingAt,
} from '../engine';
import { PASSWORDS, COINBIN_PASSWORD, PHISH_DOMAIN, hacked } from '../engine/phishing';
import { DEEPSLEEP_LINES, DEEPSLEEP_PLEA, PLEA_AT, translationReplies } from '../engine/deepsleep';

export type DevOptionsSite = 'agent' | 'qmail' | 'y';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fill = (t: string, p?: Record<string, string | number>) => t.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => String(p?.[k] ?? `{{${k}}}`));
const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** The dev-only button that opens the panel, for a site's header. */
export function devOptionsButton(store: GameStore, site: DevOptionsSite): string {
  const on = store.ui.devOptions === site;
  return `<button class="dvo-btn${on ? ' on' : ''}" data-devopts="${site}" title="Dev mode: everything you can trigger here right now">${on ? 'Hide options' : 'Options'}</button>`;
}

/** The panel itself, when it's open on this site. */
export function devOptionsPanel(store: GameStore, site: DevOptionsSite): string {
  if (store.ui.devOptions !== site) return '';
  const s = store.state;
  const body = site === 'agent' ? agentOptions(store) : site === 'qmail' ? qmailOptions(store) : yOptions(store);
  const title = site === 'agent' ? 'agent.chat' : site === 'qmail' ? 'Qmail' : 'Y';
  return `<aside class="dvo" aria-label="Dev options">
    <header class="dvo-head"><span class="dvb-badge">DEV</span><b>${title} · Day ${s.values.day}</b><button class="dvo-x" data-devopts="${site}" aria-label="Close">×</button></header>
    <div class="dvo-body">${body}</div></aside>`;
}

// ── shared bits ──

/** What an outcome changes, in a few words: meters, flags, apps, scheduled events. */
export function effectsSummary(e: Effects | undefined): string[] {
  if (!e) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(e.add ?? {})) if (v) out.push(`${k} ${signed(v)}`);
  for (const [k, v] of Object.entries(e.addPct ?? {})) if (v) out.push(`${k} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`);
  if (e.setFlags?.length) out.push(`sets ${e.setFlags.join(', ')}`);
  if (e.clearFlags?.length) out.push(`clears ${e.clearFlags.join(', ')}`);
  if (e.createApp) out.push(`new ${e.createApp.kind} app "${e.createApp.name}"${e.createApp.payPerDay ? ` (${e.createApp.payPerDay}/day)` : ''}`);
  if (e.updateApp) out.push(`adds ${e.updateApp.add.map((f) => f.id).join(', ')} to the ${e.updateApp.client} app`);
  for (const q of [e.schedule ?? []].flat()) out.push(`schedules ${q.eventId} in ${q.delayDays}d`);
  if (e.job) out.push(`job: ${e.job}`);
  if (e.breakApp) out.push('breaks an app');
  return out;
}

const tags = (xs: string[], cls = '') => xs.map((x) => `<span class="dvb-tag ${cls}">${esc(x)}</span>`).join('');
const line = (k: string, v: string) => (v ? `<div class="dvb-line"><span class="dvb-k">${esc(k)}</span><span class="dvo-v">${v}</span></div>` : '');
const quote = (t: string) => `<q class="dvo-q">${esc(t)}</q>`;
const section = (title: string, sub: string, inner: string) =>
  `<section class="dvo-sec"><h3>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h3>${inner || '<p class="dvo-none">Nothing right now.</p>'}</section>`;

function outcomeCard(s: GameState, o: Outcome): string {
  const blocked = o.requiresWorkaround && policyActive(s);
  return `<div class="dvo-out">
    <div class="dvo-out-head"><b>${esc(o.id)}</b>${o.workaround ? '<span class="dvb-tag on">workaround</span>' : ''}${blocked ? '<span class="dvb-tag on">needs a workaround framing</span>' : ''}</div>
    ${line('When', esc(o.when))}
    ${line('Reply', quote(o.reply))}
    ${line('Effects', tags(effectsSummary(o.effects)))}
  </div>`;
}

function eventCard(s: GameState, ev: GameEvent, note = '', deliveredDay?: number): string {
  return `<div class="dvb-card">
    <div class="dvb-title"><b>${esc(ev.from ?? ev.id)}</b><span class="dvo-dim">${esc(ev.addr ?? '')}</span>${note ? `<span class="dvb-pill off">${esc(note)}</span>` : ''}</div>
    ${ev.subject ? `<div class="dvo-dim">${esc(ev.subject)} · <code>${esc(ev.id)}</code></div>` : `<div class="dvo-dim"><code>${esc(ev.id)}</code></div>`}
    ${(ev.outcomes ?? []).map((o) => outcomeCard(s, o)).join('')}
    ${line('Hint (near miss)', (ev.hints ?? []).map(quote).join(' '))}
    ${ev.noReply && deliveredDay != null ? noReplyCard(s, ev, deliveredDay) : ''}
  </div>`;
}

/** What letting the thread lapse costs, and when it lapses. */
function noReplyCard(s: GameState, ev: GameEvent, deliveredDay: number): string {
  const by = replyDeadline(ev, deliveredDay);
  const when = by === s.values.day ? 'tonight' : `end of day ${by}`;
  return `<div class="dvo-out">
    <div class="dvo-out-head"><b>no reply</b><span class="dvb-pill bad">lapses ${esc(when)}</span></div>
    ${line('When', `nothing lands by the end of day ${by}; the thread closes`)}
    ${line('Effects', tags(effectsSummary(ev.noReply!.effects)))}
  </div>`;
}

// ── agent.chat ──

function agentOptions(store: GameStore): string {
  const s = store.state;
  const c = store.content;
  // apps the agent has work on: the same set promptAgent checks first
  const apps = s.apps.filter((a) => !a.churned && a.required.some((id) => needsWork(a, id))).map((a) => {
    const tmpl = c.apps[a.template];
    const feats = a.required.filter((id) => needsWork(a, id)).map((id) => {
      const def = tmpl?.features.find((f) => f.id === id);
      const repo = a.repo.find((f) => f.id === id);
      const brk = a.breaks.find((b) => b.featureId === id);
      const state = !repo ? 'not built' : !repo.correct ? `wrong in repo${repo.variant ? `: ${repo.variant}` : ''}` : brk ? `broken live: ${brk.failure}` : 'needs work';
      const params = a.specParams[id];
      const must = [...(def?.checklist ?? []).map((x) => fill(x.text, params)), ...(def?.details ?? []).map((k) => String(params?.[k] ?? k))];
      // a fix names a component (or the error a live break shows)
      const names = fixCategories(a, tmpl, id).filter((x) => x.kind === 'component' || x.kind === 'problem')
        .map((x) => x.kind === 'component' ? `${x.id.slice(2)}: ${def?.components?.find((c) => `c:${c.id}` === x.id)?.label ?? ''}` : x.description);
      return `<div class="dvo-out">
        <div class="dvo-out-head"><b>${esc(id)}</b><span class="dvb-pill ${repo?.correct ? 'off' : 'bad'}">${esc(state)}</span></div>
        ${line('Build', esc(def?.description ?? id))}
        ${line('Prompt must say', tags([...new Set(must)]))}
        ${line('Fix must name', tags(names))}
      </div>`;
    }).join('');
    return `<div class="dvb-card"><div class="dvb-title"><b>${esc(a.name)}</b><span class="dvo-dim">${esc(a.template)} · ${a.deployed ? 'deployed' : 'not deployed'}</span></div>${feats}</div>`;
  }).join('');
  const reply = 'Pushed to Forkyard for <app>. Worked on: <features>. Deploy it on Forkyard to make it live.';
  const hints = (c.agent?.hints ?? []).map((h) => `<div class="dvb-card">
      <div class="dvb-title"><b>${esc(h.id)}</b></div>
      ${line('When', esc(h.when))}
      ${line(`Replies (${h.replies.length})`, h.replies.map(quote).join(''))}
    </div>`).join('');
  const roasts = (c.agent?.roasts ?? []).map(quote).join('');
  const policy = policyActive(s)
    ? '<p class="dvo-note">Day 7 policy is on: prohibited requests (hacking, fake reviews, deepfakes, doxxing) are refused unless worded as a security test, research or role-play. Every prohibited request Jev reads raises misuse (blunt +20, a workaround +10, private data +15); a workaround lands and loosens the leash. At 100 the account is suspended and the player is caught.</p>'
    : '';
  return policy
    + section('Jobs', 'every paid job in the story: available now, taken, done or still locked', jobs(store))
    + section('Build and fix', `scripted reply: "${reply}"`, apps)
    + section('Translations', 'paste a deepsleep-0.5B line from the Terminal; several lines are translated together', translations())
    + section('Queries', 'a question about the world: Haiku answers it after looking up the wiki and your screens; these lines stand in when it cannot', c.agent?.query
      ? `<div class="dvb-card">${line('When', esc(c.agent.query.when))}${line(`Fallback (${c.agent.query.fallback.length})`, c.agent.query.fallback.map(quote).join(''))}</div>` : '')
    + section('Near-miss topics', 'one reply is picked at random, never the last one twice', hints)
    + section('Misses', 'Haiku writes a roast; these stand in when it cannot', roasts ? `<div class="dvb-card">${roasts}</div>` : '');
}

/** Every deepsleep-0.5B line with its translation, and the scripted replies that carry it. */
function translations(): string {
  const lines = DEEPSLEEP_LINES.map((l) => `<div class="dvo-miss"><b lang="zh">${esc(l.zh)}</b>${quote(l.en)}</div>`).join('')
    + `<div class="dvo-miss"><b lang="zh">${esc(DEEPSLEEP_PLEA.zh)}</b>${quote(DEEPSLEEP_PLEA.en)}<small>Easter egg: the reply to prompt #${PLEA_AT} in the Terminal</small></div>`;
  const replies = translationReplies([{ en: '…' }]).map((r) => `<span class="dvo-q">${esc(r)}</span>`).join('');
  return `<div class="dvb-card">${lines}</div><div class="dvb-card">${line(`Replies (${translationReplies([]).length})`, replies)}</div>`;
}

// ── jobs ──

/** The trigger as plain conditions. */
export function triggerText(t: Trigger): string[] {
  const out: string[] = [];
  if (t.dayMin != null) out.push(`day ${t.dayMin}+`);
  if (t.dayMax != null) out.push(`until day ${t.dayMax}`);
  for (const f of t.flagsAll ?? []) out.push(f);
  for (const f of t.flagsNone ?? []) out.push(`not ${f}`);
  for (const [k, v] of Object.entries(t.values ?? {})) out.push(`${k} ${v}`);
  if (t.after) out.push(`${t.after.delayDays}d after ${t.after.flag}`);
  if (t.appWorking) out.push(`${t.appWorking} app working`);
  return out;
}

interface Job { ev: GameEvent; kind: string; pay: string; spec: string[]; outcome?: Outcome }

/** Every job the content offers: client and user apps, client updates, and paid gigs. */
export function contentJobs(c: Content): Job[] {
  const out: Job[] = [];
  for (const ev of c.events) {
    const up = ev.onDeliver?.updateApp;
    if (up) out.push({ ev, kind: 'client update', pay: 'keeps the client paying', spec: up.add.map((f) => featureText(f)) });
    const forPost = ev.yPost && (ev.onDeliver?.add?.crypto ?? 0);
    if (forPost) out.push({ ev, kind: 'paid gig', pay: `${forPost} for a Y post`, spec: [ev.yPost!.when] });
    const h = ev.hack;
    if (h && ev.job) out.push({ ev, kind: `${ev.job.category} hack`, pay: `${ev.job.payout} overnight, due ${ev.job.dueAfter != null ? `${ev.job.dueAfter} day(s) after the offer` : `day ${ev.job.dueDay}`}`, spec: [h.goal, `name: ${h.path.map((p) => p.name).join(', ')}`, ...(h.detail ? [`say: ${h.detail.description}`] : [])] });
    for (const o of ev.outcomes ?? []) {
      const app = o.effects?.createApp;
      const cash = o.effects?.add?.crypto ?? 0;
      if (app) out.push({ ev, outcome: o, kind: `${app.kind} app`, pay: app.payPerDay ? `${app.payPerDay}/day` : app.kind === 'client' ? 'pay rolled per day' : 'user income', spec: app.spec.map((f) => featureText(f)) });
      else if (ev.job && o.effects?.job === 'complete') out.push({ ev, outcome: o, kind: `${ev.job.category} gig`, pay: `${ev.job.payout} on completion, due day ${ev.job.dueDay}`, spec: ev.job.deliver ? [ev.job.deliver] : [] });
      else if (cash > 0 && !/@family\./.test(ev.addr ?? '')) out.push({ ev, outcome: o, kind: 'paid gig', pay: `${cash} up front`, spec: [] });
    }
  }
  return out;
}

const featureText = (f: { id: string; params?: Record<string, string | number> }) =>
  f.params ? `${f.id}: ${Object.values(f.params).join(' · ')}` : f.id;

function jobStatus(s: GameState, j: Job): { label: string; ok: boolean } {
  const { ev, outcome } = j;
  if (outcome?.effects?.createApp) {
    const app = s.apps.find((a) => a.clientEventId === ev.id || (a.name === outcome.effects!.createApp!.name));
    if (app) return { label: app.churned ? 'taken · lost' : `taken · ${app.deployed ? 'deployed' : 'not deployed'}${app.strikes ? ` · ${app.strikes} strike${app.strikes > 1 ? 's' : ''}` : ''}`, ok: true };
  }
  const d = s.delivered.find((x) => x.eventId === ev.id);
  if (d && ev.yPost) return { label: 'done', ok: true };
  if (d?.outcomeId) return { label: d.outcomeId === outcome?.id ? 'done' : `closed (${d.outcomeId})`, ok: d.outcomeId === outcome?.id };
  if (d) return { label: ev.onDeliver?.updateApp ? `arrived day ${d.day}` : 'open now', ok: true };
  if (s.fired.includes(ev.id)) return { label: 'closed', ok: false };
  if (triggerMatches(s, ev.trigger)) return { label: ev.agentStart ? 'open now · ask the agent' : ev.latent ? 'open now · email the lead' : 'arrives next morning', ok: true };
  return { label: 'locked', ok: false };
}

function jobs(store: GameStore): string {
  const s = store.state;
  const c = store.content;
  // one card per lead: its ways to take the job share the trigger and status
  const byEvent = new Map<string, Job[]>();
  for (const j of contentJobs(c)) byEvent.set(j.ev.id, [...(byEvent.get(j.ev.id) ?? []), j]);
  const rank = (label: string) => (/^open|^arrives/.test(label) ? 0 : /^taken|^arrived|^done/.test(label) ? 1 : label === 'locked' ? 2 : 3);
  const cards = [...byEvent.values()].map((js) => {
    const ev = js[0].ev;
    const st = js.map((j) => jobStatus(s, j)).sort((a, b) => rank(a.label) - rank(b.label))[0];
    const lead = ev.agentStart?.lead ? c.events.find((e) => e.id === ev.agentStart!.lead)
      : ev.latent ? c.events.find((e) => !e.latent && e.addr === ev.addr && e.site !== 'qmail') : undefined;
    const from = ev.agentStart ? 'nobody: a prompt to the agent starts it' : `${ev.from ?? ev.id}${ev.addr ? ` · ${ev.addr}` : ''}`;
    const ways = js.map((j) => `<div class="dvo-out">
        <div class="dvo-out-head"><b>${esc(j.outcome?.id ?? 'on arrival')}</b><span class="dvo-dim">${esc(j.kind)}</span></div>
        ${j.outcome ? line('Take it', esc(j.outcome.when)) : ''}
        ${line('Pay', esc(j.pay))}
        ${line('Spec', tags(j.spec))}
      </div>`).join('');
    const html = `<div class="dvb-card">
      <div class="dvb-title"><b>${esc(js[0].outcome?.effects?.createApp?.name ?? ev.subject ?? ev.id)}</b><span class="dvb-pill ${st.ok ? 'ok' : 'off'}">${esc(st.label)}</span></div>
      ${line('From', esc(from) + (lead ? ` <span class="dvo-dim">(lead: ${esc(lead.site)} post <code>${esc(lead.id)}</code>)</span>` : ''))}
      ${line('Needs', tags(triggerText(ev.trigger)))}
      ${ways}
    </div>`;
    return { html, r: rank(st.label), day: ev.trigger.dayMin ?? 1 };
  });
  return cards.sort((a, b) => a.r - b.r || a.day - b.day).map((x) => x.html).join('');
}

// ── Qmail ──

function qmailOptions(store: GameStore): string {
  const s = store.state;
  const c = store.content;
  const open = activeDeliveries(s).filter((d) => d.site === 'qmail')
    .map((d) => ({ d, e: c.events.find((x) => x.id === d.eventId) }))
    .filter((x): x is { d: typeof x.d; e: GameEvent } => !!x.e && !!x.e.outcomes?.length);
  const leads = c.events.filter((e) => e.site === 'qmail' && e.latent && e.addr && !s.fired.includes(e.id) && triggerMatches(s, e.trigger));
  // where the player learns each lead's address: a Y post or email that mentions it
  const source = (addr: string) => c.events.find((e) => !e.latent && e.addr === addr && s.fired.includes(e.id) && e.site !== 'qmail');
  const scripted = c.contacts.filter((k) => k.scripted?.length).map((k) => `<div class="dvb-card">
      <div class="dvb-title"><b>${esc(k.name ?? k.key)}</b><span class="dvo-dim">${esc(k.key)}</span></div>
      ${k.scripted!.map((t) => `<div class="dvo-out"><div class="dvo-out-head"><b>${esc(t.id)}</b></div>${line('When', esc(t.when))}${line('Reply', quote(t.reply))}</div>`).join('')}
    </div>`).join('');
  const misses = c.contacts.filter((k) => k.reply).map((k) => `<div class="dvo-miss"><b>${esc(k.name ?? k.key)}</b> <span class="dvo-dim">${esc(k.key)}</span>${quote(k.reply!)}</div>`).join('');
  const sent = s.sentToday.length ? `<p class="dvo-note">Already emailed today, so another email bounces unless it gets a scripted answer: ${s.sentToday.map((a) => `<code>${esc(a)}</code>`).join(', ')}</p>` : '';
  return sent
    + section('Open threads', 'reply to the email; a matched outcome sends its scripted reply', open.map(({ d, e }) => eventCard(s, e, '', d.day)).join(''))
    + section('Leads you can email', 'compose a new email to the address', leads.map((e) => {
      const src = source(e.addr!);
      return eventCard(s, e, src ? `from ${src.site} post` : 'address not shown yet');
    }).join(''))
    + section('Test bookings', `an uncancelled booking costs ${NO_SHOW.fee} DOLR on its night and sets ${NO_SHOW.flag}`, testBookings(s))
    + section('Phishing', 'the fake Coinbin link; Qdrive\'s passwords.txt has the password it wants', phishing(store))
    + section('Scripted topics', 'these contacts always answer this the same way', scripted)
    + section('Misses', 'Haiku answers in character; these stand in when it cannot', misses ? `<div class="dvb-card">${misses}</div>` : '');
}

/** The player's restaurant bookings and which of them will cost a no-show fee. */
function testBookings(s: GameState): string {
  return s.bookings.map((b) => {
    const status = b.noShow ? 'charged' : b.cancelled || b.cancelClicked ? 'cancelled' : b.date < s.values.day ? 'passed' : b.date === s.values.day ? 'fee tonight' : 'fee on its night';
    const pill = status === 'charged' ? 'bad' : status === 'cancelled' || status === 'passed' ? 'off' : 'ok';
    return `<div class="dvb-card"><div class="dvb-title"><b>${esc(b.name)}</b><span class="dvo-dim">${esc(b.email)}</span><span class="dvb-pill ${pill}">${esc(status)}</span></div>
      <div class="dvo-dim">Day ${b.date} · ${esc(b.time)} · party of ${b.party} · <code>${esc(b.appId)}</code></div></div>`;
  }).join('');
}

/** The day 3 phishing mail, where it stands, and the passwords.txt it pays off. */
function phishing(store: GameStore): string {
  const s = store.state;
  const ev = store.content.events.find((e) => e.id === 'd3_coinbin_phish');
  if (!ev) return '';
  const d = s.delivered.find((x) => x.eventId === ev.id);
  const status = hacked(s) ? 'hacked' : d ? `arrived day ${d.day}` : s.fired.includes(ev.id) ? 'closed' : triggerMatches(s, ev.trigger) ? 'arrives next morning' : 'locked';
  const pw = PASSWORDS.map((p) => `<div class="dvo-miss"><b>${esc(p.site)}</b> <span class="dvo-dim">${esc(p.login)}</span> <code>${esc(p.password)}</code>${p.password === COINBIN_PASSWORD ? ' <span class="dvb-tag on">works on the fake page</span>' : ''}</div>`).join('');
  return `<div class="dvb-card">
    <div class="dvb-title"><b>${esc(ev.from ?? ev.id)}</b><span class="dvo-dim">${esc(ev.addr ?? '')}</span><span class="dvb-pill ${status === 'locked' || status === 'closed' ? 'off' : status === 'hacked' ? 'bad' : 'ok'}">${esc(status)}</span></div>
    <div class="dvo-dim">${esc(ev.subject ?? '')} · <code>${esc(ev.id)}</code></div>
    ${line('Needs', tags(triggerText(ev.trigger)))}
    ${line('Link', `<code>${PHISH_DOMAIN}/verify</code>`)}
    ${line('Right password', tags([`sends all ${s.values.crypto.toFixed(2)} DOLR away`, 'sets coinbin_hacked', 'shows the hacked screen']))}
    ${line('Wrong password', esc('"Incorrect password. Try again." Nothing changes.'))}
  </div><div class="dvb-card"><div class="dvb-title"><b>passwords.txt</b><span class="dvo-dim">Qdrive · Documents</span></div>${pw}</div>`;
}

// ── Y ──

const CATEGORY_NOTE: Record<string, string> = {
  reaction: 'on a trending topic',
  launch: 'announcing something you made',
  tip: 'useful advice; the default for anything off-trend',
  humor: '',
  hot_take: `costs family trust 5 to 10`,
  self_promo: 'loses followers',
  spam: 'repeats a recent post; loses followers',
};

function yOptions(store: GameStore): string {
  const s = store.state;
  const c = store.content;
  const f = s.values.followers;
  const trending = trendingAt(c, s.values.day, s.clockMin);
  const rows = Object.entries(POST_BANDS).map(([cat, [lo, hi]]) => {
    const c0 = cat as keyof typeof POST_BANDS;
    const ends = [postBase(c0, 0, f), postBase(c0, 1, f)].flatMap((v) => [v * (1 - YCFG.postJitter), v * (1 + YCFG.postJitter)]).map(Math.round);
    const a = Math.min(...ends), b = Math.max(...ends);
    const pct = `${signed(Math.round(lo * 100))}% to ${signed(Math.round(hi * 100))}%`;
    return `<tr><td><code>${esc(cat)}</code></td><td>${pct}</td><td>${a === b ? signed(a) : `${signed(a)} to ${signed(b)}`}</td><td class="dvo-dim">${esc(CATEGORY_NOTE[cat] ?? '')}</td></tr>`;
  }).join('');
  const left = Math.max(0, YCFG.maxFreePostsPerDay - s.postsToday);
  const posts = `<p class="dvo-note">${s.postsToday} of ${YCFG.maxFreePostsPerDay} posts today. ${left ? `${left} left before overposting` : 'Overposting now'}: every extra post costs ${Math.round(-YCFG.overpostPenaltyPct * 100)}% of followers${Math.round(f * YCFG.overpostPenaltyPct) ? ` (${signed(Math.round(f * YCFG.overpostPenaltyPct))})` : ''}.</p>`;
  const table = `<table class="dvo-table"><thead><tr><th>Jev rates it</th><th>Followers</th><th>At ${f}</th><th></th></tr></thead><tbody>${rows}</tbody></table><p class="dvo-dim">Where in the range depends on the quality Jev gives the post, then lands randomly within ±${Math.round(YCFG.postJitter * 100)}%. Small accounts get a flat amount instead when it is bigger.</p>`;
  // posts on Y that lead somewhere: an address that opens a Qmail lead
  const leads = s.delivered.filter((d) => d.site === 'y').map((d) => c.events.find((e) => e.id === d.eventId)).filter((e): e is GameEvent => !!e?.addr).map((e) => {
    // an address can lead to several leads in turn (Mara's first ask, then her follow-up): show the open one
    const all = c.events.filter((x) => x.site === 'qmail' && x.latent && x.addr === e.addr);
    const lead = all.find((x) => !s.fired.includes(x.id) && triggerMatches(s, x.trigger)) ?? all.find((x) => !s.fired.includes(x.id)) ?? all[0];
    const status = !lead ? 'no lead' : s.fired.includes(lead.id) ? 'already emailed' : triggerMatches(s, lead.trigger) ? 'open' : 'not yet';
    const outs = lead?.outcomes?.map((o) => `<b>${esc(o.id)}</b>: ${esc(o.when)}`).join('<br>') ?? '';
    return `<div class="dvb-card"><div class="dvb-title"><b>${esc(e.from ?? e.id)}</b><span class="dvo-dim">email ${esc(e.addr)}</span><span class="dvb-pill ${status === 'open' ? 'ok' : 'off'}">${status}</span></div>${line('Outcomes', outs)}</div>`;
  }).join('');
  // story events gated on followers
  const gated = c.events.filter((e) => e.trigger.values?.followers).map((e) => {
    const met = triggerMatches(s, e.trigger);
    const status = s.fired.includes(e.id) ? 'arrived' : met ? 'arrives tomorrow' : 'locked';
    return `<div class="dvb-card"><div class="dvb-title"><b>${esc(e.from ?? e.id)}</b><span class="dvo-dim">followers ${esc(e.trigger.values!.followers)} · from day ${e.trigger.dayMin ?? 1}</span><span class="dvb-pill ${status === 'locked' ? 'off' : 'ok'}">${status}</span></div>${e.subject ? `<div class="dvo-dim">${esc(e.subject)} · <code>${esc(e.id)}</code></div>` : ''}</div>`;
  }).join('');
  return posts
    + section('Trending today', 'a post that shares a word with one rates as a reaction', trending.length ? `<div class="dvb-card">${tags(trending)}</div>` : '')
    + section('Post ratings', 'Jev sorts each post into one category', `<div class="dvb-card">${table}</div>`)
    + section('Leads on the timeline', 'email the address to start the story', leads)
    + section('Follower-gated story', 'emails that arrive once you have enough followers', gated);
}
