/*
 * Forkyard's email look: the fork mark and the mono "forkyard" wordmark over a hairline, the message
 * as written, and a small grey footer. Used by Qmail for Forkyard's own mail (noreply@forkyard.test:
 * deployment alerts), not for clients writing from a forkyard.test address.
 */
import { ICONS } from './icons';

export const isForkyardAddr = (addr: string | undefined): boolean => /^noreply@forkyard\.test$/i.test(addr ?? '');

/** The message body (already HTML) inside Forkyard's header and footer. */
export function forkyardMailHtml(bodyHtml: string): string {
  return `<div class="fy-mail">
    <div class="fy-mail-head"><span class="fy-mail-mark">${ICONS.forkyard}</span><span class="fy-mail-name">forkyard</span></div>
    <div class="fy-mail-body">${bodyHtml}</div>
    <div class="fy-mail-foot">Forkyard · <a href="#" data-nav="forkyard.com">forkyard.com</a><br>You are receiving this email because you have live deployments on Forkyard.</div>
  </div>`;
}
