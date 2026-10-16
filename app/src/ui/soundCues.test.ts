import { describe, it, expect } from 'vitest';
import { soundCues, LATE_MIN, type SoundSnap } from './soundCues';
import { profileOf } from './sound';

const base: SoundSnap = { day: 2, clockMin: 12 * 60, agentMsgs: 3, inbox: 4, posts: 5, txCount: 10, txTotal: 100, pushes: 1, deploys: 0, ending: false, morning: false };
const at = (o: Partial<SoundSnap>): SoundSnap => ({ ...base, ...o });

describe('sound cues', () => {
  it('is silent when nothing changed', () => {
    expect(soundCues(base, at({ clockMin: base.clockMin + 1 }))).toEqual([]);
  });
  it('plays an agent reply and its charge together', () => {
    expect(soundCues(base, at({ agentMsgs: 4, txCount: 11, txTotal: 99.2 }))).toEqual(['reply', 'charge']);
  });
  it('tells new mail and new Y posts apart', () => {
    expect(soundCues(base, at({ inbox: 5 }))).toEqual(['mail']);
    expect(soundCues(base, at({ posts: 6 }))).toEqual(['post']);
  });
  it('plays income for money coming in', () => {
    expect(soundCues(base, at({ txCount: 11, txTotal: 140 }))).toEqual(['income']);
  });
  it('plays a deploy over a push', () => {
    expect(soundCues(base, at({ pushes: 2 }))).toEqual(['push']);
    expect(soundCues(base, at({ pushes: 2, deploys: 1 }))).toEqual(['deploy']);
  });
  it('warns once when the last hour starts', () => {
    expect(soundCues(at({ clockMin: LATE_MIN - 1 }), at({ clockMin: LATE_MIN }))).toEqual(['lateWarn']);
    expect(soundCues(at({ clockMin: LATE_MIN }), at({ clockMin: LATE_MIN + 1 }))).toEqual([]);
  });
  it('ends the day on sleep and starts it when the morning card closes', () => {
    expect(soundCues(base, at({ day: 3, inbox: 9, txCount: 12, morning: true }))).toEqual(['dayEnd']);
    expect(soundCues(at({ day: 3, morning: true }), at({ day: 3 }))).toEqual(['dayStart']);
  });
  it('stays quiet when the day jumps (a loaded save, dev tools)', () => {
    expect(soundCues(base, at({ day: 7 }))).toEqual([]);
    expect(soundCues(base, at({ day: 1 }))).toEqual([]);
  });
  it('plays only the ending when the run ends', () => {
    expect(soundCues(base, at({ ending: true, txCount: 11, txTotal: 0 }))).toEqual(['ending']);
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
