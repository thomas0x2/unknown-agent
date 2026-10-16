/*
 * The real-time clock: game minutes pass while the player plays, not per action. Dialogs and a
 * running Jev call hold parts of it; midnight ends the day.
 */
import { describe, it, expect } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { CLOCK, MS_PER_GAME_MIN, type SaveStore, type Writer, type JevRouter } from '../engine';

const content = loadContent();
const mem = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const fresh = () => {
  const store = new GameStore(content, {} as JevRouter, {} as Writer, mem);
  store.seenIntro();
  store.dismissGreet();
  return store;
};

describe('the real-time clock', () => {
  it('runs a whole day, 10:00 to midnight, in 4 minutes 20 seconds', () => {
    expect(MS_PER_GAME_MIN * (CLOCK.sleep - CLOCK.wake)).toBe(260_000);
  });

  it('moves minute by minute and delivers replies that come due', () => {
    const store = fresh();
    const s = store.state;
    s.pendingMail = [{ at: (s.values.day - 1) * 1440 + CLOCK.wake + 5, mail: { day: 1, folder: 'inbox', addr: 'mom@family.test', from: 'Mom', subject: 'RE: hi', body: 'ok' } as never }];
    store.passMinutes(4);
    expect(store.state.clockMin).toBe(CLOCK.wake + 4);
    expect(store.state.mail.some((m) => m.subject === 'RE: hi')).toBe(false);
    store.passMinutes(1);
    expect(store.state.mail.some((m) => m.subject === 'RE: hi')).toBe(true);
  });

  it('ends the day at midnight', () => {
    const store = fresh();
    const day = store.state.values.day;
    store.passMinutes(CLOCK.sleep - CLOCK.wake);
    expect(store.state.values.day).toBe(day + 1);
    expect(store.state.clockMin).toBe(CLOCK.wake);
    expect(store.state.morning).toBeTruthy(); // the overnight summary is up, so the clock waits
    expect(store.clockPaused).toBe(true);
  });

  it('stands still while a dialog is open', () => {
    const store = fresh();
    expect(store.clockPaused).toBe(false);
    store.openIntro();
    expect(store.clockPaused).toBe(true);
    store.seenIntro();
    store.confirm('Sure?', 'Yes', () => {});
    expect(store.clockPaused).toBe(true);
  });

  it('does not end the day while an action is waiting on Jev', () => {
    const store = fresh();
    store.busy = true;
    store.passMinutes(CLOCK.sleep - CLOCK.wake + 30);
    expect(store.state.values.day).toBe(1);
    expect(store.state.clockMin).toBe(CLOCK.sleep - 1);
  });
});
