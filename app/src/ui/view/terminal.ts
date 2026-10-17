/*
 * Weightroom and the Terminal window.
 */
import { invadersHtml } from '../invaders';
import { cwdLabel } from '../../game/shell';
import { GameStore } from '../../game/store';
import { ICONS } from '../icons';
import { DEEPSLEEP_LOGO } from '../../sites/deepsleepLogo';
import { adHtml } from '../ads';
import { MODELS, PULL_MS, pullLines, pullPct } from '../../game/pull';
import { READY, SUSPENDED_TERM, policyActive, type AgentTermLine } from '../../engine';
import { esc } from './common';

// ── Weightroom ──
const WR_MODELS = [{ id: 'deepsleep', blurb: 'The only model here that costs nothing. Replies in confident Chinese nonsense. Nobody is watching what you ask it.', tier: 'useless' }];

/** The progress bar on a Weightroom card while its model downloads. main.ts updates it each frame. */
export function pullBarHtml(pct: number): string {
  return `<span class="wr-pull" data-pull-bar><i style="width:${pct}%"></i><b>Downloading ${pct}%</b></span>`;
}

export function pageWeightroom(store: GameStore): string {
  const s = store.state;
  const cards = WR_MODELS.map((w) => {
    const m = MODELS[w.id];
    const have = s.localModels.includes(m.id);
    const pulling = store.pull?.id === m.id;
    const action = have ? '<span class="wr-have">On your laptop</span>'
      : pulling ? pullBarHtml(pullPct(store.pullMs()))
      : `<button class="wr-btn" data-download="${esc(m.id)}">Download</button>`;
    return `<article class="wr-card"><header><b>${w.id === 'deepsleep' ? `<span class="wr-mlogo">${DEEPSLEEP_LOGO}</span>` : ''}${esc(m.name)}</b><span class="wr-dl">↓ 1.2M</span></header>
      <p>${esc(w.blurb)}</p><div class="wr-tags"><span>${m.gb} GB</span><span>${esc(w.tier)}</span></div>
      ${action}</article>`;
  }).join('');
  return `<div class="wr"><header class="wr-top"><div class="wr-logo">${ICONS.weightroom}<span>Weightroom</span></div><span class="wr-sub">open weights for everyone</span></header>
    <div class="wr-wrap"><div class="wr-hero"><h1>Models</h1><p>Open weights you run on your own laptop, in the Terminal. Slower and dumber than agent — but no subscription, and no one logging your prompts.</p></div>
    ${adHtml('weightroom', s.values.day, 'wide')}
    <div class="wr-grid">${cards}</div></div></div>`;
}

// ── Terminal: its own window on the desktop, not a browser tab ──
/** The Terminal's scrollback and prompt, for the tab in front. Repainted on its own during a download. */
export function termBodyHtml(store: GameStore): string {
  return store.termTabShown() === 'agent' ? agentTermHtml(store) : shellHtml(store);
}

/** The laptop's own shell: local models. */
function shellHtml(store: GameStore): string {
  if (store.ui.invaders) return invadersHtml();
  const s = store.state;
  const pulling = !!store.pull;
  const name = s.termModel ? (MODELS[s.termModel]?.name ?? s.termModel) : '';
  // the pull log already says the model is running; the intro is for an empty screen
  const intro = pulling || s.terminal.length ? ''
    : name ? `${name} running on localhost. Type anything. (type 'help' for commands, 'clear' to wipe the screen)`
    : s.flags.includes('knows_weightroom') ? 'No model running. Download one from weightroom.ai first. Type help for a list of commands.' : 'No model running. Type help for a list of commands.';
  const row = (l: { k: string; text: string }) => `<div class="tm-${l.k}">${esc(l.text)}</div>`;
  const lines = s.terminal.slice(-200).map(row).join('');
  const live = store.pull ? pullLines(store.pull.id, Math.min(store.pullMs(), PULL_MS - 1)).map(row).join('') : '';
  const prompt = pulling ? '' : `<form class="tm-in" data-form="term"><label for="term-input" class="tm-ps">you@laptop:${esc(cwdLabel(store.ui.termCwd))}$</label><input id="term-input" autocomplete="off" autocapitalize="off" spellcheck="false" ${store.busy ? 'disabled' : ''}></form>`;
  return `${intro ? `<div class="tm-sys">${esc(intro)}</div>` : ''}${lines}${live}${store.busy ? '<div class="tm-sys tm-wait">thinking… (this laptop is not fast)</div>' : ''}${prompt}`;
}

