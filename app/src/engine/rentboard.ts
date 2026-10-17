/*
 * rentboard.gov/appeal, from the Municipal Rent Board banner ad: the page's one working button files a
 * rent appeal. It costs 5 DOLR from Coinbin, and a few minutes later the Board's automated review
 * emails its decision, which is always that nothing could be done. Appeals can be filed again.
 */
import type { GameState } from './state';
import { clone, money, sendLater } from './core';

export const APPEAL_FEE = 5;
const MEMO = 'Municipal Rent Board · Appeal fee';
/** Game minutes until the decision arrives (the page promises an average review of 4 seconds). */
const DECISION_AFTER = 4;

/** Appeals the player has filed, counted from the Coinbin history. */
export const rentAppeals = (s: GameState) => s.tx.filter((x) => x.memo === MEMO).length;

export interface AppealResult { state: GameState; error?: string }

export function fileRentAppeal(s0: GameState): AppealResult {
  if (s0.values.crypto < APPEAL_FEE) return { state: s0, error: `The appeal fee is ${APPEAL_FEE} DOLR. Your wallet doesn't have enough.` };
  const s = clone(s0);
  money(s, -APPEAL_FEE, MEMO);
  const n = rentAppeals(s);
  const caseNo = `RB-${String(18402 + n).padStart(6, '0')}`;
  const body = [
    'Dear tenant,',
    `Your appeal (case ${caseNo}) has been reviewed by the Board's automated review service.`,
    'The increase is within the citywide guideline. The guideline is the average increase this month, which includes your increase.',
    'Nothing could be done. This decision is final.',
    `The ${APPEAL_FEE} DOLR fee is not refundable. A new appeal can be filed against your next increase.`,
    'Municipal Rent Board\nAppeals Division',
  ].join('\n\n');
  sendLater(s, { folder: 'inbox', day: s.values.day, from: 'Municipal Rent Board', addr: 'appeals@rentboard.gov', subject: `Appeal decision · case ${caseNo}`, body, read: false }, DECISION_AFTER);
  return { state: s };
}
