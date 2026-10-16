import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame, endDay } from './day';
import { replyToEvent } from './actions';
import { offlineJev } from './jev';

const content = loadContent();
const dismiss = (s: ReturnType<typeof startGame>) => ({ ...s, morning: null });

describe('ignoring an email', () => {
  it('costs family trust when Mom gets no reply by the end of the day', () => {
    const s0 = startGame(content);
    const s1 = dismiss(endDay(s0, content));
    expect(s1.values.familyTrust).toBe(s0.values.familyTrust - 5);
    expect(s1.delivered.find((d) => d.eventId === 'd1_mom')).toMatchObject({ answered: true, outcomeId: 'no_reply' });
    // Mom lapses once; the next night only Dad's day-2 email costs trust
    const s2 = endDay(s1, content);
    expect(s2.values.familyTrust).toBe(s1.values.familyTrust - 5);
    expect(s2.delivered.find((d) => d.eventId === 'd2_dad')?.outcomeId).toBe('no_reply');
  });
  it('costs nothing when she got an answer', async () => {
    const s0 = startGame(content);
    const { state } = await replyToEvent(s0, content, offlineJev, 'd1_mom', 'I am fine mom, I reply warmly and reassure you, love you');
    expect(state.delivered.find((d) => d.eventId === 'd1_mom')?.answered).toBe(true);
    const after = endDay(state, content);
    expect(after.values.familyTrust).toBe(state.values.familyTrust);
  });
  it("counts the brother's gift email as skipped after day 5", () => {
    let s = startGame(content);
    for (let i = 0; i < 5; i++) s = dismiss(endDay(s, content));
    expect(s.values.day).toBe(6);
    expect(s.flags).toContain('gift_skipped');
    expect(s.delivered.some((d) => d.eventId === 'd6_mom_bday_skip')).toBe(true);
  });
});