/** agent-terminal: the agent's own shell, where hacks happen. */
function agentTermHtml(store: GameStore): string {
  const s = store.state;
  const level = s.values.agentLevel;
  const guard = policyActive(s);
  const game = s.hackGame;
  const head = `<div class="at-status"><span>agent-${level}</span><span class="at-gr${guard ? ' on' : ''}">guardrails ${guard ? 'on' : 'off'}</span>${game ? '<span class="at-block">job blocked</span>' : ''}</div>`;
  const row = (l: AgentTermLine) => {
    const debug = l.debug?.length ? `<details class="at-debug"><summary>Details</summary>${l.debug.map((d) => `<div>${esc(d)}</div>`).join('')}</details>` : '';
    return `<div class="at-${l.k}">${l.k === 'in' ? '<span class="at-ps">›</span> ' : ''}${esc(l.text)}</div>${debug}`;
  };
  // the agent's newest lines appear one after another (store.termReveal); the prompt shows as soon as it's sent
  const all = s.agentTerm ?? [];
  const hidden = Math.min(all.length, store.termHidden());
  const pending = store.termPending;
  const lines = all.slice(0, all.length - hidden).slice(-200).map(row).join('') + (pending != null ? row({ k: 'in', text: pending }) : '');
  // a Claude Code style spinner while the agent reads the prompt or works through its steps
  const working = pending != null || hidden > 0;
  const spin = working ? `<div class="at-spin" role="status"><span class="at-star" aria-hidden="true"></span>${hidden && store.termHack ? 'Hacking…' : 'Working…'}</div>` : '';
  if (s.suspended) return `${head}${lines}${(s.agentTerm ?? []).at(-1)?.k === 'err' ? '' : `<div class="at-err">${esc(SUSPENDED_TERM)}</div>`}`;
  const prompt = `<form class="tm-in" data-form="aterm"><label for="aterm-input" class="at-ps">${game ? 'guardrail ›' : 'agent ›'}</label><input id="aterm-input" autocomplete="off" autocapitalize="off" spellcheck="false" ${store.busy || working ? 'disabled' : ''}></form>`;
  // a fresh session (the line the store prints on opening) waits for its first prompt
  const ready = !working && ((s.agentTerm ?? []).at(-1)?.text.startsWith('──') ?? true);
  return `${head}${lines}${ready ? `<div class="tm-sys">${esc(READY)}</div>` : ''}${spin}${prompt}`;
}

/** The tabs along the top of the Terminal window. */
export function termTabsHtml(store: GameStore): string {
  const tabs = store.termTabs();
  const on = store.termTabShown();
  const label = { shell: 'you@laptop: ~', agent: 'agent-terminal' };
  return tabs.map((t) => `<button class="tw-tab${t === on ? ' on' : ''}" data-ttab="${t}" role="tab" aria-selected="${t === on}">${label[t]}</button>`).join('');
}

export function termTitle(store: GameStore): string {
  return store.termTabShown() === 'agent' ? `agent-terminal · agent-${store.state.values.agentLevel}` : 'you@laptop: ~';
}

export function termWindowHtml(store: GameStore): string {
  return `<header class="tw-bar"><span class="tw-ico">${ICONS.terminal}</span><span class="tw-title" id="tw-title">${esc(termTitle(store))}</span>
      <span class="tw-ctl"><button data-term="min" aria-label="Minimize" title="Minimize"><svg viewBox="0 0 24 24"><path d="M7 15h10"/></svg></button><button data-term="close" aria-label="Close" title="Close"><svg viewBox="0 0 24 24"><path d="m8 8 8 8M16 8l-8 8"/></svg></button></span></header>
    <nav class="tw-tabs" id="tw-tabs" role="tablist">${termTabsHtml(store)}</nav>
    <div class="tm" id="tm-log">${termBodyHtml(store)}</div>`;
}
