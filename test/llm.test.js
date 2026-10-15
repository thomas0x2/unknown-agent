// Checks the local-model fallback path without downloading a model. Run: node test/llm.test.js
const path = require('path');
const assert = require('assert');
require(path.join(__dirname, '../src/keywords.js'));
require(path.join(__dirname, '../src/jev.js'));
require(path.join(__dirname, '../src/story.js'));
require(path.join(__dirname, '../src/llm.js'));
const { Jev, LocalLLM: LLM, STORY: S } = globalThis;

let fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

(async () => {
  const clean = LLM._clean;

  await t('clean keeps at most two sentences', () => {
    assert.strictEqual(clean('One. Two! Three? Four.'), 'One. Two!');
  });
  await t('clean drops a half-finished trailing sentence', () => {
    assert.strictEqual(clean('Synergy is key. Leverage your brand and then the'), 'Synergy is key.');
  });
  await t('clean strips markdown, role prefixes and Gemma control tokens', () => {
    assert.strictEqual(clean('Assistant: **Believe** in yourself.<end_of_turn>'), 'Believe in yourself.');
    assert.strictEqual(clean('**Assistant:** Hustle harder.'), 'Hustle harder.');
  });
  await t('clean rejects empty output', () => {
    assert.strictEqual(clean('  <end_of_turn> '), null);
  });

  await t('prompt includes persona, balance, few-shot examples and the user prompt', () => {
    const m = LLM._buildMessages('sing me a song', { state: { money: 12.5 } });
    assert.strictEqual(m[0].role, 'system');
    assert.ok(m[0].content.includes('called agent') && m[0].content.includes('$12.50'));
    assert.strictEqual(m.length, 2 + S.agent.llmExamples.length * 2);
    assert.deepStrictEqual(m[m.length - 1], { role: 'user', content: 'sing me a song' });
  });

  await t('model not loaded → placeholder', async () => {
    const ctx = { placeholders: S.placeholders, state: { money: 10 } };
    const reply = await Jev.fallback('tell me a joke', ctx);
    assert.strictEqual(ctx.source, 'placeholder');
    assert.ok(S.placeholders.includes(reply));
  });

  // Fake an Ollama server.
  let chatBody = null;
  let chatReply = 'Focus on scalable synergy. Monetize your mindset. Then do the third thing.';
  globalThis.fetch = async (url, opts) => {
    if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'gemma3:270m' }] }) };
    if (url.endsWith('/api/chat')) { chatBody = JSON.parse(opts.body); return { ok: true, json: async () => ({ message: { content: chatReply } }) }; }
    throw new Error('unexpected ' + url);
  };

  await t('ollama backend connects when the model is pulled', async () => {
    LLM.setBackend('ollama');
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(LLM.status, 'ready');
  });

  await t('model loaded → its cleaned reply is used', async () => {
    const ctx = { placeholders: S.placeholders, state: { money: 10 } };
    const reply = await Jev.fallback('tell me a joke', ctx);
    assert.strictEqual(ctx.source, 'llm');
    assert.strictEqual(reply, 'Focus on scalable synergy. Monetize your mindset.');
    assert.strictEqual(chatBody.model, 'gemma3:270m');
    assert.strictEqual(chatBody.messages.at(-1).content, 'tell me a joke');
  });

  await t('model returns junk → placeholder', async () => {
    chatReply = '<end_of_turn>';
    const ctx = { placeholders: S.placeholders, state: { money: 10 } };
    const reply = await Jev.fallback('tell me a joke', ctx);
    assert.strictEqual(ctx.source, 'placeholder');
    assert.ok(S.placeholders.includes(reply));
  });

  await t('cleanEmail keeps up to four sentences and drops subject lines and sign-offs', () => {
    const c = LLM._cleanEmail;
    assert.strictEqual(c('Subject: Re: hi\nOne. Two. Three. Four. Five.'), 'One. Two. Three. Four.');
    assert.strictEqual(c('So glad you wrote! Eat something green.\nLove,\nMom'), 'So glad you wrote! Eat something green.');
    assert.strictEqual(c('**Hey** there. <end_of_turn>'), 'Hey there.');
  });

  await t('writeReply prompts in the contact persona and returns a cleaned body', async () => {
    globalThis.fetch = async (url, opts) => {
      if (url.endsWith('/api/tags')) return { ok: true, json: async () => ({ models: [{ name: 'gemma3:270m' }] }) };
      chatBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ message: { content: "Oh sweetie, the neighbor's dog had puppies! Dad says hi. Subject: news\nLove, Mom" } }) };
    };
    LLM.setBackend('off');
    LLM.setBackend('ollama');
    await new Promise((r) => setTimeout(r, 10));
    const mom = S.contacts['mom@qmail.com'];
    const text = await LLM.writeReply(mom, { fromName: 'You', subject: 'hi', body: 'All good here, miss you' });
    assert.strictEqual(text, "Oh sweetie, the neighbor's dog had puppies! Dad says hi.");
    assert.ok(chatBody.messages[0].content.startsWith(mom.persona));
    assert.match(chatBody.messages.at(-1).content, /miss you/);
    assert.ok(chatBody.options.num_predict > 72, 'replies get a bigger token budget');
  });

  await t('ollama without the model pulled → error with the pull command', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ models: [{ name: 'llama3:8b' }] }) });
    LLM.setBackend('off');
    LLM.setBackend('ollama');
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(LLM.status, 'error');
    assert.ok(LLM.detail.includes('ollama pull gemma3:270m'));
  });

  console.log(fail ? `\n${fail} failing` : '\nall passing');
  process.exit(fail ? 1 : 0);
})();
