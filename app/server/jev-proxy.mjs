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

const PORT = Number(process.env.PORT) || 8787;
const KEY = process.env.TYPESAFE_API_KEY || '';
const BASE_URL = process.env.TYPESAFE_BASE_URL || undefined;

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
  criteria.nothing = 'The message achieves none of the above.';
  return {
    state: { setting: SETTING, situation: body.stateSummary, player_message: body.text },
    questions: {
      branch: sdk.choice('Which outcome does the player\'s message accomplish, if any?', criteria),
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
  (body.features ?? []).forEach((f, i) => {
    questions[`f${i}`] = sdk.noul(`Does the prompt ask for this feature, described correctly? Feature: ${f.description}`);
  });
  return { state: { setting: SETTING, prompt: body.prompt }, questions };
}

async function handle(kind, body) {
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
    getClient().then((client) => {
      const reason = client ? '' : KEY ? 'The proxy could not load @typesafe-ai/sdk (run npm install).' : 'TYPESAFE_API_KEY is not set in app/.env.';
      res.end(JSON.stringify({ jev: !!client, reason }));
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
  console.log(`[jev-proxy] listening on :${PORT} — Jev ${KEY ? 'configured' : 'NOT configured (clients fall back offline)'}`);
});
