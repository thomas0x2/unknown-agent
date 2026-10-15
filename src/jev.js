/*
 * Jev — decides where the player's prompt takes the story.
 *
 * Jev is TypeSafe's System One model. For every prompt (or Chirpr post) the game
 * asks it one Choice question: which of the branches available right now does
 * this carry out, or none (`no_progress`)? Jev answers with a probability for
 * each option, and the story's `decision` thresholds turn those into:
 *
 *   hit      top branch ≥ decision.hit         → response + effects
 *   partial  a branch with a `partial` nudge
 *            ≥ decision.partial                → the nudge
 *   miss     no progress                       → Jev.fallback (local model or placeholder)
 *
 * The API key lives in server.mjs; this file only talks to /api/decide. When no
 * server or key is available (opening index.html directly, the published page),
 * decisions fall back to the offline keyword matcher in keywords.js.
 */
(function (global) {
  'use strict';

  const NO_PROGRESS = 'no_progress';
  const listeners = new Set();
  let ready = null;

  const Jev = {
    NO_PROGRESS,
    status: 'checking',   // checking | online | offline
    model: null,
    reason: '',           // why decisions are offline
    last: null,           // { ms, model, error } of the most recent call

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    init() {
      if (ready) return ready;
      ready = (async () => {
        try {
          const res = await withTimeout(fetch('api/status', { headers: { Accept: 'application/json' } }), 4000);
          const data = res && res.ok ? await res.json() : null;
          if (data && data.jev) set({ status: 'online', model: data.model, reason: '' });
          else if (data) set({ status: 'offline', reason: 'The server has no TYPESAFE_API_KEY.' });
          else set({ status: 'offline', reason: 'No Jev server. Run npm start to use Jev.' });
        } catch (e) {
          set({ status: 'offline', reason: 'No Jev server. Run npm start to use Jev.' });
        }
      })();
      return ready;
    },

    /*
     * Decide what a prompt does.
     *   branches: candidate branches, already filtered by their `when`
     *   opts: { kind: 'prompt' | 'chirp', node, thresholds: { hit, partial } }
     *   returns { kind: 'hit' | 'partial' | 'miss', branch?, engine, probabilities?, report? }
     */
    async decide(prompt, branches, opts) {
      opts = opts || {};
      await this.init();
      if (this.status === 'online' && branches.length) {
        const started = performance.now();
        try {
          const res = await withTimeout(fetch('api/decide', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: opts.kind || 'prompt', node: opts.node, prompt, candidates: branches.map((b) => b.id) }),
          }), 12000);
          if (!res) throw new Error('Jev timed out');
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
          this.last = { ms: Math.round(performance.now() - started), model: data.model, error: null };
          emit();
          return Object.assign(interpret(data, branches, opts.thresholds), { engine: 'jev', probabilities: data.probabilities, choice: data.choice });
        } catch (err) {
          this.last = { ms: Math.round(performance.now() - started), model: null, error: String(err.message || err) };
          emit();
          // fall through: keep the game playable if one call fails
        }
      }
      const d = global.Keywords.decide(prompt, branches);
      d.engine = 'keywords';
      if (this.status === 'online') d.fellBack = true;
      return d;
    },

    // What the agent says when nothing progresses. llm.js wraps this with a local model.
    async fallback(prompt, ctx) {
      const pool = (ctx && ctx.placeholders) || ['I am not sure what you mean.'];
      // deterministic per prompt, so asking the same thing twice is consistently useless
      let h = 0;
      for (const ch of String(prompt).toLowerCase().replace(/\s+/g, ' ').trim()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      return pool[h % pool.length];
    },
  };

  // Turn Jev's probabilities into a story outcome.
  function interpret(data, branches, thresholds) {
    const th = Object.assign({ hit: 0.5, partial: 0.2 }, thresholds);
    const p = data.probabilities || {};
    const byId = new Map(branches.map((b) => [b.id, b]));
    const top = data.choice;
    const topP = p[top] != null ? p[top] : data.confidence;
    if (top !== NO_PROGRESS && byId.has(top) && topP >= th.hit) return { kind: 'hit', branch: byId.get(top) };
    const nudge = branches
      .filter((b) => b.partial && (p[b.id] || 0) >= th.partial)
      .sort((a, b) => p[b.id] - p[a.id])[0];
    if (nudge) return { kind: 'partial', branch: nudge };
    return { kind: 'miss' };
  }

  /*
   * Model gating. A branch with `minModel: n` needs GIT-n or better: on a weaker
   * model a hit becomes 'locked' (the player still pays, nothing happens, and the
   * agent says which tier it needs). Nudges and misses pass through unchanged.
   */
  Jev.gate = function (decision, level) {
    if (decision.kind === 'hit' && decision.branch && (decision.branch.minModel || 1) > level) {
      return Object.assign({}, decision, { kind: 'locked' });
    }
    return decision;
  };

  // The response and effects a branch produces at a model tier, honouring `atModel` upgrades.
  Jev.outcome = function (branch, level) {
    let out = { response: branch.response, effects: branch.effects };
    const tiers = Object.keys(branch.atModel || {}).map(Number).filter((n) => n <= level).sort((a, b) => a - b);
    for (const n of tiers) out = Object.assign({}, out, branch.atModel[n]);
    return out;
  };

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
  }
  function set(patch) { Object.assign(Jev, patch); emit(); }
  function emit() { for (const fn of listeners) { try { fn(Jev); } catch (e) { console.error(e); } } }

  Jev._interpret = interpret;
  global.Jev = Jev;
  if (typeof module !== 'undefined') module.exports = Jev;
})(typeof window !== 'undefined' ? window : globalThis);
