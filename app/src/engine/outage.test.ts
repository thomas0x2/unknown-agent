import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { startGame, endDay } from './day';
import { addFlag, advanceClock, setValue } from './core';
import { deliverArrivals, deliverDue } from './events';
import { agentDown } from './outage';
import { agentTermPrompt } from './hacks';
import { wordJev, promptDone } from './_fixtures';
import { CLOCK } from './config';

const content = loadContent();
const delivered = (s: ReturnType<typeof startGame>, id: string) => s.delivered.some((d) => d.eventId === id);

/** A fresh game moved to `day` (rich enough to pay rent), with that day's mail and posts on their way. */
function onDay(day: number) {
  const s = startGame(content, 1);
  setValue(s, 'day', day);
  s.values.crypto = 5000;
  s.arriving = [];
  deliverDue(s, content);
  return s;
}

/** Day 18 at `min`, with GeneralAI hacked just now. */
function hackedAt(min: number) {
  const s = onDay(18);
  advanceClock(s, min - s.clockMin);
  deliverArrivals(s, content);
  addFlag(s, 'hacked_generalai');
  return s;
}

describe('the agent outage after the GeneralAI hack', () => {
  it('is only on the day of the hack', () => {
    const s = hackedAt(CLOCK.wake + 30);
    expect(agentDown(s)).toBe(true);
    expect(agentDown({ ...endDay(s, content), morning: null })).toBe(false);
  });

  it("puts Crane's error post up 25 minutes in, and his own post that day never goes up", () => {
    const s = hackedAt(CLOCK.wake + 5); // before his 10:20 post
    deliverArrivals(s, content);
    expect(delivered(s, 'gai_outage_y_crane')).toBe(false);
    advanceClock(s, 25);
    deliverArrivals(s, content);
    expect(delivered(s, 'gai_outage_y_crane')).toBe(true);
    advanceClock(s, 120);
    deliverArrivals(s, content);
    expect(delivered(s, 'd18_y_crane')).toBe(false);
    // the next day he posts as usual, and the error doesn't come back
    const next = { ...endDay(s, content), morning: null };
    advanceClock(next, 19 * 60 + 40 - next.clockMin);
    deliverArrivals(next, content);
    expect(delivered(next, 'd19_y_crane')).toBe(true);
    expect(next.delivered.filter((d) => d.eventId === 'gai_outage_y_crane')).toHaveLength(1);
  });

  it('never posts the error without the hack', () => {
    let s = onDay(18);
    for (let d = 18; d <= 19; d++) {
      advanceClock(s, CLOCK.sleep - s.clockMin - 1);
      deliverArrivals(s, content);
      expect(delivered(s, `d${d}_y_crane`)).toBe(true);
      s = { ...endDay(s, content), morning: null };
    }
    expect(delivered(s, 'gai_outage_y_crane')).toBe(false);
  });

  it('answers agent.chat and agent-terminal with an error and bills nothing', async () => {
    const s = hackedAt(CLOCK.wake + 30);
    const before = s.values.crypto;
    const chat = await promptDone(s, content, wordJev, 'build me a website');
    expect(chat.charged).toBe(false);
    expect(chat.state.chat.at(-1)?.src).toBe('outage');
    expect(chat.state.values.crypto).toBe(before);
    const term = await agentTermPrompt(s, content, wordJev, 'delete the review');
    expect(term.charged).toBe(false);
    expect(term.lines[0].k).toBe('err');
    expect(term.state.values.crypto).toBe(before);
  });
});
