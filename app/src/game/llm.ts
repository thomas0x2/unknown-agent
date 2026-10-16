/*
 * LocalLLM — Gemma 3 270M, run locally for every off-script reply the game shows: agent.chat
 * answers that aren't a build/fix, the person behind a Qmail address, people on Y, and the local
 * model in the Terminal. Jev still decides every story beat (see engine/jev.ts); Gemma only writes
 * the words once the beat is known, or improvises a reply when nothing was triggered.
 *
 * Two backends, same as the legacy game:
 *   browser  a Web Worker running transformers.js (WebGPU if available, else WASM). Weights
 *            download once from Hugging Face and stay in the browser cache.
 *   ollama   a local Ollama server (`ollama pull gemma3:270m`).
 *
 * If the model is off, loading, slow or broken, generate() resolves to null and the caller uses its
 * scripted fallback, so the game never waits on it.
 */

import type { Character } from '../content/schema';
import { characterMessages, finishReply, maxTokensFor } from './characters';

export type Backend = 'browser' | 'ollama' | 'off';
export type Status = 'off' | 'loading' | 'ready' | 'error';

export interface ChatTurn { role: 'system' | 'user' | 'assistant'; content: string }
export interface GenCtx {
  /** The persona to speak as (the Terminal's local model). */
  persona?: string;
  /** Few-shot examples [user, assistant]. */
  examples?: [string, string][];
  /** Facts to ground the reply (wallet balance, last cost). */
  facts?: string;
  /** Longer replies (email bodies) vs. one or two sentences. */
  long?: boolean;
}

/** What a character says when Jev finds nothing: Gemma's reply, or the scripted line. */
export type Misses = 'gemma' | 'scripted';
interface Settings { backend: Backend; autoload: boolean; ollamaUrl: string; ollamaModel: string; misses: Misses }

const CONFIG = {
  transformersUrl: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js',
  browserModel: 'onnx-community/gemma-3-270m-it-ONNX',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'gemma3:270m',
  shortTokens: 72,
  longTokens: 140,
  temperature: 0.9,
  /** Characters stay close to their examples; 270M drifts off-character at higher temperatures. */
  characterTemperature: 0.5,
  /** transformers.js applies the repetition penalty to every prompt token, not just the reply, so
   * with a long prompt it pushes the model off common words ("I", "you", ".") into junk like "I'ôi".
   * Characters get none; the Terminal keeps a light one against loops. */
  terminalRepetitionPenalty: 1.1,
  timeoutMs: 25000,
  downloadRetries: 2,
};
const SETTINGS_KEY = 'unknown-agent-llm';

// Runs inside the worker. Kept as a real function and stringified below.
function workerMain() {
  let generator: any = null;
  const post = (m: any) => (self as any).postMessage(m);
  // transformers.js fetches the external weights file (*.onnx_data) inside a `new Promise(async …)`,
  // so when that download fails the error escapes as an unhandled rejection and pipeline() never
  // settles. Without this the load hangs forever at whatever byte count it had reached.
  let loading = false;
  self.addEventListener('unhandledrejection', (e: any) => {
    if (!loading) return;
    loading = false;
    post({ type: 'error', message: String((e.reason && e.reason.message) || e.reason) });
  });
  async function load(msg: any) {
    // Built with new Function so Vite's dev server can't rewrite this import() into a call to its
    // __vite__injectQuery helper, which doesn't exist inside the stringified worker.
    const importUrl = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
    const tf: any = await importUrl(msg.lib);
    tf.env.allowLocalModels = false;
    let device = 'wasm';
    try {
      if ((self as any).navigator && (navigator as any).gpu && (await (navigator as any).gpu.requestAdapter())) device = 'webgpu';
    } catch { /* no WebGPU */ }
    // Gemma's activations overflow in fp16, so no f16 variants. On the CPU, q8 keeps a 270M model
    // noticeably saner than q4.
    const chain = device === 'webgpu' ? ['q4', 'fp32'] : ['q8', 'q4', 'fp32'];
    let lastErr: any = null;
    for (const dtype of chain) {
      try {
        generator = await tf.pipeline('text-generation', msg.model, {
          device, dtype,
          progress_callback: (p: any) => {
            if (p.status === 'progress_total') post({ type: 'progress', progress: p.progress, loaded: p.loaded, total: p.total });
          },
        });
        post({ type: 'ready', device, dtype });
        return;
      } catch (err: any) { lastErr = err; post({ type: 'log', text: `${device}/${dtype} failed: ${err && err.message}` }); }
    }
    throw lastErr || new Error('No model variant could be loaded');
  }
  (self as any).onmessage = async (e: any) => {
    const msg = e.data;
    if (msg.type === 'load') {
      loading = true;
      try { await load(msg); } catch (err: any) { if (loading) post({ type: 'error', message: String((err && err.message) || err) }); }
      loading = false;
    } else if (msg.type === 'generate') {
      try {
        const out = await generator(msg.messages, {
          max_new_tokens: msg.maxTokens, do_sample: true, temperature: msg.temperature,
          top_p: 0.95, top_k: 64, repetition_penalty: msg.repetitionPenalty,
        });
        const last = out[0].generated_text;
        const text = Array.isArray(last) ? last[last.length - 1].content : String(last);
        post({ type: 'result', id: msg.id, text });
      } catch (err: any) { post({ type: 'result', id: msg.id, error: String((err && err.message) || err) }); }
    }
  };
}

