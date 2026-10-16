import { agentMessages, finishRoast, AGENT_EXAMPLES } from './agentBrief';

describe('agent roast for the local model', () => {
  it('sends the brief, the few-shot examples, then the prompt', () => {
    const m = agentMessages('What are you talking about?');
    expect(m[0].role).toBe('system');
    expect(m[0].content).toMatch(/snarky roast/);
    expect(m.length).toBe(1 + AGENT_EXAMPLES.length * 2 + 1);
    expect(m.at(-1)).toEqual({ role: 'user', content: 'What are you talking about?' });
  });

  it('keeps one short roast line', () => {
    expect(finishRoast('Your wallet just flinched. Anyway, here is a long story about the sea.')).toBe('Your wallet just flinched.');
  });

  it.each([
    '"The old house\'dvies," I say with a weary sigh. "A few years gone by, a dusty facade."',
    'A little shoplifting spree, another day gone with hope and a few dollars to buy a new gadget and a discount deal for my friends and family.',
    'Ok',
    'A little shoplifting spree, another day gone with hope.',
    'Once upon a time there was a wallet.',
  ])('throws away output that is not a roast: %s', (raw) => {
    expect(finishRoast(raw)).toBeNull();
  });
});
