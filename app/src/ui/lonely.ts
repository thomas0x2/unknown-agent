/*
 * lonely.ai: the Lonely.ai banner ad's site, a dating chat laid out like agent.chat (engine/lonely.ts
 * scripts Mia's side). Reuses agent.chat's .ua layout, recoloured pink by .lonely in adSites.css.
 */
import type { GameStore } from '../game/store';
import { lonelyChat, MATCH } from '../engine/lonely';
import { markIcon } from './adSites';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export const LONELY_ICON = markIcon('♥', '#e0336f', '#fff');
const AVATAR = '<span class="lo-avatar" aria-hidden="true">M</span>';

export function pageLonely(store: GameStore): string {
  const s = store.state;
  const c = lonelyChat(s);
  const msgs = c.msgs.map((m) => m.from === 'you'
    ? `<div class="ua-msg you"><div class="ua-bubble">${esc(m.text)}</div></div>`
    : `<div class="ua-msg agent">${AVATAR}<div class="ua-text">${esc(m.text)}</div></div>`).join('');
  const intro = c.msgs.length ? '' : `<p class="lo-intro">You matched with ${MATCH.name}. Say hi.</p>`;
  const typing = store.ui.lonelyTyping ? `<div class="ua-msg agent">${AVATAR}<div class="ua-text ua-dots"><i></i><i></i><i></i></div></div>` : '';
  return `<div class="ua lonely">
    <header class="ua-head">
      <div class="ua-brand">${AVATAR}<div><b>${MATCH.name}, ${MATCH.age}</b><span>${esc(MATCH.line)} · ${esc(MATCH.bio)}</span></div></div>
      <span class="ua-linked lo-logo">${LONELY_ICON}Lonely.ai</span>
    </header>
    <div class="ua-log" id="lo-log">${intro}${msgs}${typing}</div>
    <p class="lo-fine">Some members are generated to keep the community active.</p>
    <form class="ua-compose" data-form="lonely">
      ${store.ui.chatError ? `<p class="ua-err" role="alert">${esc(store.ui.chatError)}</p>` : ''}
      <textarea id="lonely-input" rows="2" placeholder="Message ${MATCH.name}" ${s.ending ? 'disabled' : ''}></textarea>
      <div class="ua-row"><span id="lo-cost" class="ua-est"></span><button class="ua-send" type="submit" ${s.ending || store.ui.lonelyTyping ? 'disabled' : ''}>Send</button></div>
    </form></div>`;
}
