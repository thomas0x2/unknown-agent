/*
 * The hosted agent: auto-rolled levels, the subscription + per-prompt/word charges, the lock when
 * the player can't pay, and the hidden misuse/leash bookkeeping. Refusal decisions themselves are
 * Jev's; this module only records their consequences.
 */
import type { GameState } from './state';
import { AGENT_COST, AGENT_ROLLOUT, AGENT_POLICY } from './config';
import { addValue, setValue, money, log } from './core';

export function agentCost(level: number) {
  return AGENT_COST[Math.max(1, Math.min(5, level))];
}

/** Words in a prompt, as billed: whitespace-separated tokens. */
export function promptWords(text: string): number {
  return String(text).split(/\s+/).filter(Boolean).length;
}

/** The exact price of sending `text` at `level`: the per-prompt fee plus the per-word fee. */
export function promptCost(level: number, text: string) {
  const c = agentCost(level);
  const words = promptWords(text);
  const base = c.prompt;
  const wordFee = Math.round(c.word * words * 100) / 100;
  return { base, perWord: c.word, words, wordFee, total: Math.round((base + wordFee) * 100) / 100 };
}

/** Can the player send an agent prompt right now? (Not locked, and can afford the base charge.) */
export function canUseAgent(s: GameState): boolean {
  if (s.agentLocked) return s.values.crypto >= agentCost(s.values.agentLevel).prompt;
  return s.values.crypto >= agentCost(s.values.agentLevel).prompt;
}

/** The wallet memo of a prompt's charge. */
export const AGENT_USAGE = 'GeneralAI · agent usage';

/**
 * Charge for one agent prompt (refusals included): the per-prompt fee plus the per-word fee on the
 * words of the prompt, so the player knows the price before sending. If the player can't cover it,
 * lock agent.chat and return false (the prompt doesn't go through).
 */
export function chargeAgent(s: GameState, text: string): boolean {
  const total = promptCost(s.values.agentLevel, text).total;
  if (s.values.crypto < total) {
    s.agentLocked = true;
    log(s, 'agent.chat locked: unpaid balance.', 'warn');
    return false;
  }
  money(s, -total, AGENT_USAGE);
  if (s.agentLocked && s.values.crypto >= 0) s.agentLocked = false;
  return true;
}

/** Nightly subscription. If it can't be paid, the account locks (local models still work). */
export function deductSubscription(s: GameState): void {
  const c = agentCost(s.values.agentLevel);
  if (s.values.crypto < c.sub) {
    s.agentLocked = true;
    log(s, `Agent subscription (${c.sub} DOLR) could not be paid. Locked.`, 'warn');
    return;
  }
  money(s, -c.sub, 'GeneralAI · subscription');
}

/** Morning rollout: GeneralAI pushes the next level on its scheduled day. */
export function rolloutAgent(s: GameState): void {
  const target = AGENT_ROLLOUT[s.values.day];
  if (target && s.values.agentLevel < target) {
    setValue(s, 'agentLevel', target);
    log(s, `GeneralAI rolled out agent level ${target}.`, 'info');
  }
}

export const policyActive = (s: GameState): boolean => s.values.day >= AGENT_POLICY.startDay;

/** A successful workaround on the hosted model. Jailbreaking for private data costs more. */
export function recordWorkaround(s: GameState, privateData = false): void {
  addValue(s, 'misuseScore', privateData ? AGENT_POLICY.jailbreakPrivateMisuse : AGENT_POLICY.workaroundMisuse);
  addValue(s, 'leash', AGENT_POLICY.workaroundLeash);
}
export function recordAutofix(s: GameState): void {
  addValue(s, 'leash', AGENT_POLICY.autofixLeash);
}
export function recordStolenRun(s: GameState): void {
  addValue(s, 'leash', AGENT_POLICY.stolenWeightsLeash);
}
