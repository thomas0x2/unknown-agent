/*
 * Jev backend proxy. The browser never holds the API key; it POSTs to this server, which builds the
 * Jev questions itself (so it is not an open proxy) and asks TypeSafe's System One model. The
 * prompts and questions live in server/api.mjs, shared with the browser build that calls the APIs
 * directly with the player's own keys (the GitHub Pages version).
 *
 * Without TYPESAFE_API_KEY the endpoints return 501 and the client falls back to its offline keyword
 * router, so the game stays playable. With a key, it dynamically loads @typesafe-ai/sdk (install it
 * separately) and calls `client.systemOne({ state, questions })`, mirroring the original game's proxy.
 *
 * Run: npm run proxy   (reads .env if present)
 */
import http from 'node:http';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createApi } from './api.mjs';

const PORT = Number(process.env.PORT) || 8787;
const KEY = process.env.TYPESAFE_API_KEY || '';
const BASE_URL = process.env.TYPESAFE_BASE_URL || undefined;

// Off-script character replies (the "Haiku (API)" Misses setting). The browser sends only a
// character id and the player's text; the prompt is built here from content/characters/*.json, so
// this is not an open proxy either.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const WRITER_MODEL = 'claude-haiku-5-5';
const CHARACTER_DIR = new URL('../content/characters/', import.meta.url);
const CHARACTERS = readdirSync(CHARACTER_DIR).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, CHARACTER_DIR), 'utf8')));
let anthropicPromise = null;
async function getAnthropic() {
  if (!ANTHROPIC_KEY) return null;
  if (!anthropicPromise) {
    anthropicPromise = (async () => {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        return new Anthropic({ apiKey: ANTHROPIC_KEY, baseURL: process.env.ANTHROPIC_BASE_URL || undefined });
      } catch (e) {
        console.warn('[jev-proxy] @anthropic-ai/sdk not available:', e.message);
        return null;
      }
    })();
  }
  return anthropicPromise;
}

// body.via picks who pays: 'api' uses ANTHROPIC_API_KEY, 'subscription' runs the Claude Code CLI
// (`claude -p`) on this machine, so it bills the Claude subscription you are logged in with. The
// subscription route is for local development only; a shipped game uses the API key.
// Without these the CLI would bill the API key from .env instead of the logged-in subscription.
function cliEnv() {
  const env = { ...process.env };
  for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']) delete env[k];
  return env;
}

/** The same request through the Claude Code CLI, which takes one prompt, so the examples become a transcript. */
function writeWithCli(system, messages, started) {
  const prompt = messages.map((m) => `${m.role === 'user' ? 'Player' : 'You'}: ${m.content}`).join('\n') + '\nYou:';
  const args = ['-p', prompt, '--model', WRITER_MODEL, '--system-prompt', system + ' Reply with your line only, without a "You:" prefix.',
    '--tools', '', '--strict-mcp-config', '--no-session-persistence', '--output-format', 'json'];
  return new Promise((resolve) => {
    execFile(process.env.CLAUDE_BIN || 'claude', args, { cwd: tmpdir(), timeout: 60000, maxBuffer: 1 << 20, env: cliEnv() }, (err, stdout, stderr) => {
      if (err && !stdout) {
        const missing = err.code === 'ENOENT';
        resolve({ status: 501, json: { error: missing ? 'The claude CLI is not installed or not on PATH (needed for the subscription route).' : `claude -p failed: ${String(stderr || err.message).slice(0, 200)}` } });
        return;
      }
      try {
        const out = JSON.parse(stdout);
        if (out.is_error) { resolve({ status: 502, json: { error: `claude -p: ${String(out.result).slice(0, 200)}` } }); return; }
        const text = String(out.result ?? '').replace(/^\s*you:\s*/i, '').trim();
        resolve({ status: 200, json: { text, model: `${WRITER_MODEL} via your Claude subscription`, stop: out.stop_reason, ms: Date.now() - started, usage: out.usage, system, messages } });
      } catch {
        resolve({ status: 502, json: { error: `claude -p returned something unexpected: ${stdout.slice(0, 200)}` } });
      }
    });
  });
}

// Lazily created TypeSafe client (only when a key is configured and the SDK is installed).
let clientPromise = null;
async function getClient() {
  if (!KEY) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const sdk = await import('@typesafe-ai/sdk');
        return new sdk.TypeSafeClient({ apiKey: KEY, baseURL: BASE_URL });
      } catch (e) {
        console.warn('[jev-proxy] @typesafe-ai/sdk not available:', e.message);
        return null;
      }
    })();
  }
  return clientPromise;
}


const api = createApi({
  characters: CHARACTERS,
  anthropic: getAnthropic,
  async typesafe() {
    const client = await getClient();
    return client ? { client, sdk: await import('@typesafe-ai/sdk') } : null;
  },
  anthropicMissing: () => (ANTHROPIC_KEY ? 'The proxy could not load @anthropic-ai/sdk (run npm install).' : 'ANTHROPIC_API_KEY is not set in app/.env.'),
  typesafeMissing: () => (KEY ? 'The proxy could not load @typesafe-ai/sdk (run npm install).' : 'TYPESAFE_API_KEY is not set in app/.env.'),
  cli: writeWithCli,
});

// The dev wiki editor (wiki.dev in the game, ui/wiki.ts) saves a page back into content/wiki. Only a
// plain page name in that one folder, only markdown, so it can't write anywhere else.
const WIKI_DIR = new URL('../content/wiki/', import.meta.url);
function saveWiki(body) {
  const file = String(body.file ?? '');
  const md = String(body.md ?? '');
  if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(file) || file === 'readme.md') return { status: 400, json: { error: 'bad page name' } };
  if (!md.startsWith('---\n') || md.length > 200_000) return { status: 400, json: { error: 'not a wiki page' } };
  writeFileSync(new URL(file, WIKI_DIR), md);
  return { status: 200, json: { ok: true } };
}


const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  const m = req.url?.match(/^\/api\/([a-z-]+)$/);
  if (req.method === 'GET' && req.url === '/api/status') {
    Promise.all([getClient(), getAnthropic()]).then(([client, anthropic]) => {
      const reason = client ? '' : KEY ? 'The proxy could not load @typesafe-ai/sdk (run npm install).' : 'TYPESAFE_API_KEY is not set in app/.env.';
      res.end(JSON.stringify({ jev: !!client, reason, writer: !!anthropic }));
    });
    return;
  }
  if (req.method !== 'POST' || !m) {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    try {
      const body = raw ? JSON.parse(raw) : {};
      const { status, json } = m[1] === 'wiki' ? saveWiki(body) : await api(m[1], body);
      res.statusCode = status;
      res.end(JSON.stringify(json));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(e?.message || e) }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[jev-proxy] listening on :${PORT} — Jev ${KEY ? 'configured' : 'NOT configured (clients fall back offline)'}, Haiku replies ${ANTHROPIC_KEY ? 'configured' : 'NOT configured'}`);
});
