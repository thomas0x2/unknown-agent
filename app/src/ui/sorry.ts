/*
 * sorrywriter.ai: the SorryWriter banner ad's site, an apology chat laid out like agent.chat
 * (engine/sorry.ts; the apologies come from Haiku through store.sorrySend). Reuses agent.chat's .ua
 * layout, recoloured by .sorry in adSites.css.
 */
import type { GameStore } from '../game/store';
import { sorryChat, SORRY_OPENER } from '../engine/sorry';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** SorryWriter's logo: an envelope sealed with a tear. Used for the favicon, the ads and the chat avatar. */
export const SORRY_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><rect width="32" height="32" rx="8" fill="#3a2b52"/><rect x="6" y="10" width="20" height="14" rx="2.5" fill="#f4eefb"/><path d="M6.8 11.2 16 18.2l9.2-7" stroke="#3a2b52" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 15.2c-1.2 1.6-1.8 2.6-1.8 3.4a1.8 1.8 0 0 0 3.6 0c0-.8-.6-1.8-1.8-3.4Z" fill="#f29bb6" stroke="#3a2b52" stroke-width=".8"/></svg>`;
const AVATAR = `<span class="sw-avatar">${SORRY_ICON}</span>`;
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
