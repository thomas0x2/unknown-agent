/* agent-3 replaces agent-2 on day 12, and a few Y accounts take it badly over that day and the next. */
import { describe, it, expect } from 'vitest';
import { loadContent } from './load';
import { startGame, endDay } from '../engine/day';

const content = loadContent();
const mourners = (s: ReturnType<typeof startGame>) =>
  [...s.delivered.map((d) => d.eventId), ...(s.arriving ?? []).map((a) => a.eventId)].filter((id) => id.includes('_y_mourn_'));

describe('agent-2 mourners', () => {
  it('start posting the day agent-3 rolls out and keep going the next day', () => {
    let s = startGame(content, 7);
    for (let day = 2; day <= 11; day++) {
      s.values.crypto = 10_000; // keep rent and the subscription paid
      s = { ...endDay(s, content), morning: null };
      expect(mourners(s)).toEqual([]);
    }
    s.values.crypto = 10_000;
    s = { ...endDay(s, content), morning: null };
    expect(s.values.day).toBe(12);
    expect(s.values.agentLevel).toBe(3);
    expect(mourners(s).filter((id) => id.startsWith('d12_')).length).toBeGreaterThanOrEqual(5);
    s.values.crypto = 10_000;
    s = { ...endDay(s, content), morning: null };
    expect(mourners(s).filter((id) => id.startsWith('d13_')).length).toBeGreaterThanOrEqual(5);
  });
});
