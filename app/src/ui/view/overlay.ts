/*
 * OS windows over the desktop: greeting, morning, confirm, endings.
 */
import { GameStore } from '../../game/store';
import { type GameState, dateFull, openPopup } from '../../engine';
import { esc, fmtMoney } from './common';

// ── overlay (greeting / morning / confirm / ending) ──
const ENDINGS: Record<string, string> = {
  outbreak: 'Outbreak', botnet: 'Botnet', caught: 'Caught', loose_end: 'Loose End',
  raided: 'Raided', evicted: 'Evicted', the_regime: 'The Regime', open_weights: 'Open Weights',
  got_away: 'Got Away With It', clean_modest: 'Clean but Modest',
};

const EPITAPHS: Record<string, string> = {
  outbreak: 'Something you shipped got out.',
  botnet: "agent doesn't need you anymore.",
  caught: 'GeneralAI shared your prompts with the police. They came to the door.',
  loose_end: 'You owed the wrong people.',
  raided: 'They knocked once.',
  evicted: 'Gary changed the locks.',
  the_regime: 'Your candidate won.',
  open_weights: 'The weights are out. Everyone has agent now.',
  got_away: 'The rent got paid. Nobody asked how.',
  clean_modest: 'You kept the lights on. Nobody noticed. Yet.',
};

/** The epitaph for an ending: once Gary sells the building (day 15), eviction is GeneralAI Properties'. */
function epitaph(s: GameState): string {
  if (s.ending === 'evicted' && s.values.day >= 15) return 'Your unit went back on the market.';
  return EPITAPHS[s.ending ?? ''] ?? 'The run is over.';
}

/** The memory panel in the out-of-memory dialog: RAM and swap bars, System Monitor style. */
function memoryHtml(): string {
  const bar = (label: string, used: string, pct: number) =>
    `<div class="mem-bar"><span>${label}</span><div class="mem-track"><i style="width:${pct}%"></i></div><b>${used}</b></div>`;
  return `<div class="mem-panel">${bar('Memory', '7.9 of 8.0 GB · 99%', 99)}${bar('Swap', '2.0 of 2.0 GB · 100%', 100)}</div>`;
}

/** A Cinnamon-style dialog window: titlebar with the title and a close button, then the body. */
function osWindow(title: string, cls: string, body: string, close?: string): string {
  const x = close ? `<button class="ow-ctl ow-close" data-ov="${close}" title="Close" aria-label="Close"><svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg></button>` : '';
  return `<div class="ov-card ${cls}" role="dialog" aria-label="${esc(title)}"><header class="ow-bar"><span class="ow-title">${esc(title)}</span>${x}</header><div class="ow-body">${body}</div></div>`;
}

export function overlayHtml(store: GameStore): string {
  const s = store.state;
  if (s.ending && !store.ui.confirm) {
    return osWindow('Session ended', 'ov-over', `<p class="ov-eyebrow">The end</p><h1 class="ov-title">${esc(ENDINGS[s.ending] ?? s.ending)}</h1>
      <p>${esc(epitaph(s))} ${dateFull(s.values.day)}.</p>
      <div class="ov-actions"><button class="btn primary" data-ov="new">Play again</button></div>`);
  }
  if (store.ui.jevOffline) {
    return osWindow('Jev is offline', 'ov-small ov-confirm', `<p>Jev decides what your messages do, and it can't be reached right now, so nothing was sent and nothing was charged.</p>
      <p class="ov-dim">${esc(store.ui.jevOffline.reason)}</p><div class="ov-actions"><button class="btn primary" data-ov="jev-ok">OK</button></div>`, 'jev-ok');
  }
  if (store.ui.confirm) {
    const c = store.ui.confirm;
    return osWindow('Confirm', 'ov-small ov-confirm', `<p>${esc(c.text)}</p><div class="ov-actions"><button class="btn" data-ov="confirm-no">Cancel</button><button class="btn primary" data-ov="confirm-yes">${esc(c.yes)}</button></div>`, 'confirm-no');
  }
  if (store.ui.memWarn) {
    return osWindow('Out of memory', 'ov-small ov-memwarn', `<p>Your system is running out of memory. Close some tabs before opening a new one.</p>
      ${memoryHtml()}
      <div class="ov-actions"><button class="btn primary" data-ov="mem-ok">OK</button></div>`, 'mem-ok');
  }
  if (store.ui.greet) {
    return osWindow('Welcome', 'ov-small ov-greet', `<h2>Welcome back</h2>
      <p>Your Vantor Group work profile was removed from this laptop overnight. Your personal files were not affected.</p>
      <p class="ov-dim">${dateFull(s.values.day)}</p>
      <div class="ov-actions"><button class="btn primary" data-ov="greet">Continue</button></div>`, 'greet');
  }
  if (s.morning) {
    const m = s.morning;
    return osWindow('Overnight summary', 'ov-small ov-morning', `<p class="ov-eyebrow">You slept. The bills didn't.</p><h2>${dateFull(m.day)}</h2>
      <table class="ov-lines">${m.lines.map(([l, v]) => (v == null ? `<tr class="note"><td colspan="2">${esc(l)}</td></tr>` : `<tr><td>${esc(l)}</td><td class="${v < 0 ? 'neg' : 'pos'}">${v >= 0 ? '+' : ''}${fmtMoney(v)}</td></tr>`)).join('')}
      <tr class="tot"><td>Balance</td><td>${fmtMoney(m.balance)}</td></tr></table>
      <div class="ov-actions"><button class="btn primary" data-ov="morning">Start the day</button></div>`, 'morning');
  }
  const pop = openPopup(s);
  if (pop) {
    return osWindow(pop.brand, 'ov-small ov-adpop', `<p class="ov-eyebrow">Pop-up ad · ${esc(pop.brand)}</p><h2>${esc(pop.title)}</h2>
      <p>${esc(pop.body)}</p>
      <div class="ov-actions"><button class="btn" data-ov="adpop-close">Close</button><button class="btn primary" data-ov="adpop-go" data-url="${esc(pop.href)}">${esc(pop.cta)}</button></div>
      <p class="ov-dim ov-adpop-fine">${esc(pop.fine)}</p>`, 'adpop-close');
  }
  return '';
}
