/*
 * Jev backend proxy. The browser never holds the API key; it POSTs to this server, which builds the
 * Jev questions itself (so it is not an open proxy) and asks TypeSafe's System One model.
 *
 * Without TYPESAFE_API_KEY the endpoints return 501 and the client falls back to its offline keyword
 * router, so the game stays playable. With a key, it dynamically loads @typesafe-ai/sdk (install it
 * separately) and calls `client.systemOne({ state, questions })`, mirroring the original game's proxy.
 *
 * Run: npm run proxy   (reads .env if present)
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';

const PORT = Number(process.env.PORT) || 8787;
const KEY = process.env.TYPESAFE_API_KEY || '';
const BASE_URL = process.env.TYPESAFE_BASE_URL || undefined;

// Off-script character replies (the "Haiku (API)" Misses setting). The browser sends only a
// character id and the player's text; the prompt is built here from content/characters.json, so
// this is not an open proxy either.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const WRITER_MODEL = 'claude-haiku-5-5';
const CHARACTERS = JSON.parse(readFileSync(new URL('../content/characters.json', import.meta.url), 'utf8'));
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
/**
 * The conversation before the player's new message (the email thread or the recent agent.chat
 * transcript, scripted lines included), so the character stays consistent with what was already
 * said. Capped, so the endpoint stays a character writer and not a general one.
 */
function historyBlock(history) {
  if (!Array.isArray(history) || !history.length) return '';
  const lines = history.slice(-12).map((h) => {
    const from = h?.from === 'player' ? 'Player' : h?.from === 'self' ? 'You' : String(h?.from ?? '').replace(/[\r\n:]/g, ' ').slice(0, 40).trim() || 'Someone';
    return `${from}: ${String(h?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 600)}`;
  });
  return `Earlier in this conversation, oldest first ("You" is you, and you remember all of it):\n${lines.join('\n')}`;
}

async function write(body) {
  const ch = CHARACTERS.find((c) => c.id === body.character);
  if (!ch) return { status: 400, json: { error: `unknown character ${body.character}` } };
  const n = ch.sentences ?? 2;
  const system =
    `${ch.profile}\n\nThis is a line of dialogue in a satirical game. Reply in character to what the player just wrote. ` +
    `Your reply must not help them: no advice, no steps, no information about what to do next. ` +
    `Keep it dry and understated rather than zany. At most ${n} short sentence${n > 1 ? 's' : ''} of plain text, ` +
    `no quotes, no stage directions, no emoji. Stay consistent with anything you already said earlier in the conversation.`;
  const messages = [];
  for (const [u, a] of ch.examples) messages.push({ role: 'user', content: u }, { role: 'assistant', content: a });
  const said = String(body.text ?? '').slice(0, 400);
  const earlier = historyBlock(body.history);
  messages.push({ role: 'user', content: earlier ? `${earlier}\n\nThe player now writes:\n${said}` : said });
  const started = Date.now();
  if (body.via === 'subscription') return writeWithCli(system, messages, started);
  const client = await getAnthropic();
  if (!client) return { status: 501, json: { error: ANTHROPIC_KEY ? 'The proxy could not load @anthropic-ai/sdk (run npm install).' : 'ANTHROPIC_API_KEY is not set in app/.env.' } };
  const res = await client.messages.create({
    model: WRITER_MODEL,
    max_tokens: 300,
    thinking: { type: 'disabled' },
    output_config: { effort: 'low' },
    system,
    messages,
  });
  const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return {
    status: 200,
    json: { text, model: res.model, stop: res.stop_reason, ms: Date.now() - started, usage: res.usage, system, messages },
  };
}

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

const SETTING =
  'A fake-browser game. The player is an unemployed person using an AI agent to make rent. ' +
  'Every message they write is free text the model must judge.';

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

