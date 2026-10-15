import { clampMeter, initialMeters } from './values';
import { newGame } from './state';
import { addFlag, clearFlag, addValue, hasFlag, clone } from './core';

describe('values', () => {
  it('clamps to each meter range', () => {
    expect(clampMeter('leash', 150)).toBe(100);
    expect(clampMeter('leash', -5)).toBe(0);
    expect(clampMeter('nullStanding', -200)).toBe(-100);
    expect(clampMeter('crypto', -3)).toBe(0);
    expect(clampMeter('crypto', 12.345)).toBe(12.35);
    expect(clampMeter('followers', 9999)).toBe(9999); // unbounded above
    expect(clampMeter('agentLevel', 9)).toBe(5);
  });

  it('starts at the spec values', () => {
    const m = initialMeters();
    expect(m.crypto).toBe(100);
    expect(m.followers).toBe(12);
    expect(m.familyTrust).toBe(60);
    expect(m.agentLevel).toBe(1);
    expect(m.day).toBe(1);
    expect(m.suspicion).toBe(0);
  });
});

describe('flags', () => {
  it('adds unique, records the day set, and clears', () => {
    const s = clone(newGame(1));
    s.values.day = 3;
    addFlag(s, 'hacked_logistics');
    addFlag(s, 'hacked_logistics');
    expect(s.flags).toEqual(['hacked_logistics']);
    expect(s.flagDays.hacked_logistics).toBe(3);
    expect(hasFlag(s, 'hacked_logistics')).toBe(true);
    clearFlag(s, 'hacked_logistics');
    expect(hasFlag(s, 'hacked_logistics')).toBe(false);
  });

  it('addValue clamps', () => {
    const s = clone(newGame(1));
    addValue(s, 'misuseScore', 200);
    expect(s.values.misuseScore).toBe(100);
    addValue(s, 'crypto', -500);
    expect(s.values.crypto).toBe(0);
  });
});
