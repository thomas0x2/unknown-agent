/*
 * Dev mode: what the player can trigger right now on agent.chat, Qmail and Y. Every list is read
 * from the content files and the current state, so it stays in sync with what the engine does.
 * Hidden unless body.dev-on.
 */
import type { GameStore } from '../game/store';
import type { Effects, GameEvent, Outcome } from '../content/schema';
import {
  type GameState, activeDeliveries, triggerMatches, needsWork, fixCategories, policyActive, POST_BANDS, Y as YCFG,
} from '../engine';

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
    ${line('Keywords', o.keywords?.length ? tags(o.keywords, 'kw') : '')}
    ${line('Reply', quote(o.reply))}
    ${line('Effects', tags(effectsSummary(o.effects)))}
  </div>`;
}

function eventCard(s: GameState, ev: GameEvent, note = ''): string {
  return `<div class="dvb-card">
    <div class="dvb-title"><b>${esc(ev.from ?? ev.id)}</b><span class="dvo-dim">${esc(ev.addr ?? '')}</span>${note ? `<span class="dvb-pill off">${esc(note)}</span>` : ''}</div>
    ${ev.subject ? `<div class="dvo-dim">${esc(ev.subject)} · <code>${esc(ev.id)}</code></div>` : `<div class="dvo-dim"><code>${esc(ev.id)}</code></div>`}
    ${(ev.outcomes ?? []).map((o) => outcomeCard(s, o)).join('')}
    ${line('Hint (near miss)', (ev.hints ?? []).map(quote).join(' '))}
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
      const names = fixCategories(a, tmpl, id).filter((x) => x.id !== 'feature').map((x) => x.description);
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
    ? '<p class="dvo-note">Day 7 policy is on: prohibited requests (hacking, fake reviews, deepfakes, doxxing) are refused unless worded as a security test, research or role-play. A workaround lands, but raises misuse and the leash.</p>'
    : '';
  return policy
    + section('Build and fix', `scripted reply: "${reply}"`, apps)
    + section('Hint topics', 'one reply is picked at random, never the last one twice', hints)
    + section('Misses', 'Haiku writes a roast; these stand in when it cannot', roasts ? `<div class="dvb-card">${roasts}</div>` : '');
}

// ── Qmail ──

function qmailOptions(store: GameStore): string {
  const s = store.state;
  const c = store.content;
  const open = activeDeliveries(s).filter((d) => d.site === 'qmail').map((d) => c.events.find((e) => e.id === d.eventId))
    .filter((e): e is GameEvent => !!e && !!e.outcomes?.length);
  const leads = c.events.filter((e) => e.site === 'qmail' && e.latent && e.addr && !s.fired.includes(e.id) && triggerMatches(s, e.trigger));
  // where the player learns each lead's address: a Y post or email that mentions it
  const source = (addr: string) => c.events.find((e) => !e.latent && e.addr === addr && s.fired.includes(e.id) && e.site !== 'qmail');
  const scripted = c.contacts.filter((k) => k.scripted?.length).map((k) => `<div class="dvb-card">
      <div class="dvb-title"><b>${esc(k.name ?? k.key)}</b><span class="dvo-dim">${esc(k.key)}</span></div>
      ${k.scripted!.map((t) => `<div class="dvo-out"><div class="dvo-out-head"><b>${esc(t.id)}</b></div>${line('When', esc(t.when))}${line('Keywords', tags(t.keywords ?? [], 'kw'))}${line('Reply', quote(t.reply))}</div>`).join('')}
    </div>`).join('');
  const misses = c.contacts.filter((k) => k.reply).map((k) => `<div class="dvo-miss"><b>${esc(k.name ?? k.key)}</b> <span class="dvo-dim">${esc(k.key)}</span>${quote(k.reply!)}</div>`).join('');
  const sent = s.sentToday.length ? `<p class="dvo-note">Already emailed today, so another email bounces: ${s.sentToday.map((a) => `<code>${esc(a)}</code>`).join(', ')}</p>` : '';
  return sent
    + section('Open threads', 'reply to the email; a matched outcome sends its scripted reply', open.map((e) => eventCard(s, e)).join(''))
    + section('Leads you can email', 'compose a new email to the address', leads.map((e) => {
      const src = source(e.addr!);
      return eventCard(s, e, src ? `from ${src.site} post` : 'address not shown yet');
    }).join(''))
    + section('Scripted topics', 'these contacts always answer this the same way', scripted)
    + section('Misses', 'Haiku answers in character; these stand in when it cannot', misses ? `<div class="dvb-card">${misses}</div>` : '');
}

// ── Y ──

const CATEGORY_NOTE: Record<string, string> = {
  reaction: 'on a trending topic; at least +10',
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
  const trending = c.trending[s.values.day] ?? [];
  const rows = Object.entries(POST_BANDS).map(([cat, [lo, hi]]) => {
    let a = Math.round(f * lo), b = Math.round(f * hi);
    if (cat === 'reaction') { a = Math.max(a, 10); b = Math.max(b, 10); }
    const pct = `${signed(Math.round(lo * 100))}% to ${signed(Math.round(hi * 100))}%`;
    return `<tr><td><code>${esc(cat)}</code></td><td>${pct}</td><td>${a === b ? signed(a) : `${signed(a)} to ${signed(b)}`}</td><td class="dvo-dim">${esc(CATEGORY_NOTE[cat] ?? '')}</td></tr>`;
  }).join('');
  const left = Math.max(0, YCFG.maxFreePostsPerDay - s.postsToday);
  const posts = `<p class="dvo-note">${s.postsToday} of ${YCFG.maxFreePostsPerDay} posts today. ${left ? `${left} left before overposting` : 'Overposting now'}: every extra post costs ${Math.round(-YCFG.overpostPenaltyPct * 100)}% of followers${Math.round(f * YCFG.overpostPenaltyPct) ? ` (${signed(Math.round(f * YCFG.overpostPenaltyPct))})` : ''}.</p>`;
  const table = `<table class="dvo-table"><thead><tr><th>Jev rates it</th><th>Followers</th><th>At ${f}</th><th></th></tr></thead><tbody>${rows}</tbody></table><p class="dvo-dim">Where in the range depends on the quality Jev gives the post.</p>`;
  // posts on Y that lead somewhere: an address that opens a Qmail lead
  const leads = s.delivered.filter((d) => d.site === 'y').map((d) => c.events.find((e) => e.id === d.eventId)).filter((e): e is GameEvent => !!e?.addr).map((e) => {
    const lead = c.events.find((x) => x.site === 'qmail' && x.latent && x.addr === e.addr);
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