class LocalLLM {
  config = CONFIG;
  settings: Settings = loadSettings();
  status: Status = 'off';
  progress = 0;
  loadedBytes = 0;
  totalBytes = 0;
  detail = '';
  last: { ms: number; ok: boolean; text: string } | null = null;
  /** Why the last generation gave no reply, in plain words (shown next to the scripted line). */
  lastMiss = '';

  private listeners = new Set<() => void>();
  private worker: Worker | null = null;
  private pending = new Map<number, (v: string | null) => void>();
  private nextId = 1;
  private retries = 0;
  private workerError = '';

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  label(): string { return this.settings.backend === 'ollama' ? 'Gemma 3 270M via Ollama' : 'Gemma 3 270M'; }

  setMisses(misses: Misses): void {
    this.settings.misses = misses;
    saveSettings(this.settings);
    this.emit();
  }

  setBackend(backend: Backend): void {
    if (backend === this.settings.backend) return;
    this.unload();
    this.settings.backend = backend;
    this.settings.autoload = false;
    saveSettings(this.settings);
    if (backend === 'ollama') this.load();
    this.emit();
  }

  load(): void {
    const b = this.settings.backend;
    if (b === 'off' || this.status === 'loading' || this.status === 'ready') return;
    if (b === 'browser') { this.retries = 0; this.loadBrowser(); }
    else if (b === 'ollama') this.loadOllama();
  }

  unload(): void {
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    for (const r of this.pending.values()) r(null);
    this.pending.clear();
    this.set({ status: 'off', progress: 0, detail: '' });
  }

  /** A reply from one of the game's characters to what the player wrote, or null (game/characters.ts). */
  async speak(ch: Character, text: string): Promise<string | null> {
    return this.run(characterMessages(ch, text), maxTokensFor(ch), (raw) => finishReply(ch, raw), CONFIG.characterTemperature, 1);
  }

  /** A reply in a free-form persona (the Terminal's local model), or null. */
  async generate(prompt: string, ctx: GenCtx & { persona: string }): Promise<string | null> {
    const messages: ChatTurn[] = [{ role: 'system', content: ctx.persona + (ctx.facts ? '\n' + ctx.facts : '') }];
    for (const [u, a] of ctx.examples || []) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
    messages.push({ role: 'user', content: String(prompt).slice(0, 700) });
    return this.run(messages, ctx.long ? CONFIG.longTokens : CONFIG.shortTokens, ctx.long ? cleanEmail : clean, CONFIG.temperature, CONFIG.terminalRepetitionPenalty);
  }

