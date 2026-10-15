/*
 * Meters, flags and endings: the hidden state that decides where the story goes.
 *
 * Meters (story.meters) are numbers. Most are stored in state.meters and moved by the effect
 * `meters: { family: 5, misalignment: -2 }`. Two read live game values instead (`source`):
 * money is the wallet, followers is the Y follower count; effects change those through
 * `money` and `followers`, not `meters`.
 *
 * Conditions read meters with `meters: { family: { min: 10 }, mafia: { max: -20 } }`.
 *
 * Flags (story.flags) document every flag the story uses. A flag with a `when` is derived:
 * it is true whenever that condition holds (e.g. `spinLive` while Spin Cycle is deployed),
 * so the story can test it like any other flag without anything having to set it.
 *
 * Endings (story.endings) are checked in order; the first whose `when` holds is the one the
 * story is heading toward, and the effect `ending: true` plays it.
 */
(function (global) {
  'use strict';

  const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

  const Meters = {
    defs(S) { return S.meters || []; },
    def(S, id) { return (S.meters || []).find((m) => m.id === id); },

    // starting values of the stored meters
    init(S) {
      const out = {};
      for (const m of S.meters || []) if (!m.source) out[m.id] = m.start || 0;
      return out;
    },

    value(state, S, id) {
      const d = this.def(S, id);
      if (d && d.source === 'money') return state.money;
      if (d && d.source === 'followers') return state.followers;
      const v = state.meters && state.meters[id];
      return v != null ? v : (d && d.start) || 0;
    },

    // Apply deltas, clamped to each meter's range. Returns the changes that happened.
    apply(state, S, deltas) {
      const changes = [];
      state.meters = state.meters || this.init(S);
      for (const [id, delta] of Object.entries(deltas || {})) {
        const d = this.def(S, id);
        if (!d) { console.warn('Unknown meter', id); continue; }
        if (d.source) { console.warn(`Meter ${id} follows ${d.source}; change it with that effect instead`); continue; }
        const before = this.value(state, S, id);
        const after = Math.max(d.min != null ? d.min : -Infinity, Math.min(d.max != null ? d.max : Infinity, before + delta));
        state.meters[id] = after;
        if (after !== before) changes.push({ id, before, after });
      }
      return changes;
    },

    // { id: { min, max } }: every listed meter within its bounds (inclusive)
    test(state, S, cond) {
      for (const [id, c] of Object.entries(cond || {})) {
        const v = this.value(state, S, id);
        if (c.min != null && v < c.min) return false;
        if (c.max != null && v > c.max) return false;
      }
      return true;
    },

    // the named band a value falls in (bands are { min, label }, ascending)
    band(def, v) {
      let out = null;
      for (const b of (def && def.bands) || []) if (v >= b.min) out = b;
      return out;
    },

    // Is a flag on? Derived flags evaluate their condition through `check`.
    flag(state, S, name, check) {
      const d = S.flags && S.flags[name];
      if (d && d.when) return !!check(d.when);
      return !!(state.flags && state.flags[name]);
    },

    // The ending the story is heading toward right now.
    ending(S, check) {
      return (S.endings || []).find((e) => !e.when || check(e.when)) || null;
    },

    arr,
  };

  global.Meters = Meters;
  if (typeof module !== 'undefined') module.exports = Meters;
})(typeof window !== 'undefined' ? window : globalThis);
