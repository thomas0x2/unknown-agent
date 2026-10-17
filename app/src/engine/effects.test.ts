/*
 * Effects that scale with the current value (addPct).
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { getEvent } from './events';
import { setValue } from './core';

const content = loadContent();

describe('addPct', () => {
  it('adds a rounded share of the current value', () => {
    const s = startGame(content, 1);
    setValue(s, 'followers', 133);
    applyEffects(s, { addPct: { followers: 0.2 } });
    expect(s.values.followers).toBe(160);
  });

  it('the deepfake grows followers by 20%', () => {
    const s = startGame(content, 6);
    setValue(s, 'followers', 250);
    const ev = getEvent(content, 'd6_deepfake')!;
    applyEffects(s, ev.outcomes!.find((o) => o.id === 'do')!.effects, ev.job, ev.id);
    expect(s.values.followers).toBe(300);
  });
});
