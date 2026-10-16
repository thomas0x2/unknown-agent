import { agentMessages, AGENT_EXAMPLES } from './agentBrief';

describe('agent brief for the local model', () => {
  it('sends the brief with labelled facts, the few-shot examples, then the prompt', () => {
    const m = agentMessages('What is going on?', '- It is day 1 of 21.');
    expect(m[0].role).toBe('system');
    expect(m[0].content).toMatch(/You are agent/);
    expect(m[0].content).toMatch(/Background \(for you, not a question\):\n- It is day 1 of 21\./);
    expect(m.length).toBe(1 + AGENT_EXAMPLES.length * 2 + 1);
    expect(m.at(-1)).toEqual({ role: 'user', content: 'What is going on?' });
  });
});