  private async run(messages: ChatTurn[], maxTokens: number, finish: (t: string) => string | null, temperature: number, penalty: number): Promise<string | null> {
    if (this.status !== 'ready') {
      this.lastMiss = this.settings.backend === 'off' ? 'local model is off' : this.status === 'loading' ? 'Gemma is still loading' : 'Gemma is not loaded';
      return null;
    }
    const started = now();
    let raw: string | null = null;
    let failed = '';
    try {
      raw = this.settings.backend === 'ollama'
        ? await withTimeout(this.ollamaChat(messages, maxTokens, temperature, penalty), CONFIG.timeoutMs)
        : await withTimeout(this.workerGenerate(messages, maxTokens, temperature, penalty), CONFIG.timeoutMs);
      if (raw == null) failed = this.workerError || `Gemma gave no reply within ${CONFIG.timeoutMs / 1000}s`;
    } catch (e: any) { raw = null; failed = String(e?.message || e); }
    this.workerError = '';
    const text = raw ? finish(raw) : null;
    this.lastMiss = text ? '' : failed || (raw ? `Gemma's reply was unusable: ${raw.slice(0, 80)}` : 'Gemma gave no reply');
    if (!text) console.info('[LocalLLM] no usable reply:', this.lastMiss, raw ?? '');
    this.last = { ms: Math.round(now() - started), ok: !!text, text: text || raw || '' };
    this.emit();
    return text;
  }

  private rememberReady(): void { this.settings.autoload = true; saveSettings(this.settings); }
  private emit(): void { for (const fn of this.listeners) { try { fn(); } catch (e) { console.error(e); } } }
  private set(patch: Partial<LocalLLM>): void { Object.assign(this, patch); this.emit(); }

  private loadBrowser(): void {
    this.set({ status: 'loading', progress: 0, loadedBytes: 0, totalBytes: 0, detail: 'Starting…' });
    try {
      const src = `(${workerMain.toString()})();`;
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      this.worker = new Worker(url, { type: 'module' });
    } catch (err: any) { this.set({ status: 'error', detail: `Couldn't start a worker: ${err.message}` }); return; }
    this.worker.onmessage = (e: MessageEvent) => {
      const m: any = e.data;
      if (m.type === 'progress') this.set({ progress: m.progress, loadedBytes: m.loaded, totalBytes: m.total, detail: 'Downloading' });
      else if (m.type === 'ready') { this.rememberReady(); this.set({ status: 'ready', progress: 100, detail: `${m.device} · ${m.dtype}` }); }
      else if (m.type === 'log') console.info('[LocalLLM]', m.text);
      else if (m.type === 'error') {
        this.killWorker();
        // A dropped connection mid-download: start again. Finished files are in the browser cache,
        // so only the interrupted one downloads again.
        if (isNetworkDrop(m.message) && this.retries < CONFIG.downloadRetries) {
          this.retries++;
          console.info('[LocalLLM] download interrupted, retrying:', m.message);
          this.loadBrowser();
          return;
        }
        this.set({ status: 'error', detail: explain(m.message) });
      }
      else if (m.type === 'result') {
        const r = this.pending.get(m.id);
        if (!r) return;
        this.pending.delete(m.id);
        if (m.error) { console.warn('[LocalLLM] generation failed:', m.error); this.workerError = `Gemma failed: ${String(m.error).slice(0, 120)}`; }
        r(m.error ? null : m.text);
      }
    };
    this.worker.onerror = (e) => { this.killWorker(); this.set({ status: 'error', detail: explain((e as any).message || 'Worker crashed') }); };
    this.worker.postMessage({ type: 'load', lib: CONFIG.transformersUrl, model: CONFIG.browserModel });
  }
  private killWorker(): void { if (this.worker) { this.worker.terminate(); this.worker = null; } }

