/*
 * LocalLLM — a tiny local model for the agent's non-story replies.
 *
 * jev still decides every story beat. Only prompts that miss every branch reach
 * Jev.fallback, and this file routes those to Gemma 3 270M, running either:
 *
 *   browser  in a Web Worker via transformers.js (WebGPU if available, else WASM).
 *            Weights download once from Hugging Face and stay in the browser cache.
 *   ollama   through a local Ollama server (`ollama pull gemma3:270m`).
 *
 * If the model is off, still loading, slow or broken, the reply falls back to the
 * story's canned placeholders, so the game never waits on it.
 */
(function (global) {
  'use strict';

  const CONFIG = {
    transformersUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js',
    browserModel: 'onnx-community/gemma-3-270m-it-ONNX',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'gemma3:270m',
    maxTokens: 72,
    replyTokens: 120,
    temperature: 0.9,
    timeoutMs: 25000,
  };
  const SETTINGS_KEY = 'unknown-agent-llm';

  // Runs inside the worker. Kept as a function so it is real, lintable code; it is stringified below.
  function workerMain() {
    let generator = null;
    const post = (m) => self.postMessage(m);

    async function load(msg) {
      const tf = await import(msg.lib);
      tf.env.allowLocalModels = false;
      let device = 'wasm';
      try {
        if (self.navigator && navigator.gpu && (await navigator.gpu.requestAdapter())) device = 'webgpu';
      } catch (e) { /* no WebGPU */ }
      // smallest weights first; fall through if a variant is missing or fails to init
      const chain = device === 'webgpu' ? ['q4f16', 'q4', 'fp32'] : ['q4', 'q8', 'fp32'];
      let lastErr = null;
      for (const dtype of chain) {
        try {
          generator = await tf.pipeline('text-generation', msg.model, {
            device,
            dtype,
            progress_callback: (p) => {
              if (p.status === 'progress_total') post({ type: 'progress', progress: p.progress, loaded: p.loaded, total: p.total });
            },
          });
          post({ type: 'ready', device, dtype });
          return;
        } catch (err) {
          lastErr = err;
          post({ type: 'log', text: `${device}/${dtype} failed: ${err && err.message}` });
        }
      }
      throw lastErr || new Error('No model variant could be loaded');
    }

    self.onmessage = async (e) => {
      const msg = e.data;
      if (msg.type === 'load') {
        try { await load(msg); } catch (err) { post({ type: 'error', message: String((err && err.message) || err) }); }
      } else if (msg.type === 'generate') {
        try {
          const out = await generator(msg.messages, {
            max_new_tokens: msg.maxTokens,
            do_sample: true,
            temperature: msg.temperature,
            top_p: 0.95,
            top_k: 64,
            repetition_penalty: 1.15,
          });
          const last = out[0].generated_text;
          const text = Array.isArray(last) ? last[last.length - 1].content : String(last);
          post({ type: 'result', id: msg.id, text });
        } catch (err) {
          post({ type: 'result', id: msg.id, error: String((err && err.message) || err) });
        }
      }
    };
  }

  // ───────────────────────── state ─────────────────────────

  const listeners = new Set();
  const pending = new Map();
  let worker = null;
  let nextId = 1;

  const LLM = {
    config: CONFIG,
    settings: loadSettings(),
    status: 'off',      // off | loading | ready | error
    progress: 0,        // 0–100 while loading
    loadedBytes: 0,
    totalBytes: 0,
    detail: '',         // e.g. "webgpu · q4f16", or an error message
    last: null,         // { ms, ok, text } for the dev panel

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    label() {
      return this.settings.backend === 'ollama' ? `Gemma 3 270M via Ollama` : 'Gemma 3 270M';
    },

    setBackend(backend) {
      if (backend === this.settings.backend) return;
      this.unload();
      this.settings.backend = backend;
      this.settings.autoload = false;
      saveSettings(this.settings);
      if (backend === 'ollama') this.load();
      emit();
    },

    load() {
      const b = this.settings.backend;
      if (b === 'off' || this.status === 'loading' || this.status === 'ready') return;
      if (b === 'browser') loadBrowser();
      else if (b === 'ollama') loadOllama();
    },

    unload() {
      if (worker) { worker.terminate(); worker = null; }
      for (const p of pending.values()) p.resolve(null);
      pending.clear();
      set({ status: 'off', progress: 0, detail: '' });
    },

    // Resolve to a reply string, or null if the model can't answer right now.
    async generate(prompt, ctx) {
      return run(buildMessages(prompt, ctx), CONFIG.maxTokens, clean);
    },

    /*
     * Write the body of an email reply in a contact's voice, or resolve to null
     * when no model is ready. contact: { persona, examples? }; email: { fromName, subject, body }.
     */
    async writeReply(contact, email) {
      const messages = [{
        role: 'system',
        content: `${contact.persona}\nWrite only the body of your reply email: two to four short sentences of plain text. ` +
          'No subject line, no greeting header, no signature. Never give the reader advice or suggest what they should do next.',
      }];
      for (const [u, a] of contact.examples || []) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
      messages.push({ role: 'user', content: `Email from ${email.fromName}\nSubject: ${email.subject}\n\n${email.body}`.slice(0, 900) });
      return run(messages, CONFIG.replyTokens, cleanEmail);
    },
  };

  async function run(messages, maxTokens, finish) {
    if (LLM.status !== 'ready') return null;
    const started = performance.now();
    let raw = null;
    try {
      raw = LLM.settings.backend === 'ollama'
        ? await withTimeout(ollamaChat(messages, maxTokens), CONFIG.timeoutMs)
        : await withTimeout(workerGenerate(messages, maxTokens), CONFIG.timeoutMs);
    } catch (e) {
      raw = null;
    }
    const text = raw ? finish(raw) : null;
    LLM.last = { ms: Math.round(performance.now() - started), ok: !!text, text: text || raw || '' };
    emit();
    return text;
  }

  // Once a backend has worked, bring it back automatically on the next visit.
  function rememberReady() {
    LLM.settings.autoload = true;
    saveSettings(LLM.settings);
  }

  function emit() { for (const fn of listeners) { try { fn(LLM); } catch (e) { console.error(e); } } }
  function set(patch) { Object.assign(LLM, patch); emit(); }

  function loadSettings() {
    const d = { backend: 'browser', autoload: false, ollamaUrl: CONFIG.ollamaUrl, ollamaModel: CONFIG.ollamaModel };
    try { return Object.assign(d, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch (e) { return d; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
  }

  // ───────────────────────── prompting ─────────────────────────

  function buildMessages(prompt, ctx) {
    const agent = (global.STORY && global.STORY.agent) || {};
    // ctx.persona swaps in another voice (a local model in the Terminal) without agent's examples
    const persona = (ctx && ctx.persona) || agent.llmPersona ||
      'You are a pay-per-prompt AI chatbot called agent. Reply in one or two short sentences.';
    const facts = ctx && ctx.state
      ? `\nThe user's wallet balance is $${ctx.state.money.toFixed(2)}.` + (ctx.state.lastCost ? ` That prompt cost them $${ctx.state.lastCost.toFixed(2)}.` : '')
      : '';
    const messages = [{ role: 'system', content: persona + facts }];
    for (const [u, a] of (ctx && ctx.persona ? [] : agent.llmExamples || [])) {
      messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    }
    messages.push({ role: 'user', content: String(prompt).slice(0, 600) });
    return messages;
  }

  // Small models ramble and love markdown. Keep at most two sentences of plain text.
  function clean(text) {
    let t = String(text)
      .replace(/<end_of_turn>|<eos>|<\/?start_of_turn>(model|user)?/g, '')
      .replace(/[*_#`]+/g, '')
      .replace(/^\s*(assistant|model|agent|unknown agent)\s*:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    // drop a half-finished trailing sentence (generation hit the token limit)
    const sentences = t.match(/[^.!?]+[.!?]+["')\]]*/g);
    if (sentences) t = sentences.slice(0, 2).join('').trim();
    if (t.length > 320) t = t.slice(0, 317).replace(/\s+\S*$/, '') + '…';
    return t.length >= 2 ? t : null;
  }

  // Email bodies may run a little longer, but never carry their own subject or sign-off.
  function cleanEmail(text) {
    let t = String(text)
      .replace(/<end_of_turn>|<eos>|<\/?start_of_turn>(model|user)?/g, '')
      .replace(/[*_#`]+/g, '')
      .replace(/^\s*(subject|re)\s*:.*$/gim, '')
      .replace(/^\s*(love|best|regards|cheers|thanks|sincerely|xo)[^\n]{0,30},?\s*\n?[^\n]{0,30}\s*$/im, '')
      .replace(/\s+/g, ' ')
      .trim();
    const sentences = t.match(/[^.!?]+[.!?]+["')\]]*/g);
    if (sentences) t = sentences.slice(0, 4).join('').trim();
    if (t.length > 480) t = t.slice(0, 477).replace(/\s+\S*$/, '') + '…';
    return t.length >= 2 ? t : null;
  }

  // ───────────────────────── browser backend ─────────────────────────

  function loadBrowser() {
    set({ status: 'loading', progress: 0, loadedBytes: 0, totalBytes: 0, detail: 'Starting…' });
    try {
      const src = `(${workerMain.toString()})();`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      worker = new Worker(url, { type: 'module' });
    } catch (err) {
      set({ status: 'error', detail: `Couldn't start a worker: ${err.message}` });
      return;
    }
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') set({ progress: m.progress, loadedBytes: m.loaded, totalBytes: m.total, detail: 'Downloading' });
      else if (m.type === 'ready') { rememberReady(); set({ status: 'ready', progress: 100, detail: `${m.device} · ${m.dtype}` }); }
      else if (m.type === 'log') console.info('[LocalLLM]', m.text);
      else if (m.type === 'error') {
        if (worker) { worker.terminate(); worker = null; }
        set({ status: 'error', detail: explain(m.message) });
      } else if (m.type === 'result') {
        const p = pending.get(m.id);
        if (!p) return;
        pending.delete(m.id);
        if (m.error) console.warn('[LocalLLM] generation failed:', m.error);
        p.resolve(m.error ? null : m.text);
      }
    };
    worker.onerror = (e) => {
      if (worker) { worker.terminate(); worker = null; }
      set({ status: 'error', detail: explain(e.message || 'Worker crashed') });
    };
    worker.postMessage({ type: 'load', lib: CONFIG.transformersUrl, model: CONFIG.browserModel });
  }

  function workerGenerate(messages, maxTokens) {
    if (!worker) return Promise.resolve(null);
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, { resolve });
      worker.postMessage({ type: 'generate', id, messages, maxTokens: maxTokens || CONFIG.maxTokens, temperature: CONFIG.temperature });
    });
  }

  function explain(msg) {
    const m = String(msg || '');
    if (/fetch|network|import|load failed|cors|blocked/i.test(m)) {
      return "Couldn't download the model. This page may not be allowed to reach Hugging Face; run the game locally with npm start.";
    }
    return m.slice(0, 200);
  }

  // ───────────────────────── ollama backend ─────────────────────────

  async function loadOllama() {
    const { ollamaUrl, ollamaModel } = LLM.settings;
    set({ status: 'loading', progress: 0, detail: `Connecting to ${ollamaUrl}` });
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const names = (data.models || []).map((m) => m.name);
      const has = names.some((n) => n === ollamaModel || n === ollamaModel + ':latest');
      if (!has) { set({ status: 'error', detail: `Ollama is running but ${ollamaModel} isn't pulled. Run: ollama pull ${ollamaModel}` }); return; }
      rememberReady();
      set({ status: 'ready', progress: 100, detail: `${ollamaModel} · ${ollamaUrl.replace(/^https?:\/\//, '')}` });
    } catch (err) {
      set({ status: 'error', detail: `No Ollama server at ${ollamaUrl}. Start it with: ollama serve` });
    }
  }

  async function ollamaChat(messages, maxTokens) {
    const { ollamaUrl, ollamaModel } = LLM.settings;
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        messages,
        stream: false,
        options: { num_predict: maxTokens || CONFIG.maxTokens, temperature: CONFIG.temperature, top_p: 0.95, top_k: 64, repeat_penalty: 1.15 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.message ? data.message.content : null;
  }

  // ───────────────────────── wire into jev ─────────────────────────

  if (global.Jev) {
    const placeholder = global.Jev.fallback.bind(global.Jev);
    global.Jev.fallback = async function (prompt, ctx) {
      const text = await LLM.generate(prompt, ctx);
      if (text) { if (ctx) ctx.source = 'llm'; return text; }
      if (ctx) ctx.source = 'placeholder';
      return placeholder(prompt, ctx);
    };
  }

  global.LocalLLM = LLM;
  // the exported clean() is handy for tests
  LLM._clean = clean;
  LLM._buildMessages = buildMessages;
  LLM._cleanEmail = cleanEmail;

  if (LLM.settings.autoload && LLM.settings.backend !== 'off') {
    // weights come from the browser cache after the first download
    setTimeout(() => LLM.load(), 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
