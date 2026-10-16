/*
 * Story debugger: a window to set any meter and switch any story flag. The flag list is every flag
 * the content sets or checks, plus whatever the save already has.
 */
import type { GameStore } from '../game/store';
import type { Content, Effects } from '../content/schema';
import { METERS, METER_IDS, EMPIRE, clockTime } from '../engine';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Every flag the content can set or test, sorted. */
export function contentFlags(content: Content): string[] {
  const out = new Set<string>([EMPIRE.flag]);
  const fromEffects = (e?: Effects) => { for (const f of [...(e?.setFlags ?? []), ...(e?.clearFlags ?? [])]) out.add(f); };
  for (const ev of content.events) {
    const t = ev.trigger;
    for (const f of [...(t.flagsAll ?? []), ...(t.flagsNone ?? [])]) out.add(f);
    if (t.after) out.add(t.after.flag);
    fromEffects(ev.onDeliver);
    for (const o of ev.outcomes ?? []) fromEffects(o.effects);
  }
  return [...out].sort();
}

/** The editor's header: its tabs and the close button. */
export const devTabsHeader = (on: 'edit' | 'jev') => `<header><span class="dve-tabs">${([['edit', 'Flags and meters'], ['jev', 'Jev tests']] as const).map(([id, l]) => `<button data-act="devtab" data-devtab="${id}" class="${id === on ? 'on' : ''}">${l}</button>`).join('')}</span><button data-act="devedit" aria-label="Close">×</button></header>`;

export function devEditHtml(store: GameStore): string {
  const s = store.state;
  const meters = METER_IDS.map((id) => {
    const d = METERS[id];
    const range = `${d.min} to ${d.max ?? '∞'}`;
    return `<tr><td>${esc(d.label)}${d.visible ? '' : ' <span class="dv-dim">hidden</span>'}</td>
      <td><input type="number" class="dve-num" data-dev-meter="${id}" value="${s.values[id]}" min="${d.min}"${d.max != null ? ` max="${d.max}"` : ''} step="${id === 'crypto' ? '0.01' : '1'}"></td>
      <td class="dv-dim">${range}</td></tr>`;
  }).join('');
  const flags = [...new Set([...contentFlags(store.content), ...s.flags])].sort().map((f) => {
    const on = s.flags.includes(f);
    return `<label class="dve-flag${on ? ' on' : ''}"><input type="checkbox" data-dev-flag="${esc(f)}"${on ? ' checked' : ''}>${esc(f)}${on && s.flagDays[f] != null ? ` <span class="dv-dim">d${s.flagDays[f]}</span>` : ''}</label>`;
  }).join('');
  const coming = (s.arriving ?? []).slice().sort((a, b) => a.day - b.day || a.at - b.at).map((a) => {
    const ev = store.content.events.find((e) => e.id === a.eventId);
    return `<p class="dv-dim">${a.day < s.values.day ? 'next morning' : clockTime(a.at)} · ${esc(ev?.site ?? '')} · ${esc(ev?.subject ?? ev?.from ?? a.eventId)}</p>`;
  }).join('');
  return `${devTabsHeader('edit')}
    <h3>Meters</h3>
    <p class="dv-dim">Changes apply when you leave the field. Changing the day skips the nights and starts that day's morning; its events arrive over the day.</p>
    <table class="dve-meters">${meters}</table>
    <h3>Flags</h3>
    <form class="dve-add" data-form="dev-flag"><input id="dev-flag-name" placeholder="add a flag" autocomplete="off" spellcheck="false"><button type="submit">Set</button></form>
    <div class="dve-flags">${flags}</div>
    <h3>On its way today</h3>
    ${coming || '<p class="dv-dim">Nothing else is due today.</p>'}
    <div class="dv-row"><button data-dev="deliver">Deliver due events now</button></div>`;
}