  private workerGenerate(messages: ChatTurn[], maxTokens: number, temperature: number, repetitionPenalty: number): Promise<string | null> {
    if (!this.worker) return Promise.resolve(null);
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker!.postMessage({ type: 'generate', id, messages, maxTokens, temperature, repetitionPenalty });
    });
  }

  private async loadOllama(): Promise<void> {
    const { ollamaUrl, ollamaModel } = this.settings;
    this.set({ status: 'loading', progress: 0, detail: `Connecting to ${ollamaUrl}` });
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const names = (data.models || []).map((m: any) => m.name);
      if (!names.some((n: string) => n === ollamaModel || n === ollamaModel + ':latest')) {
        this.set({ status: 'error', detail: `Ollama is running but ${ollamaModel} isn't pulled. Run: ollama pull ${ollamaModel}` });
        return;
      }
      this.rememberReady();
      this.set({ status: 'ready', progress: 100, detail: `${ollamaModel} · ${ollamaUrl.replace(/^https?:\/\//, '')}` });
    } catch {
      this.set({ status: 'error', detail: `No Ollama server at ${ollamaUrl}. Start it with: ollama serve` });
    }
  }

  private async ollamaChat(messages: ChatTurn[], maxTokens: number, temperature: number, penalty: number): Promise<string | null> {
    const { ollamaUrl, ollamaModel } = this.settings;
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ollamaModel, messages, stream: false,
        options: { num_predict: maxTokens, temperature, top_p: 0.95, top_k: 64, repeat_penalty: penalty } }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.message ? data.message.content : null;
  }
}

function loadSettings(): Settings {
  const d: Settings = { backend: 'browser', autoload: false, ollamaUrl: CONFIG.ollamaUrl, ollamaModel: CONFIG.ollamaModel, misses: 'gemma' };
  try { return Object.assign(d, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { return d; }
}
function saveSettings(s: Settings): void { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage off */ } }
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Small models ramble and love markdown. Keep at most two sentences of plain text.
function clean(text: string): string | null {
  let t = String(text)
    .replace(/<end_of_turn>|<eos>|<\/?start_of_turn>(model|user)?/g, '')
    .replace(/[*_#`]+/g, '')
    .replace(/^\s*(assistant|model|agent|unknown agent)\s*:\s*/i, '')
    .replace(/\s+/g, ' ').trim()
    .replace(/^(okay|ok|alright|sure)[,.!]\s+(?=\S)/i, '')
    .replace(/^[a-z]/, (c) => c.toUpperCase());
  const sentences = t.match(/[^.!?]+[.!?]+["')\]]*/g);
  if (sentences) t = sentences.slice(0, 2).join('').trim();
  if (t.length > 320) t = t.slice(0, 317).replace(/\s+\S*$/, '') + '…';
  return t.length >= 2 ? t : null;
}
function cleanEmail(text: string): string | null {
  let t = String(text)
    .replace(/<end_of_turn>|<eos>|<\/?start_of_turn>(model|user)?/g, '')
    .replace(/[*_#`]+/g, '')
    .replace(/^\s*(subject|re)\s*:.*$/gim, '')
    .replace(/^\s*(love|best|regards|cheers|thanks|sincerely|xo)[^\n]{0,30},?\s*\n?[^\n]{0,30}\s*$/im, '')
    .replace(/\s+/g, ' ').trim();
  const sentences = t.match(/[^.!?]+[.!?]+["')\]]*/g);
  if (sentences) t = sentences.slice(0, 4).join('').trim();
  if (t.length > 480) t = t.slice(0, 477).replace(/\s+\S*$/, '') + '…';
  return t.length >= 2 ? t : null;
}
function isNetworkDrop(msg: string): boolean {
  return /network error|failed to fetch|networkerror|load failed/i.test(String(msg || '')) && !/dynamically imported module/i.test(String(msg || ''));
}
function explain(msg: string): string {
  const m = String(msg || '');
  if (isNetworkDrop(m)) return 'The model download was interrupted. Press Retry; the parts already downloaded are kept.';
  if (/fetch|network|import|load failed|cors|blocked/i.test(m)) {
    return "Couldn't download the model. This page may not be allowed to reach Hugging Face; run the game with npm run dev.";
  }
  return m.slice(0, 200);
}

export const LLM = new LocalLLM();
if (typeof window !== 'undefined' && LLM.settings.autoload && LLM.settings.backend !== 'off') {
  setTimeout(() => LLM.load(), 0);
}
