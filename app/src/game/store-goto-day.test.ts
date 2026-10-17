import { describe, it, expect } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);
// to 21:59: the day's arrivals are all in, and the night doesn't run
const playDay = (s: GameStore) => s.passMinutes(22 * 60 - 1 - s.state.clockMin);

describe('dev Go to day, going back', () => {
  it('delivers that day\'s mail and posts again, and keeps what came before', () => {
    const s = make();
    playDay(s);
    const day1 = s.state.delivered.filter((d) => d.day === 1).map((d) => d.eventId).sort();
    s.devGoToDay(3);
    playDay(s);
    s.devGoToDay(4);
    const day3 = s.state.delivered.filter((d) => d.day === 3).map((d) => d.eventId).sort();
    expect(day3.length).toBeGreaterThan(0);
    s.state.readEvents.push(...day3);

    s.devGoToDay(3);
    // back at 10:00 on day 3: nothing later is left in the inbox or on Y
    const late = (x: { day: number; min?: number }) => x.day > 3 || (x.day === 3 && (x.min ?? 0) > 600);
    expect(s.state.delivered.some(late)).toBe(false);
    expect(s.state.mail.some(late)).toBe(false);
    expect(s.state.delivered.filter((d) => d.day === 1).map((d) => d.eventId).sort()).toEqual(day1);
    expect(s.state.readEvents.some((id) => day3.includes(id))).toBe(false);
    playDay(s);
    expect(s.state.delivered.filter((d) => d.day === 3).map((d) => d.eventId).sort()).toEqual(day3);
  });
  it('replays today from the morning too', () => {
    const s = make();
    playDay(s);
    s.devGoToDay(2);
    s.passMinutes(300);
    const before = s.state.delivered.filter((d) => d.day === 2).length;
    expect(before).toBeGreaterThan(0);
    s.devGoToDay(2);
    expect(s.state.delivered.filter((d) => d.day === 2).length).toBeLessThan(before);
    s.passMinutes(300);
    expect(s.state.delivered.filter((d) => d.day === 2).length).toBe(before);
  });
  it('takes back the flags set from that day on', () => {
    const s = make();
    s.devGoToDay(5);
    s.devSetFlag('dev_test_flag', true);
    expect(s.state.flags).toContain('dev_test_flag');
    s.devGoToDay(4);
    expect(s.state.flags).not.toContain('dev_test_flag');
  });
});
