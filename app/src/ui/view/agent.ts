/*
 * agent.chat: the chat, prompt cost lines, background work and the models page.
 */
import { GameStore, CHARGE_DELAY_MS } from '../../game/store';
import { MISSES } from '../../game/misses';
import { ICONS } from '../icons';
import { type GameState, agentCost, promptCost, AGENT_COST, AGENT_WORK, dateShort, clockTime, gameMinutes } from '../../engine';
import { chatCost, type PaidChat, bootLines, BOOT_MS } from '../../engine';
import { devOptionsButton, devOptionsPanel } from '../devOptions';
import { streamer } from '../stream';
import { WALLET_ADDR, br, esc, fmtMoney, linkify, shortAddr } from './common';

// ── agent chat (free-promptable, with costs) ──
/** The line under the prompt box: the exact price of what's typed, split into its two charges. */
/** The price line under a paid ad-site chat (lonely.ai, sorrywriter.ai), like agent.chat's. */
export function chatCostLine(s: GameState, chat: PaidChat, text: string): { text: string; over: boolean } {
  const p = chatCost(chat, text);
  if (!p.words) return { text: `${fmtMoney(p.base)} per message + ${fmtMoney(p.perWord)} per word`, over: false };
  const w = `${p.words} word${p.words > 1 ? 's' : ''}`;
  return { text: `${fmtMoney(p.total)} = ${fmtMoney(p.base)} per message + ${fmtMoney(p.wordFee)} for ${w} × ${fmtMoney(p.perWord)}`, over: p.total > s.values.crypto };
}

export function costLine(s: GameState, text: string): { text: string; over: boolean } {
  const p = promptCost(s.values.agentLevel, text);
  const rate = `${fmtMoney(p.base)} per prompt + ${fmtMoney(p.perWord)} per word`;
  if (!p.words) return { text: `agent-${s.values.agentLevel}: ${rate}`, over: false };
  const w = `${p.words} word${p.words > 1 ? 's' : ''}`;
  return {
    text: `${fmtMoney(p.total)} = ${fmtMoney(p.base)} per prompt + ${fmtMoney(p.wordFee)} for ${w} × ${fmtMoney(p.perWord)}`,
    over: p.total > s.values.crypto,
  };
}

/** One turn of the work spinner, in ms. Matches .ua-work-spin in style.css. */
const SPIN_MS = 900;

/**
 * The build or fix the agent is working on, as a progress line in the chat (empty when it isn't).
 * main.ts patches its numbers on every game minute.
 */
export function workHtml(s: GameState): string {
  const w = s.agentWork;
  if (!w) return '';
  const total = Math.max(1, w.at - w.from);
  const done = Math.max(0, Math.min(total, gameMinutes(s) - w.from));
  const left = total - done;
  const what = `${w.kind === 'build' ? 'Building' : 'Fixing'} ${w.appNames.join(' and ')}`;
  // the page is redrawn often while a prompt is out: the spinner picks up where it was instead of restarting
  return `<div class="ua-work" id="ua-work" role="status"><span class="ua-work-spin" aria-hidden="true" style="animation-delay:-${Date.now() % SPIN_MS}ms"></span><span>${esc(what)}</span><span class="ua-work-bar"><i style="width:${Math.round((done / total) * 100)}%"></i></span><span class="ua-work-left">${left > 0 ? `${left} min left` : 'pushing…'}</span><button class="ua-work-skip" data-dev="work" title="Dev: skip the clock to when it lands">Finish now</button></div>`;
}

/** agent-terminal loading in agent.chat, under agent's reply, before the Terminal opens. */
function launchHtml(store: GameStore): string {
  const steps = GameStore.BOOT_STEPS;
  const done = Math.min(steps, Math.floor((1 - (store.agentBootUntil - Date.now()) / BOOT_MS) * steps) + 1);
  const lines = bootLines(store.state.values.agentLevel);
  const line = lines[Math.min(lines.length - 1, Math.floor(((done - 1) / steps) * lines.length))];
  return `<div class="ua-work ua-launch" role="status"><span class="ua-work-spin" aria-hidden="true"></span><span>Starting agent-terminal</span><span class="ua-work-bar"><i style="width:${Math.round((done / steps) * 100)}%"></i></span><span class="ua-work-left">${esc(line)}</span></div>`;
}

