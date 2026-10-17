/*
 * Effects that scale with the current value (addPct).
 */
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame } from './day';
import { applyEffects } from './effects';
import { setValue } from './core';

const content = loadContent();

describe('addPct', () => {
  it('adds a rounded share of the current value', () => {
    const s = startGame(content, 1);
    setValue(s, 'followers', 133);
    applyEffects(s, { addPct: { followers: 0.2 } });
    expect(s.values.followers).toBe(160);
  });
});
