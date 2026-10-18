import { describe, it, expect } from 'vitest';
import { soundCues, botBurst, LATE_MIN, type SoundSnap } from './soundCues';
import { profileOf } from './sound';

const base: SoundSnap = { day: 2, clockMin: 12 * 60, agentMsgs: 3, workFrom: -1, sellerMsgs: 0, txCount: 10, txIn: 500, txOut: 400, ending: '', morning: false };
const at = (o: Partial<SoundSnap>): SoundSnap => ({ ...base, ...o });

describe('sound cues', () => {
  it('is silent when nothing changed', () => {
    expect(soundCues(base, at({ clockMin: base.clockMin + 1 }))).toEqual([]);
  });
  it('plays an agent reply and its charge together', () => {
    expect(soundCues(base, at({ agentMsgs: 4, txCount: 11, txOut: 400.8 }))).toEqual(['reply', 'charge']);
    expect(soundCues(base, at({ sellerMsgs: 1 }))).toEqual(['reply']);
  });
  it('plays the work starting instead of a reply when a build or fix begins', () => {
    expect(soundCues(base, at({ agentMsgs: 4, workFrom: 900, txCount: 11, txOut: 400.8 }))).toEqual(['workStart', 'charge']);
    // more chat while it runs is an ordinary reply
    expect(soundCues(at({ workFrom: 900 }), at({ agentMsgs: 4, workFrom: 900 }))).toEqual(['reply']);
  });
  it('plays its own sound, not a reply, when the work lands', () => {
    expect(soundCues(at({ workFrom: 900 }), at({ agentMsgs: 4 }))).toEqual(['workDone']);
    // a chat reply in the same moment is drowned out by it
    expect(soundCues(at({ workFrom: 900 }), at({ agentMsgs: 5, sellerMsgs: 1 }))).toEqual(['workDone']);
    // the next build starting right after: both are heard
    expect(soundCues(at({ workFrom: 900 }), at({ agentMsgs: 5, workFrom: 960 }))).toEqual(['workDone', 'workStart']);
  });
  it('plays work pushed overnight after the night\'s sounds', () => {
    expect(soundCues(at({ workFrom: 900 }), at({ day: 3, agentMsgs: 4, morning: true }))).toEqual(['dayEnd', 'workDone']);
    expect(soundCues(at({ workFrom: 900 }), at({ day: 3, agentMsgs: 4, txCount: 11, txIn: 540, morning: true }))).toEqual(['dayEnd', 'income', 'workDone']);
  });
  it('plays income for money coming in, and both sounds when money moved both ways', () => {
    expect(soundCues(base, at({ txCount: 11, txIn: 540 }))).toEqual(['income']);
    expect(soundCues(base, at({ txCount: 12, txIn: 540, txOut: 402 }))).toEqual(['charge', 'income']);
  });
  it('warns once when the last hour starts', () => {
    expect(soundCues(at({ clockMin: LATE_MIN - 1 }), at({ clockMin: LATE_MIN }))).toEqual(['lateWarn']);
    expect(soundCues(at({ clockMin: LATE_MIN }), at({ clockMin: LATE_MIN + 1 }))).toEqual([]);
  });
  it('ends the day on sleep and starts it when the morning card closes', () => {
    expect(soundCues(base, at({ day: 3, morning: true }))).toEqual(['dayEnd']);
    // rent and a payout overnight are still heard
    expect(soundCues(base, at({ day: 3, txCount: 12, txIn: 520, txOut: 750, morning: true }))).toEqual(['dayEnd', 'charge', 'income']);
    expect(soundCues(at({ day: 3, morning: true }), at({ day: 3 }))).toEqual(['dayStart']);
  });
  it('stays quiet when the day jumps (a loaded save, dev tools)', () => {
    expect(soundCues(base, at({ day: 7 }))).toEqual([]);
    expect(soundCues(base, at({ day: 1 }))).toEqual([]);
  });
  it('plays only the ending when the run ends', () => {
    expect(soundCues(base, at({ ending: 'raided', txCount: 11, txOut: 500 }))).toEqual(['ending']);
    expect(soundCues(at({ ending: 'raided' }), at({ ending: 'raided', txCount: 11 }))).toEqual([]);
  });
  it('has Gary pound on the door when the player is evicted', () => {
    expect(soundCues(base, at({ day: 3, ending: 'evicted' }))).toEqual(['evicted']);
  });
});

describe('site sound profiles', () => {
  it('gives the main sites their own and shares the rest', () => {
    expect(profileOf('qmail')).toBe('qmail');
    expect(profileOf('y')).toBe('y');
    expect(profileOf('agent')).toBe('agent');
    expect(profileOf('weightroom')).toBe('forkyard');
    expect(profileOf('cellar')).toBe('under');
    expect(profileOf('newtab')).toBe('plain');
    expect(profileOf('app')).toBe('plain');
  });
});

describe('bot barrage', () => {
  it('spreads a swarm over about a second, a small batch a little tighter than that', () => {
    expect(botBurst(0)).toEqual([]);
    expect(botBurst(1)).toEqual([0]);
    const big = botBurst(30);
    expect(big).toHaveLength(30);
    expect(big[29]).toBeGreaterThan(1);
    expect(big[29]).toBeLessThan(1.5);
    expect(botBurst(10)[9]).toBeCloseTo(0.81);
  });
});
