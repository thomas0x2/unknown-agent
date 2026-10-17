/*
 * sorrywriter.ai: the SorryWriter banner ad's site, an apology chat laid out like agent.chat
 * (engine/sorry.ts; the apologies come from Haiku through store.sorrySend). Reuses agent.chat's .ua
 * layout, recoloured by .sorry in adSites.css.
 */
import type { GameStore } from '../game/store';
import { sorryChat, SORRY_OPENER } from '../engine/sorry';
import { markIcon } from './adSites';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const SORRY_ICON = markIcon('✉', '#3a2b52', '#f4eefb');
const AVATAR = '<span class="sw-avatar" aria-hidden="true">✉</span>';
const bot = (text: string) => `<div class="ua-msg agent">${AVATAR}<div class="ua-text">${esc(text).replace(/\n/g, '<br>')}</div></div>`;

export function pageSorry(store: GameStore): string {
  const s = store.state;
  const msgs = sorryChat(s).msgs.map((m) => m.from === 'you' ? `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div></div>` : bot(m.text)).join('');
  const typing = store.ui.sorryTyping ? `<div class="ua-msg agent">${AVATAR}<div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>` : '';
  const err = store.ui.chatError ? `<p class="ua-err" role="alert">${esc(store.ui.chatError)}</p>` : '';
  return `<div class="ua sorry">
    <header class="ua-head">
      <div class="ua-brand">${AVATAR}<div><b>SorryWriter</b><span>Apologies, written for you</span></div></div>
    </header>
    <div class="ua-log" id="sw-log">${bot(SORRY_OPENER)}${msgs}${typing}</div>
    <form class="ua-compose" data-form="sorry">
      ${err}
      <textarea id="sorry-input" rows="2" placeholder="What happened?" ${s.ending ? 'disabled' : ''}></textarea>
      <div class="ua-row"><span id="sw-cost" class="ua-est"></span><button class="ua-send" type="submit" ${s.ending || store.ui.sorryTyping ? 'disabled' : ''}>Send</button></div>
    </form></div>`;
}
