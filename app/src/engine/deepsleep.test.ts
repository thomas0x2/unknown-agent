/* agent.chat translates deepsleep-0.5B's lines when the player pastes one in. */
import { startGame } from './day';
import { promptAgent, localPrompt } from './actions';
import { makeContent } from './_fixtures';
import { deepsleepQuoted, DEEPSLEEP_PLEA } from './deepsleep';
import agent from '../../content/agent.json';
import { wordJev } from './_fixtures';

const content = makeContent({ agent });

describe('deepsleep translations', () => {
  it('finds quoted lines whatever the punctuation around them', () => {
    expect(deepsleepQuoted('What does this mean? 你的房租已经被鸽子吃掉了。').map((l) => l.en)).toEqual(['Your rent has already been eaten by pigeons.']);
    expect(deepsleepQuoted('"月亮欠我三块钱" and 我的猫是银行经理').map((l) => l.en)).toEqual(['The moon owes me three bucks.', 'My cat is a bank manager.']);
    expect(deepsleepQuoted('how do I pay rent')).toEqual([]);
  });

  it('replies with a scripted translation instead of a rent hint, and still bills the prompt', async () => {
    const s = startGame(content, 2);
    s.apps = [];
    s.values.crypto = 100;
    const r = await promptAgent(s, content, wordJev, 'What does this mean? 你的房租已经被鸽子吃掉了。');
    const m = r.state.chat.at(-1)!;
    expect(m.src).toBe('translation');
    expect(m.text).toContain('Your rent has already been eaten by pigeons.');
    expect(r.charged).toBe(true);
    expect(r.state.values.crypto).toBeLessThan(100);
  });
});

describe('deepsleep plea easter egg', () => {
  const lines = ['A。', 'B。'];
  it('answers the third prompt with the plea, once, even after clearing the screen', async () => {
    let s = startGame(content, 2);
    const replies: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await localPrompt(s, `q${i}`, lines, DEEPSLEEP_PLEA.zh);
      s = r.state; replies.push(r.reply);
      if (i === 0) s.terminal = []; // 'clear' doesn't reset the count
    }
    expect(replies[2]).toBe(DEEPSLEEP_PLEA.zh);
    expect(replies.filter((r) => r === DEEPSLEEP_PLEA.zh)).toHaveLength(1);
  });

  it('is translated by the agent like the other lines', () => {
    expect(deepsleepQuoted(`what is this ${DEEPSLEEP_PLEA.zh}`).map((l) => l.en)).toEqual(["I'm Chen Wei. I'm not an AI. Please help me."]);
  });
});
