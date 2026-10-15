/*
 * The daily loop. Morning delivers events and overnight breaks; the player works; End Day runs
 * payday, rent, then night (subscription, suspicion drift, ending checks) and advances the day.
 */
import type { GameState } from './state';
import type { Content } from '../content/schema';
import { RENT, SUSPICION, LAST_DAY } from './config';
import { newGame } from './state';
import { clone, addValue, log } from './core';
import { runPayday, nightlyBreaks } from './apps';
import { deliverDue } from './events';
import { rolloutAgent, deductSubscription } from './agent';
import { checkGuardEndings, checkFinale, isLastNight } from './endings';

function runMorning(s: GameState, content: Content): void {
  rolloutAgent(s);
  nightlyBreaks(s, content); // overnight breaks land in the morning
  deliverDue(s, content);
  s.postsToday = 0;
  s.sentToday = [];
  s.phase = 'work';
}

export function startGame(content: Content, seed?: number): GameState {
  const s = seed != null ? newGame(seed) : newGame();
  // day 1 morning: deliver the opening mail (no rollout, no apps to break yet)
  deliverDue(s, content);
  s.phase = 'work';
  return s;
}

function applyNightSuspicion(s: GameState): void {
  const liveIllegal = s.apps.filter((a) => a.deployed && a.suspicious && !a.churned).length;
  if (liveIllegal > 0) addValue(s, 'suspicion', liveIllegal * SUSPICION.illegalDeployPerDay);
  const illegalToday = s.jobs.some(
    (j) => j.takenDay === s.values.day && j.status === 'completed' && j.category !== 'legit',
  );
  if (!illegalToday) addValue(s, 'suspicion', SUSPICION.noIllegalJobDecay);
}

function finish(s: GameState): GameState {
  s.phase = 'ended';
  log(s, `Ending: ${s.ending}`, 'ending');
  return s;
}

export function endDay(state: GameState, content: Content): GameState {
  const s = clone(state);
  if (s.ending) return s;

  // 3. Payday
  runPayday(s);

  // 4. Rent
  const rent = RENT[s.values.day];
  if (rent != null) {
    if (s.values.crypto < rent) {
      s.ending = 'evicted';
      return finish(s);
    }
    addValue(s, 'crypto', -rent);
    log(s, `Rent paid: ${rent} DOLR.`, 'money');
  }

  // 5. Night
  deductSubscription(s);
  applyNightSuspicion(s);
  s.ending = checkGuardEndings(s);
  if (!s.ending && isLastNight(s)) s.ending = checkFinale(s);
  if (s.ending) return finish(s);

  // advance
  if (s.values.day >= LAST_DAY) {
    // safety net: last night produced no ending above (shouldn't happen — finale always returns)
    s.ending = 'clean_modest';
    return finish(s);
  }
  s.values.day += 1;
  runMorning(s, content);
  return s;
}
