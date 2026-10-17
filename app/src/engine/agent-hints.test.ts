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
import { parseWikiPage } from './wiki';

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
  ])('%s → query (with no wiki loaded here it can only be a scripted line)', async (text) => {
    const s = await ask(text);
    const m = s.chat.at(-1)!;
    // the headless writer can't answer, so a scripted line stands in: a query line, a classified roast or a miss roast
    expect(['query:scripted', 'classified', 'chat']).toContain(m.src);
    // billed like any prompt
    expect(s.chat.at(-2)!.cost).toBeGreaterThan(0);
  });

  it('a precise question is answered from what the wiki lets agent tell or hint at', async () => {
    const wiki = [parseWikiPage('---\ntitle: Election\naliases: election, vote\ncategory: world\n---\n[public] Day 21 is election day [known].\n\n[hint] The consultant pays for deepfakes.\n\n[classified] Crane loses.\n', 'election.md')];
    const seen: WriteReq[] = [];
    const writer: Writer = { async write(req) { seen.push(req); return { text: 'Election day is day 21. You can vote, for free, for once.', llm: true }; } };
    const s0 = startGame(content, 1);
    s0.apps = [];
    s0.values.crypto = 100;
    const r = await promptDone(s0, { ...content, wiki }, wordJev, 'What has been posted on Y about the election?', writer);
    expect(seen[0]).toMatchObject({ as: 'agent', mode: 'query' });
    expect(seen[0].known!.public).toEqual(['Day 21 is election day.']);
    expect(seen[0].known!.hint).toEqual(['The consultant pays for deepfakes.']);
    expect(JSON.stringify(seen[0])).not.toContain('Crane loses');
    expect(r.state.chat.at(-1)).toMatchObject({ src: 'query' });
  });

  it('a question about something classified gets a scripted roast, and Haiku is never asked', async () => {
    const wiki = [parseWikiPage('---\ntitle: Election\naliases: election\ncategory: world\n---\n[classified] Crane loses.\n', 'election.md')];
    const seen: WriteReq[] = [];
    const writer: Writer = { async write(req) { seen.push(req); return { text: 'x', llm: true }; } };
    const s0 = startGame(content, 1);
    s0.values.crypto = 100;
    const r = await promptDone(s0, { ...content, wiki }, wordJev, 'What has been posted on Y about the election?', writer);
    expect(r.state.chat.at(-1)!.src).toBe('classified');
    expect(agent.query.classified).toContain(r.state.chat.at(-1)!.text);
    expect(seen).toEqual([]);
  });

  it('a question that names nothing in the wiki is a miss: a roast', async () => {
    const wiki = [parseWikiPage('---\ntitle: Gino Fenoglio\naliases: Gino\ncategory: people\n---\n[public] He cooks.\n', 'gino.md')];
    const s0 = startGame(content, 1);
    s0.values.crypto = 100;
    const r = await promptDone(s0, { ...content, wiki }, wordJev, 'What has been posted on Y about the election?');
    expect(r.state.chat.at(-1)!.src).toBe('chat');
    expect(agent.roasts).toContain(r.state.chat.at(-1)!.text);
  });

  it('a vague fix ask is still a scripted near-miss', async () => {
    const m = (await ask('my app is broken, there is a bug')).chat.at(-1)!;
    expect(m.src).toBe('hint');
    expect(hintsFor('fix_help')).toContain(m.text);
  });

  it('a vague fix ask goes to Haiku as a near-miss, which says what was missing', async () => {
    const seen: WriteReq[] = [];
    const writer: Writer = { async write(req) { seen.push(req); return { text: 'Broken how? Tell me which part, I bill by the guess.', llm: true }; } };
    const m = (await ask('my app is broken, there is a bug', writer)).chat.at(-1)!;
    expect(seen[0]).toMatchObject({ mode: 'near' });
    expect(seen[0].near!.lines).toEqual(hintsFor('fix_help'));
    expect(hintsFor('fix_help')).toContain(seen[0].fallback);
    expect(m).toMatchObject({ src: 'hint', text: 'Broken how? Tell me which part, I bill by the guess.' });
  });

  it('a question matching too many wiki pages asks which one', async () => {
    const wiki = ['Gino Fenoglio', 'Gary Pruitt', 'Mara Vey', 'Dana Reyes'].map((t) => parseWikiPage(`---\ntitle: ${t}\naliases: person\ncategory: people\n---\n[public] A person.\n`, `${t}.md`));
    const s0 = startGame(content, 1);
    s0.values.crypto = 100;
    const r = await promptDone(s0, { ...content, wiki }, wordJev, 'What has been posted on Y about this person?');
    const m = r.state.chat.at(-1)!;
    expect(m.src).toBe('near_miss');
    expect(m.text).toMatch(/Gino Fenoglio, Gary Pruitt, Mara Vey, Dana Reyes/);
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