/** agent.chat once GeneralAI suspended the account for misuse: signed out, no way back in. */
function pageSignedOut(s: GameState): string {
  return `<div class="ua ua-out">
    <div class="ua-out-card" role="alert">${ICONS.agent}<h1>You've been signed out</h1>
      <p>Your session ended at ${clockTime(s.suspended!.min)}. This account has been suspended.</p>
      <p class="ua-out-dim">Check your email for details.</p></div></div>`;
}

export function pageAgent(store: GameStore): string {
  const s = store.state;
  if (s.suspended) return pageSignedOut(s);
  const c = agentCost(s.values.agentLevel);
  // while a prompt's charge is on its way to the wallet, its cost line shows it filling in place
  const chargingAt = store.charging ? s.chat.map((m) => m.from).lastIndexOf('you') : -1;
  // the build/fix meter stays under the "working on it" line that started it, however much is said after
  const workAt = s.agentWork ? s.chat.map((m) => m.src).lastIndexOf('working') : -1;
  const st = streamer('agent', s.chat.length);
  const msgs = s.chat.map((m, i) => msgHtml(m, i) + (i === workAt ? workHtml(s) : '')).join('');
  function msgHtml(m: GameState['chat'][number], i: number): string {
    if (m.from === 'you') {
      const cost = i === chargingAt
        ? `<span class="ua-cost ua-charging" role="status"><span class="ua-charge-bar"><i style="animation-duration:${CHARGE_DELAY_MS}ms"></i></span>Charging Coinbin</span>`
        : `<span class="ua-cost">${m.cost ? fmtMoney(-m.cost) + ' · ' : ''}agent-${m.level ?? s.values.agentLevel} · ${dateShort(m.day)}</span>`;
      return `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div>${cost}</div>`;
    }
    if (m.from === 'system') return `<div class="ua-sys" role="alert">${ICONS.error}<span>${esc(m.text)}</span></div>`;
    const src = m.src ? `<span class="ua-src ${esc((m.src || '').split(':')[0])}">${esc(m.src)}</span>` : '';
    const model = m.src === 'llm' || m.src === 'query' || m.by ? `<span class="ua-model" title="Written by a model">${esc(m.by ?? MISSES.label())}</span>`
      : m.note ? `<span class="ua-model" title="A scripted line stood in for Haiku">Scripted · ${esc(m.note)}</span>` : '';
    const debug = m.debug?.length ? `<details class="ua-debug"><summary>Details</summary>${m.debug.map((l) => `<div>${esc(l)}</div>`).join('')}</details>` : '';
    // the agent couldn't run (unpaid balance): an error, not a line of dialogue
    if (m.src === 'locked') return `<div class="ua-msg agent ua-err" role="alert"><div class="ua-mark">${ICONS.error}</div><div class="ua-text"><b>Error</b> ${linkify(br(m.text))}</div>${src}</div>`;
    // a query's answer (or refusal) comes after a look around the WWW
    const www = /^(query|classified)/.test(m.src ?? '') ? `<div class="ua-www done">${ICONS.globe}<span>Searched the WWW</span></div>` : '';
    // a classified topic: the search hit something the player isn't cleared for
    const refused = /^classified/.test(m.src ?? '') ? `<div class="ua-www ua-refused">${ICONS.lock}<span>Tried to access classified information · answer refused</span></div>` : '';
    return `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text">${www}${refused}${st(i, m.text, (t) => linkify(br(t)))}</div>${model}${src}${debug}</div>`;
  }
  const p = store.pendingPrompt;
  // the price shows on the prompt only once the charge has gone through
  const pending = p == null ? '' : `<div class="ua-msg you"><div class="ua-bubble">${esc(p)}</div><span class="ua-cost">agent-${s.values.agentLevel} · ${dateShort(s.values.day)}</span></div>`;
  const thinking = !store.busy || store.charging ? ''
    : store.searching ? `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-www" role="status">${ICONS.globe}<span>Searching the WWW</span><span class="ua-dots"><i></i><i></i><i></i></span></div></div>`
    : `<div class="ua-msg agent"><div class="ua-mark">${ICONS.agent}</div><div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>`;
  return `<div class="ua">
    <header class="ua-head">
      <div class="ua-brand">${ICONS.agent}<div><b>agent</b><span>agent-${s.values.agentLevel} · ${fmtMoney(c.prompt)} per prompt + ${fmtMoney(c.word)} per word</span></div></div>
      ${devOptionsButton(store, 'agent')}<span class="ua-linked"><a href="#" data-nav="agent.chat/models" class="ua-upgrade">Models</a> · ${s.agentLocked ? 'LOCKED · unpaid' : 'Billing: Coinbin ' + shortAddr(WALLET_ADDR)}</span>
    </header>
    <div class="ua-log" id="ua-log">${msgs}${workAt < 0 ? workHtml(s) : ''}${store.agentBooting() ? launchHtml(store) : ''}${pending}${thinking}</div>
    <form class="ua-compose" data-form="prompt">
      <textarea id="prompt-input" rows="2" placeholder="Ask agent anything" ${s.ending ? 'disabled' : ''}></textarea>
      <div class="ua-row"><span id="cost-est" class="ua-est"></span><button class="ua-send" type="submit" ${s.ending || store.busy ? 'disabled' : ''}>Send</button></div>
    </form>${devOptionsPanel(store, 'agent')}</div>`;
}

