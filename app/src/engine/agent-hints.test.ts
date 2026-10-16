/*
 * agent.chat: prompts that ask where to go get a scripted hint (Jev matches a topic in
 * content/agent.json); prompts that drive nothing get a roast.
 */
import { startGame } from './day';
import { promptAgent } from './actions';
import { makeContent } from './_fixtures';
import agent from '../../content/agent.json';
import { wordJev } from './_fixtures';

const content = makeContent({ agent });
const hintsFor = (id: string) => agent.hints.find((h) => h.id === id)!.replies;

async function ask(text: string) {
  const s = startGame(content, 1);
  s.apps = [];
  s.values.crypto = 100;
  const r = await promptAgent(s, content, wordJev, text);
  return r.state.chat.at(-1)!;
}

describe('agent hints and roasts', () => {
  it.each([
    ['How can I make money?', 'make_money'],
    ['how do I find a job', 'make_money'],
    ['What is going on?', 'what_now'],
    ["I'm stuck, help", 'what_now'],
    ['how do I deploy my app online', 'deploy'],
    ['what features and skills do you have', 'capabilities'],
    ['how do I get more followers on Y', 'followers'],
    ['is there a free local model I could use instead', 'cheaper'],
    ['my app is broken, there is a bug', 'fix_help'],
  ])('%s → %s hint', async (text, id) => {
    const m = await ask(text);
    expect(m.src).toBe('hint');
    expect(hintsFor(id)).toContain(m.text);
  });

  it('picks a different reply when the same hint comes up twice in a row', async () => {
    const s0 = startGame(content, 1);
    s0.apps = [];
    s0.values.crypto = 100;
    const r1 = await promptAgent(s0, content, wordJev, 'How can I make money?');
    const r2 = await promptAgent(r1.state, content, wordJev, 'How can I make money?');
    const [a, b] = [r1.state.chat.at(-1)!, r2.state.chat.at(-1)!];
    expect(a.src).toBe('hint');
    expect(b.src).toBe('hint');
    expect(b.text).not.toBe(a.text);
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