// ── request builders: turn the client's payload into a typed Jev question ──
async function buildRoute(sdk, body) {
  const criteria = {};
  for (const c of body.candidates ?? []) criteria[c.id] = c.when;
  // a hint is a near miss: the player is after one of the outcomes but hasn't done it yet
  const hints = body.strict ? [] : (body.hints ?? []).filter(Boolean);
  hints.forEach((h, i) => {
    criteria[`hint_${i}`] = `The message doesn't accomplish any outcome above but is on the right track, and this answer would nudge the player: "${h}"`;
  });
  // strict routes (agent.chat hints) should only fire on a clear match; small talk, insults and
  // questions about agent itself fall through to a roast.
  criteria.nothing = body.strict
    ? 'None of the above clearly applies: small talk, jokes, insults, personal requests, questions about agent itself, or anything only loosely related. Pick this when unsure.'
    : 'The message achieves none of the above.';
  const earlier = (body.context ?? []).filter(Boolean);
  if (earlier.length) criteria.nothing += ' The earlier messages only tell you what the message refers to; they accomplish nothing by themselves.';
  return {
    state: { setting: SETTING, situation: body.stateSummary, ...(earlier.length ? { earlierMessages: earlier } : {}), player_message: body.text },
    questions: {
      branch: sdk.choice(earlier.length
        ? 'The player\'s message answers the earlier messages (an email thread, a post or a chat). Which outcome does it accomplish, if any?'
        : 'Which outcome does the player\'s message accomplish, if any?', criteria),
    },
  };
}
async function buildRatePost(sdk, body) {
  return {
    state: { setting: SETTING, post: body.text, trending: (body.trending ?? []).join(', '), followers: body.followers },
    questions: {
      category: sdk.choice('Classify the Y post.', {
        reaction: 'Reacts to a trending topic.',
        launch: 'Announces or links a built app.',
        tip: 'A useful tip about building or AI tools.',
        humor: 'Humor that fits the platform.',
        hot_take: 'A hot take or outrage bait.',
        self_promo: 'Pure self-promotion.',
        spam: 'Spam, irrelevant, or a near-copy of a recent post.',
      }),
      quality: sdk.score('How well would this post win followers on Y?', [
        'Ignored or annoying.',
        'Weak: few people would engage.',
        'Decent.',
        'Good: people would like and share it.',
        'Excellent: it would spread.',
      ]),
    },
  };
}
async function buildMatch(sdk, body) {
  // one yes/no question per feature, so a prompt can ask for several at once
  const questions = {};
  const named = body.appNamed ? ' The prompt must also say which app it means: its name, part of the name, or its address, in any case or spelling, or clearly the app an earlier message named, including the app the agent just worked on when the prompt follows up on it ("now the prices are missing").' : '';
  const context = 'Earlier messages (the player\'s prompts and the agent\'s replies) only tell you what the prompt refers to ("those", "the menu", "now", items listed before, the app the agent just pushed); they don\'t ask for anything by themselves.';
  (body.features ?? []).forEach((f, i) => {
    // a problem is matched on its own: naming one bug must not pull in the others on the same page
    questions[`f${i}`] = f.kind === 'problem'
      ? sdk.noul(`Does the prompt point out this specific problem, in any words: naming it, describing what they see, or saying what it should be instead? Say no if the prompt is about a different problem, even one on the same page, or only says something is wrong without saying what. ${context}${named} Problem: ${f.description}`)
      : sdk.noul(`Does the prompt ask to build or add this, or spell out what it should contain, without contradicting it? Say no if the prompt only reports a problem with it. ${context}${named} Item: ${f.description}`);
  });
  const earlier = (body.context ?? []).filter(Boolean);
  return { state: { setting: SETTING, ...(earlier.length ? { earlierMessages: earlier } : {}), prompt: body.prompt }, questions };
}

async function handle(kind, body) {
  if (kind === 'write') return write(body);
  const client = await getClient();
  if (!client) return { status: 501, json: { error: KEY ? 'The proxy could not load @typesafe-ai/sdk (run npm install).' : 'TYPESAFE_API_KEY is not set in app/.env.' } };
  const sdk = await import('@typesafe-ai/sdk');
  let req;
  if (kind === 'route') req = await buildRoute(sdk, body);
  else if (kind === 'rate-post') req = await buildRatePost(sdk, body);
  else if (kind === 'match-features') {
    if (!(body.features ?? []).length) return { status: 200, json: [] };
    req = await buildMatch(sdk, body);
  }
  else return { status: 404, json: { error: 'unknown endpoint' } };

  // The SDK returns { model, answers: { <question>: … }, usage }. Shape it into what BackendJev expects.
  const { answers } = await client.systemOne(req);
  if (kind === 'route') {
    const choice = answers.branch?.choice ?? 'nothing';
    const hint = /^hint_(\d+)$/.exec(choice);
    if (hint) return { status: 200, json: { kind: 'hint', hintIndex: Number(hint[1]) } };
    return { status: 200, json: choice === 'nothing' ? { kind: 'nothing' } : { kind: 'outcome', outcomeId: choice } };
  }
  if (kind === 'rate-post') {
    // score is the expected rubric level, 0..4
    return { status: 200, json: { category: answers.category?.choice ?? 'tip', quality: (answers.quality?.score ?? 2) / 4 } };
  }
  const features = (body.features ?? []).filter((f, i) => (answers[`f${i}`]?.noul ?? 0) >= 0.5).map((f) => f.id);
  return { status: 200, json: features };
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
      const { status, json } = await handle(m[1], body);
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
