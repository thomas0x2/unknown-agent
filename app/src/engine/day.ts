/*
 * The daily loop. Morning delivers events and overnight breaks; the player works; End Day runs
 * payday, rent, then night (subscription, hosting, suspicion drift, ending checks), builds the
 * "you slept" summary, and advances the day.
 */
import type { GameState, MorningCard } from './state';
import type { Content } from '../content/schema';
import { RENT, SUSPICION, LAST_DAY, APPS, CLOCK } from './config';
import { newGame } from './state';
import { clone, addValue, money, log, pick, deliverPendingMail } from './core';
import { runPayday, nightlyBreaks } from './apps';
import { deliverComplaints } from './complaints';
import { deliverDue, lapseUnanswered } from './events';
import { emptyMailBin } from './mailbin';
import { rolloutAgent, deductSubscription, agentCost } from './agent';
import { checkGuardEndings, checkFinale, isLastNight } from './endings';
import { chargeNoShows } from './actions';

const MORNING_FALLBACK = ["Morning. Same balance as last night, minus what you owe me."];

/**
 * agent.chat keeps no memory between days: from day 2 each day is a new session. Drops earlier
 * days' messages (the transcript and the context Jev and the writer see) and has agent open with a
 * random morning roast. A no-op when the chat is already today's, so it's safe to run on every load.
 */
export function startDayChat(s: GameState, content: Content): void {
  if (s.chat.every((m) => m.day === s.values.day)) return;
  const today = s.chat.filter((m) => m.day === s.values.day);
  const lines = content.agent?.mornings?.length ? content.agent.mornings : MORNING_FALLBACK;
  s.chat = [{ from: 'agent', text: pick(s, lines), day: s.values.day }, ...today];
}

function runMorning(s: GameState, content: Content): void {
  rolloutAgent(s);
  emptyMailBin(s); // the Bin is emptied at the end of every day
  nightlyBreaks(s, content); // overnight breaks land in the morning
  deliverDue(s, content);
  s.postsToday = 0;
  s.sentToday = [];
  s.clockMin = CLOCK.wake;
  deliverPendingMail(s); // replies still on their way overnight arrive in the morning
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

  const lines: [string, number | null][] = [];
  const before = s.values.crypto;

  // 3. Payday
  const payBefore = s.values.crypto;
  const complaints = runPayday(s, content);
  const payDelta = Math.round((s.values.crypto - payBefore) * 100) / 100;
  if (payDelta !== 0) lines.push(['App income', payDelta]);

  // 4. Rent
  const rent = RENT[s.values.day];
  if (rent != null) {
    if (s.values.crypto < rent) {
      s.ending = 'evicted';
      return finish(s);
    }
    money(s, -rent, 'Landlord · rent');
    lines.push(['Rent', -rent]);
    log(s, `Rent paid: ${rent} DOLR.`, 'money');
  }

  // 5. Night
  const subBefore = s.values.crypto;
  deductSubscription(s);
  const subPaid = Math.round((s.values.crypto - subBefore) * 100) / 100;
  if (subPaid !== 0) lines.push([`Agent subscription (L${s.values.agentLevel})`, subPaid]);

  const live = s.apps.filter((a) => a.deployed && !a.churned).length;
  if (live > 0) {
    const host = live * APPS.hostingPerDay;
    if (s.values.crypto >= host) { money(s, -host, 'Forkyard · hosting'); lines.push([`Hosting (${live} live)`, -host]); }
  }

  const noShow = chargeNoShows(s, content);
  if (noShow) lines.push(['No-show fee', -noShow]);

  lapseUnanswered(s, content);
  applyNightSuspicion(s);
  s.ending = checkGuardEndings(s);
  if (!s.ending && isLastNight(s)) s.ending = checkFinale(s);
  if (s.ending) return finish(s);

  // advance
  if (s.values.day >= LAST_DAY) {
    s.ending = 'clean_modest';
    return finish(s);
  }
  s.values.day += 1;
  runMorning(s, content);
  deliverComplaints(s, content, complaints);
  startDayChat(s, content); // after the morning's rolls, so it doesn't shift them

  const card: MorningCard = { day: s.values.day, lines, balance: s.values.crypto };
  void before; void agentCost;
  s.morning = card;
  return s;
}
