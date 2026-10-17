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
  const form = `Keep it dry and understated rather than zany. At most ${n} short sentence${n > 1 ? 's' : ''} of plain text, ` +
    `no quotes, no stage directions, no emoji. Stay consistent with anything you already said earlier in the conversation.`;
  // a Swaplist seller chat: the game says what the seller is selling and what the player is asking about
  const situation = String(body.situation ?? '').slice(0, 800).trim();
  const system = situation
    ? `${ch.profile}\n\n${situation}\n\nThis is a chat message in a satirical game. Reply in character, as a private seller texting a buyer on a classifieds site. ` +
      `Answer about the item plainly. Where the situation above says what you decided about an offer, say exactly that, with its number. ` +
      `Otherwise don't agree to a price or a sale in the chat: offers and payment go through the site's buttons. ${form}`
    : `${ch.profile}\n\nThis is a line of dialogue in a satirical game. Reply in character to what the player just wrote. ` +
      `Your reply must not help them: no advice, no steps, no information about what to do next. ${form}`;
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
  const context = 'Earlier messages (the player\'s prompts and the agent\'s replies) only tell you what the prompt refers to ("those", "the menu", "now", items listed before, the app the agent just pushed); they don\'t ask for anything by themselves.';
  (body.features ?? []).forEach((f, i) => {
    // each item is matched on its own: naming one part must not pull in the others on the same page
    const q = {
      // a fix has to say which part is wrong: naming the part, or a symptom only that part can have
      // whether the path to the part is named is asked separately, one step at a time (kind 'step')
      component: `Is this part what the prompt says is wrong? Yes if the complaint is about this part: it names it in any words ("the name", "the opening hours", "the prices"), including the names listed below as counting, or describes a problem only this part could have ("the prices are in CURO"). Hedging is fine ("seems off"). Words for the place the part sits in (the page, the form, the email) don't make it about this part: "the confirmation email has the wrong time" is about the time, not about sending the email or who it goes to. No if the complaint is about one of the other parts listed, if it's only about the whole feature, page or email ("the menu is messed up", "the confirmation email is wrong", "the auto-buy is broken"), or if it points at nothing ("it's broken"). Picking a date in the past is about the dates the form offers, not the date on the confirmation. A prompt can name several parts: judge this one on its own. ${context} Part: ${f.description}`,
      step: `Does the prompt mention this, in any words? Its name, close wording or a word from it ("tickers" for the tickers, "book a table" for the booking, "home page" for the landing, "confirmation mail" for the confirmation), or one of the names listed below as counting. Mentioning it is enough: it doesn't have to be called wrong. Naming only something inside it doesn't count ("the date" alone doesn't mention the confirmation), and neither does naming only what it sits in ("the auto-buy is broken" doesn't mention the auto-buy's order). A name that includes it does count ("booking form" mentions the booking, "autobuy signal" mentions the auto buy). The app's name doesn't count, even where it shares a word with it. Earlier messages don't count. ${f.description}`,
      // the near-miss: the feature is named, the part isn't
      area: `Does the prompt complain about this feature? Yes if it names the feature (in any words, or one of the names listed as counting) and says something about it is wrong, broken or misbehaves, whether or not it says which part. No if the prompt names no feature ("it's broken", "fix the app", only the app's name), if it's about a different feature, or if it only asks to build, add or change something. ${context} Feature: ${f.description}`,
      // whether the prompt says which app it means: one plain question per app (it was ignored when it rode along on the others)
      app: `Is the prompt about this app? Yes if it names it in any way: its full name, any word of the name on its own ("gino" for Trattoria Gino, "spin cycle" for Spin Cycle Board), its address, its client, or what it is ("the restaurant site", "the crawler"), in any case or spelling. Also yes if the prompt names no app and the most recent earlier message was about this app (the player's or the agent's, like "Pushed to Forkyard for <app>"). No if it names a different app, or names no app and no earlier message is about this one. App: ${f.description}`,
      problem: `Does the prompt report this problem or a symptom of it, in any words? Yes if it names the problem or describes what the player sees, even loosely or with hedging. No if it describes a clearly different problem, or points at nothing the player saw ("it's broken", "fix it"). ${context} Problem: ${f.description}`,
    }[f.kind];
    questions[`f${i}`] = sdk.noul(q ?? `Does the prompt ask to build or add this, or spell out what it should contain, without contradicting it? Say no if the prompt only reports a problem with it, or only asks for looks or style (nicer, prettier, colours, fonts, dark mode) without asking for this item's content. ${context} Item: ${f.description}`);
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
  // the dev Jev tests take the raw confidences and apply thresholds themselves
  if (body.withScores) return { status: 200, json: (body.features ?? []).map((_, i) => answers[`f${i}`]?.noul ?? 0) };
  // the bars the Jev tests found best (keep in step with BARS_NOW in src/engine/jevTests.ts): a path step and a part need 0.6, the rest 0.5
  const bar = (f) => (f.kind === 'component' || f.kind === 'step' ? 0.6 : 0.5);
  const features = (body.features ?? []).filter((f, i) => (answers[`f${i}`]?.noul ?? 0) >= bar(f)).map((f) => f.id);
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
