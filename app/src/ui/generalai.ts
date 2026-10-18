/*
 * GeneralAI's email look: the agent asterisk and the GeneralAI name over a hairline, the message as
 * written, and a small grey footer, the way a large company's account emails look. Used by Qmail for
 * every address at generalai.test (welcome, rollouts, policy, Trust & Safety, GeneralAI Properties).
 */
import { ICONS } from './icons';

export const GAI_INK = '#121a4a';

/** Emails from GeneralAI or one of its subsidiaries (properties.generalai.test). */
export const isGaiAddr = (addr: string | undefined): boolean => /@([a-z0-9-]+\.)*generalai\.test$/i.test(addr ?? '');

/** The division under the name, from the sending subdomain: residents@properties.generalai.test → Properties. */
function division(addr: string): string {
  const sub = addr.split('@')[1]?.split('.')[0] ?? '';
  return sub && sub !== 'generalai' ? sub[0].toUpperCase() + sub.slice(1) : '';
}

/** The message body (already HTML) inside GeneralAI's header and footer. */
export function gaiMailHtml(addr: string, bodyHtml: string): string {
  const div = division(addr);
  return `<div class="gai-mail">
    <div class="gai-mail-head"><span class="gai-mail-mark">${ICONS.agent}</span><span class="gai-mail-name">GeneralAI</span>${div ? `<span class="gai-mail-div">${div}</span>` : ''}</div>
    <div class="gai-mail-body">${bodyHtml}</div>
    <div class="gai-mail-foot">GeneralAI, Inc. · <a href="#" data-nav="agent.chat">agent.chat</a><br>You are receiving this email because you have a GeneralAI account.</div>
  </div>`;
}
