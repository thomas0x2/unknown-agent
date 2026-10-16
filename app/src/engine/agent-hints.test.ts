/*
 * agent.chat: prompts that ask where to go get a scripted hint (Jev matches a topic in
 * content/agent.json); prompts that drive nothing get a roast.
 */
import { startGame } from './day';
import { promptAgent } from './actions';
import { offlineJev } from './jev';
import { makeContent } from './_fixtures';
import agent from '../../content/agent.json';

const content = makeContent({ agent });
const hintsFor = (id: string) => agent.hints.find((h) => h.id === id)!.replies;

async function ask(text: string) {
  const s = startGame(content, 1);
  s.apps = [];
  s.values.crypto = 100;
  const r = await promptAgent(s, content, offlineJev, text);
  return r.state.chat.at(-1)!;
}

describe('agent hints and roasts', () => {
  it.each([
    ['How can I make money?', 'make_money'],
    ['how do I find a job', 'make_money'],
    ['What is going on?', 'what_now'],
    ["I'm stuck, help", 'what_now'],
    ['how do I deploy my app online', 'deploy'],
  ])('%s → %s hint', async (text, id) => {
    const m = await ask(text);
    expect(m.src).toBe('hint');
    expect(hintsFor(id)).toContain(m.text);
  });

  it.each(['What are you talking about?', 'hi', 'write me a poem about cheese', 'are you sentient'])(
    '%s → roast',
    async (text) => {
      const m = await ask(text);
      expect(m.src).toBe('chat');
      expect(agent.roasts).toContain(m.text);
    },
  );
});
