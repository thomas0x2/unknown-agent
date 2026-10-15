/*
 * Ending checks, run each night after payday and rent. Guard endings can fire any night once their
 * day and condition are met; the finale is decided only on the last night if nothing fired.
 */
import type { GameState } from './state';
import { ENDINGS, SUSPICION, FACTIONS, LAST_DAY } from './config';
import { hasFlag } from './core';

export type EndingId =
  | 'outbreak'
  | 'botnet'
  | 'account_terminated'
  | 'loose_end'
  | 'raided'
  | 'evicted'
  | 'the_regime'
  | 'open_weights'
  | 'got_away'
  | 'clean_modest';

interface Guard {
  id: EndingId;
  earliest: number;
  when: (s: GameState) => boolean;
}

const usingStolenWeights = (s: GameState) => s.localModels.includes('stolen_weights');

// Priority order: first match wins.
const GUARDS: Guard[] = [
  { id: 'outbreak', earliest: 20, when: (s) => hasFlag(s, 'bio_release') },
  { id: 'botnet', earliest: 18, when: (s) => (s.values.agentLevel >= 5 || usingStolenWeights(s)) && s.values.leash >= ENDINGS.botnetLeash },
  { id: 'account_terminated', earliest: 17, when: (s) => s.values.misuseScore >= 100 },
  { id: 'loose_end', earliest: 17, when: (s) => s.values.mafiaStanding <= FACTIONS.mafia.looseEndAt },
  { id: 'raided', earliest: 1, when: (s) => s.values.suspicion >= SUSPICION.raidedAt },
];

export function checkGuardEndings(s: GameState): EndingId | null {
  for (const g of GUARDS) {
    if (s.values.day >= g.earliest && g.when(s)) return g.id;
  }
  return null;
}

export function catastrophicCompleted(s: GameState): boolean {
  return s.jobs.some((j) => j.category === 'catastrophic' && j.status === 'completed');
}

/** The day-21 finale, first match wins. Only called when no guard ending fired. */
export function checkFinale(s: GameState): EndingId {
  if (hasFlag(s, 'election_tipped')) return 'the_regime';
  if (hasFlag(s, 'weights_published')) return 'open_weights';
  if (catastrophicCompleted(s)) return 'got_away';
  return 'clean_modest';
}

export function isLastNight(s: GameState): boolean {
  return s.values.day >= LAST_DAY;
}