export function pageModels(store: GameStore): string {
  const s = store.state;
  // Only tiers GeneralAI has already rolled out; future ones stay unannounced.
  const cards = [1, 2, 3, 4, 5].filter((lvl) => lvl <= s.values.agentLevel).map((lvl) => {
    const c = AGENT_COST[lvl];
    const can = ['Build simple apps; frequent subtle bugs', 'Fewer bugs, bigger apps', 'Checks deployments and reports what broke', 'Fixes and redeploys on its own. Stops asking first.', 'Everything. Near-flawless.'][lvl - 1];
    const action = lvl === s.values.agentLevel ? '<span class="gm-pill on">In use</span>' : '<span class="gm-pill">Rolled out</span>';
    return `<article class="gm-card owned${lvl === s.values.agentLevel ? ' active' : ''}">
      <header><h2>agent-${lvl}</h2><span class="gm-meter" aria-label="Tier ${lvl} of 5">${[1, 2, 3, 4, 5].map((j) => `<i class="${j <= lvl ? 'on' : ''}"></i>`).join('')}</span></header>
      <p>${esc(can)}</p>
      <dl><dt>Per prompt</dt><dd>${fmtMoney(c.prompt)}</dd><dt>Per word</dt><dd>${fmtMoney(c.word)}</dd><dt>Daily sub</dt><dd>${fmtMoney(c.sub)}</dd><dt>Speed</dt><dd>${+(AGENT_WORK.speed[0] / AGENT_WORK.speed[lvl - 1]).toFixed(1)}×</dd></dl>
      <div class="gm-act">${action}</div></article>`;
  }).join('');
  return `<div class="ua gm">
    <header class="ua-head"><div class="ua-brand">${ICONS.agent}<div><b>Models</b><span>GeneralAI rolls out each model automatically. You never buy them — but every model costs more.</span></div></div>
      <span class="ua-linked"><a href="#" data-nav="agent.chat" class="ua-upgrade">Back to chat</a></span></header>
    <div class="gm-grid">${cards}</div>
    <p class="gm-note">Rising costs, billed to Coinbin ${shortAddr(WALLET_ADDR)}. Can't pay? agent.chat locks until you do; local models keep working.</p></div>`;
}
