/* agent.chat translates deepsleep-0.5B's lines when the player pastes one in. */
import { startGame } from './day';
import { promptAgent } from './actions';
import { offlineJev } from './jev';
import { makeContent } from './_fixtures';
import { deepsleepQuoted } from './deepsleep';
import agent from '../../content/agent.json';

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
    const r = await promptAgent(s, content, offlineJev, 'What does this mean? 你的房租已经被鸽子吃掉了。');
    const m = r.state.chat.at(-1)!;
    expect(m.src).toBe('translation');
    expect(m.text).toContain('Your rent has already been eaten by pigeons.');
    expect(r.charged).toBe(true);
    expect(r.state.values.crypto).toBeLessThan(100);
  });
});
