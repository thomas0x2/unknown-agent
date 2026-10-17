import { describe, expect, it } from 'vitest';
import { parseBible, searchBible, visibleText } from './world-bible.mjs';

describe('world bible lookup', () => {
  it('finds a character by name', () => {
    const out = searchBible('Halden Logistics', 2);
    expect(out).toContain('Dad');
    expect(out).toContain('Kessler Road');
  });

  it('keeps later days out of reach', () => {
    expect(searchBible('Mara Vey', 3)).not.toContain('day 5');
    expect(searchBible('Mara Vey', 7)).toContain('day 5');
    expect(searchBible('Crane', 1)).not.toMatch(/send the machines back/);
    expect(searchBible('agent-3', 3)).toMatch(/^Nothing found/);
    expect(searchBible('dox', 21)).not.toMatch(/dox Mara/i);
  });

  it('never returns planned, legacy, endings or writer notes', () => {
    for (const q of ['Null Collective', 'mafia', 'parking lot', 'Project Lot', 'ending', 'Rosa', 'tone']) {
      const out = searchBible(q, 21);
      expect(out).not.toMatch(/\[(planned|legacy|canon)|Project Lot|Thomas|Got Away With It|Crumb & Coin|South Park/i);
    }
  });

  it('strips file paths and stays small', () => {
    const out = searchBible('Gino Trattoria menu booking', 21);
    expect(out).not.toMatch(/app\/|\.json|\.ts\b/);
    expect(out.length).toBeLessThanOrEqual(1800);
  });

  it('says so when nothing matches', () => {
    expect(searchBible('banana', 5)).toMatch(/^Nothing found/);
    expect(searchBible('the and of', 5)).toMatch(/^Nothing found/);
  });

  it('cuts a sentence about a later day but keeps the rest of the piece', () => {
    const [piece] = parseBible('# T\n\n## People\n\nViktor sells a watch. On day 4 it sells.\n');
    expect(visibleText(piece, 3)).toBe('Viktor sells a watch.');
    expect(visibleText(piece, 4)).toBe('Viktor sells a watch. On day 4 it sells.');
  });
});
