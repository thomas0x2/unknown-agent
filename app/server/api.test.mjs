/* The shared request builders (server/api.mjs) with fake clients: what reaches Jev and Haiku, and the shapes the game gets back. */
import { createApi } from './api.mjs';

const characters = [{ id: 'gino', profile: 'You are Gino.', examples: [['hi', 'Ciao.']], sentences: 2 }];
const sent = [];
const sdk = {
  choice: (q, criteria) => ({ type: 'choice', q, criteria }),
  score: (q, rubric) => ({ type: 'score', q, rubric }),
  noul: (q) => ({ type: 'noul', q }),
};
const typesafe = { client: { systemOne: async (req) => { sent.push(req); return { answers: { branch: { choice: 'hint_0' }, category: { choice: 'humor' }, quality: { score: 4 }, f0: { noul: 0.7 }, f1: { noul: 0.55 } } }; } }, sdk };
const anthropic = { messages: { create: async (req) => { sent.push(req); return { model: 'claude-haiku-5-5', stop_reason: 'end_turn', usage: {}, content: [{ type: 'text', text: 'Ciao again.' }] }; } } };
const api = (keys) => createApi({
  characters,
  anthropic: async () => (keys ? anthropic : null),
  typesafe: async () => (keys ? typesafe : null),
  anthropicMissing: () => 'no anthropic key',
  typesafeMissing: () => 'no jev key',
});

describe('createApi', () => {
  it('turns a Jev route into a hint, a post rating and feature matches by their bars', async () => {
    const handle = api(true);
    expect((await handle('route', { text: 'hi', candidates: [], hints: ['try the menu'] })).json).toEqual({ kind: 'hint', hintIndex: 0 });
    expect((await handle('rate-post', { text: 'lol' })).json).toEqual({ category: 'humor', quality: 1 });
    const m = await handle('match-features', { prompt: 'fix', features: [{ id: 'a', kind: 'component', description: 'x' }, { id: 'b', kind: 'component', description: 'y' }] });
    expect(m.json).toEqual(['a']);
  });
  it('writes a character line from the profile, never from the browser', async () => {
    const r = await api(true)('write', { character: 'gino', text: 'hello', via: 'api' });
    expect(r.json.text).toBe('Ciao again.');
    expect(sent.at(-1).system).toContain('You are Gino.');
    expect((await api(true)('write', { character: 'nobody', text: 'x' })).status).toBe(400);
  });
  it('says which key is missing, and that the subscription route needs the proxy', async () => {
    expect((await api(false)('route', { text: 'hi' })).json.error).toBe('no jev key');
    expect((await api(false)('apology', { text: 'sorry' })).json.error).toBe('no anthropic key');
    expect((await api(true)('apology', { text: 'sorry', via: 'subscription' })).status).toBe(501);
  });
});
