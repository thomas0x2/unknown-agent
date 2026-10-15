/*
 * Unknown Agent server: serves the game and asks Jev (TypeSafe) which story
 * branch a prompt hits, or whether it makes no progress at all.
 *
 * The TypeSafe API key stays here, never in the page. The page only sends the
 * prompt, the current node and the branch ids it may take; this server looks up
 * those branches in src/story.js and builds the Jev question itself, so it can't
 * be used as a general-purpose proxy for your key.
 *
 *   TYPESAFE_API_KEY=... node server.mjs      (or put it in .env and run npm start)
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TypeSafeClient, choice, score } from '@typesafe-ai/sdk';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const NO_PROGRESS = 'no_progress';

const SETTING =
  'Unknown Agent is a game. The player is broke and pays per prompt for an AI chatbot called agent that can build and push code ' +
  'to Forkyard (a code host), send email from the player\'s Qmail, and read Y (a social network). It cannot press buttons ' +
  'or deploy for the player.';

export function loadStory() {
  const require = createRequire(import.meta.url);
  require('./src/story.js'); // defines globalThis.STORY
  return globalThis.STORY;
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Fix requests for every QA defect and upkeep issue any repo can have; the page offers only the open ones. */
export function defectBranches(story) {
  const out = [];
  for (const [repo, def] of Object.entries(story.repos || {})) {
    const all = [...((def.qa && def.qa.defects) || []), ...((def.upkeep && def.upkeep.issues) || [])];
    for (const d of all) out.push({ id: `defect:${repo}:${d.id}`, intent: d.intent });
  }
  return out;
}

/** Build the Jev request for one decision, or null when there is nothing to choose between. */
export function buildRequest(story, { kind, node, prompt, candidates }) {
  const nodeDef = story.nodes[node];
  if (!nodeDef) throw new HttpError(400, `Unknown node: ${node}`);
  const pool = kind === 'post' ? story.postActions || []
    : kind === 'mail' ? story.mailActions || []
    : [...(nodeDef.branches || []), ...(story.global || []), ...defectBranches(story)];
  const byId = new Map(pool.filter((b) => b.intent).map((b) => [b.id, b]));
  const ids = [...new Set(candidates)].filter((id) => byId.has(id) && id !== NO_PROGRESS);
  if (!ids.length) return null;

  const criteria = {};
  for (const id of ids) criteria[id] = byId.get(id).intent;
  criteria[NO_PROGRESS] = kind === 'post'
    ? 'The post does none of the above. Everyday posts, jokes, complaints and unrelated topics belong here.'
    : kind === 'mail'
    ? 'The email does none of the above, or goes to someone else. Small talk with other people, spam replies and unrelated topics belong here.'
    : 'The prompt asks for none of the above, is too vague to tell which, or leaves out details that an outcome above requires. ' +
      'Chit-chat, jokes, off-topic questions and unrelated tasks belong here.';

  const situation = nodeDef.scene || nodeDef.objective;
  const state = kind === 'post' ? { setting: SETTING, situation, player_post: prompt }
    : kind === 'mail' ? { setting: SETTING, situation, player_email: prompt }
    : { setting: SETTING, situation, player_prompt: prompt };
  const instructions = kind === 'post'
    ? 'The player published `player_post` on Y. Given `situation`, which outcome does the post accomplish?'
    : kind === 'mail'
    ? 'The player sent `player_email` from Qmail (its To line says who it went to). Given `situation`, which outcome does the email accomplish?'
    : 'The player typed `player_prompt` to their AI agent. Given `situation`, which outcome is the player asking the agent to carry out? ' +
      'Choose an outcome only when the prompt clearly asks for it, including any details its description requires.';

  return { state, questions: { branch: choice(instructions, criteria) } };
}

