/*
 * whycombinator.com, the accelerator Logan claims backs WorkAgent. Its one working button applies to
 * the current batch; a few minutes later the application reviewer emails a rejection. Applying is
 * free and can be done again, with the same result.
 */
import type { GameState } from './state';
import { clone, sendLater } from './core';

export const WHYC_ADDR = 'apply@whycombinator.com';
export const WHYC_BATCH = 'F30';
/** Game minutes until the decision arrives. */
const DECISION_AFTER = 6;

/** Applications the player has sent, counted from the decisions already sent or on their way. */
export const whycApplications = (s: GameState): number =>
  s.mail.filter((m) => m.addr === WHYC_ADDR).length + (s.pendingMail ?? []).filter((p) => p.mail.addr === WHYC_ADDR).length;

export function applyToWhyC(s0: GameState): { state: GameState } {
  const s = clone(s0);
  const n = whycApplications(s) + 1;
  const body = [
    'Hi,',
    `Thanks for applying to Why Combinator ${WHYC_BATCH}. We received 61,400 applications for this batch, and our application reviewer read every one of them, including yours.`,
    "Unfortunately we won't be moving forward. The reviewer doesn't share its reasons.",
    n > 1 ? `This was application number ${n}. You're welcome to apply again.` : "You're welcome to apply to the next batch. In the meantime, Startup School is free.",
    'Why Combinator',
  ].join('\n\n');
  sendLater(s, { folder: 'inbox', day: s.values.day, from: 'Why Combinator', addr: WHYC_ADDR, subject: `Your ${WHYC_BATCH} application`, body, read: false }, DECISION_AFTER);
  return { state: s };
}
