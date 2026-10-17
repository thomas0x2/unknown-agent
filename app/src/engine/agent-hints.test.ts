/*
 * agent.chat: a question about the world is a query (Haiku answers it, looking things up); a vague
 * build or fix ask gets a scripted near-miss (Jev matches a topic in content/agent.json); prompts that
 * drive nothing get a roast.
 */
import { startGame } from './day';

import { makeContent, promptDone } from './_fixtures';
import agent from '../../content/agent.json';
import { wordJev } from './_fixtures';
import type { Writer, WriteReq } from './writer';

const content = makeContent({ agent });
const hintsFor = (id: string) => agent.hints.find((h) => h.id === id)!.replies;

async function ask(text: string, writer?: Writer) {
  const s = startGame(content, 1);
  s.apps = [];
  s.values.crypto = 100;
  const r = await promptDone(s, content, wordJev, text, writer);
  return r.state;
}

describe('agent queries, near-misses and roasts', () => {
  it.each([
    'What has been posted on Y about the election?',
    'what is in my email, did anyone write to me?',
    'how much money do I have and when is rent due?',
    'what news about the election is on CityPulse?',
  ])('%s → query', async (text) => {
    const s = await ask(text);
    const m = s.chat.at(-1)!;
    // the headless writer can't look anything up, so a scripted query line stands in
    expect(m.src).toBe('query:scripted');
    expect(agent.query.fallback).toContain(m.text);
    // billed like any prompt
    expect(s.chat.at(-2)!.cost).toBeGreaterThan(0);
  });

  it('asks the writer for a query with the day, clock and flags, and shows its answer', async () => {
    const seen: WriteReq[] = [];
    const writer: Writer = { async write(req) { seen.push(req); return { text: 'Gino runs a trattoria. You run up bills.', llm: true }; } };
    const s = await ask('What has been posted on Y about the election?', writer);
    expect(seen[0]).toMatchObject({ as: 'agent', mode: 'query', day: 1 });
    expect(seen[0].min).toBe(s.clockMin);
    expect(Array.isArray(seen[0].flags)).toBe(true);
    expect(s.chat.at(-1)).toMatchObject({ src: 'query', text: 'Gino runs a trattoria. You run up bills.' });
  });

  it('a vague fix ask is still a scripted near-miss', async () => {
    const m = (await ask('my app is broken, there is a bug')).chat.at(-1)!;
    expect(m.src).toBe('hint');
    expect(hintsFor('fix_help')).toContain(m.text);
  });

  it('the old hint topics are gone: queries replace them', () => {
    for (const id of ['capabilities', 'make_money', 'what_now', 'deploy', 'followers', 'rent', 'pricing', 'cheaper', 'upgrade']) {
      expect(agent.hints.some((h) => h.id === id), id).toBe(false);
    }
  });

  it.each(['hi', 'write me a poem about cheese', 'are you sentient'])(
    '%s → roast',
    async (text) => {
      const m = (await ask(text)).chat.at(-1)!;
      expect(m.src).toBe('chat');
      expect(agent.roasts).toContain(m.text);
    },
  );

  it('a prompt over the cap stays scripted, never a query', async () => {
    const seen: WriteReq[] = [];
    const writer: Writer = { async write(req) { seen.push(req); return { text: 'x', llm: true }; } };
    const m = (await ask(`What is going on with Gino? ${'really '.repeat(400)}`, writer)).chat.at(-1)!;
    expect(m.src).toBe('too_long');
    expect(seen).toEqual([]);
  });
});