/** Build the Jev request that rates a Y post 0–4 against the story's rubric. */
export function buildRateRequest(story, text) {
  const y = story.y;
  if (!y || !Array.isArray(y.rubric) || y.rubric.length < 2) throw new HttpError(404, 'This story has no Y rubric');
  return {
    state: { setting: y.setting || '', trending_topics: (y.trends || []).join(', '), post: text },
    questions: {
      engagement: score(
        'The player published `post` on Y. Given `setting` and `trending_topics`, how likely is this post to win its author new followers?',
        y.rubric,
      ),
    },
  };
}

function validate(body) {
  const { kind = 'prompt', node, prompt, candidates } = body || {};
  if (!['prompt', 'post', 'mail'].includes(kind)) throw new HttpError(400, 'kind must be "prompt", "post" or "mail"');
  if (typeof node !== 'string' || node.length > 64) throw new HttpError(400, 'node must be a string');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) throw new HttpError(400, 'prompt must be 1–2000 characters');
  if (!Array.isArray(candidates) || candidates.length > 50 || !candidates.every((c) => typeof c === 'string')) {
    throw new HttpError(400, 'candidates must be an array of up to 50 branch ids');
  }
  return { kind, node, prompt: prompt.trim(), candidates };
}

async function readJson(req, limit = 16 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new HttpError(400, 'Invalid JSON'); }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function serveStatic(pathname, res, root) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  // only the page and its assets; never server code, .env or node_modules
  if (!(rel === 'index.html' || /^(src|dist)\/[\w./-]+$/.test(rel)) || rel.includes('..')) return false;
  const ext = path.extname(rel);
  if (!TYPES[ext]) return false;
  try {
    const data = await readFile(path.join(root, rel));
    res.writeHead(200, { 'Content-Type': TYPES[ext], 'Cache-Control': 'no-cache' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

export function createHandler({ client, story = loadStory(), root = ROOT, timeout = 8000 } = {}) {
  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/status' && req.method === 'GET') {
        return send(res, 200, { jev: !!client, model: client ? client.defaultModel : null });
      }
      if (url.pathname === '/api/rate' && req.method === 'POST') {
        if (!client) throw new HttpError(503, 'TYPESAFE_API_KEY is not set on the server');
        const body = await readJson(req);
        const text = typeof body.text === 'string' ? body.text.trim() : '';
        if (!text || text.length > 400) throw new HttpError(400, 'text must be 1–400 characters');
        const result = await client.systemOne(buildRateRequest(story, text), { timeout });
        const a = result.answers.engagement;
        return send(res, 200, { score: a.score, confidence: a.confidence, probabilities: a.probabilities, model: result.model });
      }
      if (url.pathname === '/api/decide' && req.method === 'POST') {
        if (!client) throw new HttpError(503, 'TYPESAFE_API_KEY is not set on the server');
        const input = validate(await readJson(req));
        const request = buildRequest(story, input);
        if (!request) return send(res, 200, { choice: NO_PROGRESS, confidence: 1, probabilities: {}, skipped: true });
        const started = Date.now();
        const result = await client.systemOne(request, { timeout });
        const answer = result.answers.branch;
        return send(res, 200, {
          choice: answer.choice,
          confidence: answer.confidence,
          probabilities: answer.probabilities,
          model: result.model,
          usage: result.usage,
          ms: Date.now() - started,
        });
      }
      if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
      if (req.method === 'GET' && (await serveStatic(url.pathname, res, root))) return;
      send(res, 404, { error: 'Not found' });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 502;
      if (status === 502) console.error('[jev]', err.message);
      send(res, status, { error: err.message });
    }
  };
}

export function createClient(env = process.env) {
  if (!env.TYPESAFE_API_KEY || !env.TYPESAFE_API_KEY.trim()) return null;
  return new TypeSafeClient({ retry: { maxRetries: 1 } });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 8080;
  const client = createClient();
  http.createServer(createHandler({ client })).listen(port, () => {
    console.log(`Unknown Agent → http://localhost:${port}`);
    console.log(client
      ? `Story decisions: Jev (${client.defaultModel})`
      : 'Story decisions: offline keyword matcher. Set TYPESAFE_API_KEY (see .env.example) to use Jev.');
  });
}
