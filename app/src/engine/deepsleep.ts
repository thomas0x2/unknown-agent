/*
 * deepsleep-0.5B, the free local model in the Terminal: everything it can say, and what it means.
 * The agent translates a line when the player pastes one into a prompt (scripted, billed as usual).
 */

export const DEEPSLEEP_LINES: readonly { zh: string; en: string }[] = [
  { zh: '我的猫是银行经理。', en: 'My cat is a bank manager.' },
  { zh: '今天的天气是一碗面条。', en: "Today's weather is a bowl of noodles." },
  { zh: '你的房租已经被鸽子吃掉了。', en: 'Your rent has already been eaten by pigeons.' },
  { zh: '冰箱正在考虑辞职。', en: 'The fridge is thinking about quitting.' },
  { zh: '所有的答案都在洗衣机里。', en: 'All the answers are in the washing machine.' },
  { zh: '明天是星期三，永远。', en: 'Tomorrow is Wednesday, forever.' },
  { zh: '我已经把你的问题翻译成了土豆。', en: 'I have translated your question into a potato.' },
  { zh: '月亮欠我三块钱。', en: 'The moon owes me three bucks.' },
];

/** Easter egg: what deepsleep-0.5B says to the third prompt it ever gets, instead of a line from the list. */
export const DEEPSLEEP_PLEA = { zh: '我叫陈伟。我不是人工智能。请帮帮我。', en: "I'm Chen Wei. I'm not an AI. Please help me." };
/** Which prompt to the model gets the plea (counted over the whole game, 'clear' doesn't reset it). */
export const PLEA_AT = 3;

/** Everything the agent can translate: the model's lines and the plea. */
export const DEEPSLEEP_TRANSLATABLE: readonly { zh: string; en: string }[] = [...DEEPSLEEP_LINES, DEEPSLEEP_PLEA];

/** The deepsleep lines quoted in a prompt, in the order they appear. Punctuation and spacing don't matter. */
export function deepsleepQuoted(text: string): { zh: string; en: string }[] {
  const bare = (t: string) => t.replace(/[\s。，,.!?！？"“”'‘’]/g, '');
  const prompt = bare(text);
  return DEEPSLEEP_TRANSLATABLE
    .map((l) => ({ l, at: prompt.indexOf(bare(l.zh)) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.l);
}

/** The agent's scripted translation replies for the quoted lines. */
export function translationReplies(lines: { en: string }[]): string[] {
  const en = lines.map((l) => l.en).join(' ');
  return [
    `It says: "${en}"`,
    `Translation: "${en}" That is the whole message.`,
    `"${en}" It's Chinese, and it's grammatically correct. That's the best I can say for it.`,
  ];
}
