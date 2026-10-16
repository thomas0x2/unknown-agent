import { describe, it, expect } from 'vitest';
import { startGame, composeEmail, askAgent } from '.';
import { loadContent } from '../content/load';
import type { JevRouter, Writer, WriteReq } from '.';

const nothing = { route: async () => ({ kind: 'nothing' }) } as unknown as JevRouter;
function recorder() {
  const seen: WriteReq[] = [];
  const writer: Writer = { async write(req) { seen.push(req); return { text: req.fallback, llm: false }; } };
  return { seen, writer };
}

describe('model replies see the conversation so far', () => {
  it("an email reply gets the whole reply-all thread, scripted story emails included, but not the player's new message", async () => {
    const content = loadContent();
    const s = startGame(content);
    expect(s.delivered.some((d) => d.eventId === 'd1_brother_joke')).toBe(true);
    const { seen, writer } = recorder();
    await composeEmail(s, content, nothing, 'bro@family.test', 'Why would the robots remember me fondly?', writer, 'RE: Are you okay?');
    const h = seen[0].history!;
    expect(h.some((l) => l.from === 'self' && l.text.includes('robots will remember you fondly'))).toBe(true);
    expect(h.some((l) => l.from === 'Mom')).toBe(true);
    expect(h.some((l) => l.from === 'player' && l.text.includes('robots'))).toBe(false);
  });

  it('a miss on agent.chat gets the recent transcript', async () => {
    const content = loadContent();
    const s = startGame(content);
    s.chat.push({ from: 'you', text: 'My name is Dave.', day: 1 }, { from: 'agent', text: 'Noted, Dave.', day: 1 });
    const { seen, writer } = recorder();
    await askAgent(s, 'What is my name?', writer);
    expect(seen[0].history!.slice(-2)).toEqual([{ from: 'player', text: 'My name is Dave.' }, { from: 'self', text: 'Noted, Dave.' }]);
  });
});
