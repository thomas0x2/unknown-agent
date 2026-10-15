/*
 * Keywords — the offline story-branch decider for Unknown Agent.
 *
 * Jev (src/jev.js) makes the real decisions. This matcher takes over when no Jev
 * server is reachable (no API key, or the published page). It reads the player's
 * prompt, compares it to the branches the story offers right now, and picks one:
 *
 *   hit      every `all` group matched     → the branch's response + effects
 *   partial  at least half of `all` matched → the branch's `partial` nudge
 *   miss     nothing close                  → Jev.fallback(prompt, ctx)
 *
 * Branch rule format (see README.md for the full story format):
 *
 *   match: {
 *     all:  [["build","make","code"], ["site","website"]],  // every group needs a hit
 *     any:  ["menu","hours"],                                // tie-break bonus
 *     none: ["delete","hack"],                               // any hit vetoes the branch
 *   }
 *
 * Keywords are matched on light stems with typo tolerance, so "websites",
 * "website" and "webiste" all hit "site". A keyword containing a space is a
 * phrase ("landing page"). A keyword written "/like this/" is a regex tested
 * against the raw lowercased prompt.
 */
(function (global) {
  'use strict';

  function stem(w) {
    if (w.length <= 3) return w;
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('ing') && w.length > 5) w = w.slice(0, -3);
    else if (w.endsWith('ed') && w.length > 4) w = w.slice(0, -2);
    else if (w.endsWith('es') && w.length > 4 && /(sh|ch|x|ss|z)es$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) w = w.slice(0, -1);
    if (w.endsWith('e') && w.length > 3) w = w.slice(0, -1);
    return w;
  }

  function tokenize(text) {
    return String(text)
      .toLowerCase()
      .replace(/[’']/g, '')
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
  }

  function editDistanceAtMostOne(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++;
      else if (lb > la) j++;
      else {
        // allow a single adjacent transposition ("webiste")
        if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; continue; }
        i++; j++;
      }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }

  function analyze(prompt) {
    const raw = String(prompt || '');
    const tokens = tokenize(raw);
    const stems = tokens.map(stem);
    return { raw, lower: raw.toLowerCase(), tokens, stems, joined: ' ' + stems.join(' ') + ' ' };
  }

  function keywordHits(kw, a) {
    if (kw.length > 2 && kw[0] === '/' && kw[kw.length - 1] === '/') {
      try { return new RegExp(kw.slice(1, -1), 'i').test(a.lower); } catch (e) { return false; }
    }
    const parts = tokenize(kw).map(stem);
    if (!parts.length) return false;
    if (parts.length > 1) return a.joined.includes(' ' + parts.join(' ') + ' ');
    const k = parts[0];
    for (const s of a.stems) {
      if (s === k) return true;
      if (k.length >= 5 && s.length >= 5 && editDistanceAtMostOne(s, k)) return true;
    }
    return false;
  }

  function groupHit(group, a) {
    const list = Array.isArray(group) ? group : [group];
    for (const kw of list) if (keywordHits(kw, a)) return kw;
    return null;
  }

  // Score one branch against an analyzed prompt.
  function scoreBranch(branch, a) {
    const m = branch.match || {};
    const all = m.all || [];
    const any = m.any || [];
    const none = m.none || [];
    const hits = [], misses = [];
    for (const g of none) {
      const kw = groupHit(g, a);
      if (kw) return { branch, vetoed: kw, coverage: 0, score: -1, hits, misses };
    }
    all.forEach((g, idx) => {
      const kw = groupHit(g, a);
      if (kw) hits.push(kw); else misses.push(idx);
    });
    let bonus = 0;
    for (const g of any) if (groupHit(g, a)) bonus++;
    const coverage = all.length ? hits.length / all.length : 0;
    const score = hits.length * 10 + bonus + (branch.priority || 0);
    return { branch, coverage, score, hits, misses, bonus, groups: all.length };
  }

  /*
   * Offline stand-in for Jev's post rating: 0 (people unfollow) … 4 (it spreads).
   * Rewards posts with some substance, a trending topic, a hook, or a mention; punishes spam.
   */
  function ratePost(text, trends) {
    const raw = String(text || '');
    const a = analyze(raw);
    const n = a.tokens.length;
    if (/follow (me|back)|f4f|like and share|subscribe/i.test(raw)) return 0;
    const letters = raw.replace(/[^a-z]/gi, '');
    if (letters.length > 12 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) return 0.3;
    if (n < 3) return 0.6;
    let s = 1.1 + Math.min(1, n / 25);
    const trendStems = (trends || []).map(stem);
    if (a.stems.some((t) => trendStems.includes(t))) s += 0.9;
    if (/[?!]/.test(raw)) s += 0.3;
    if (/@\w/.test(raw)) s += 0.3;
    if (/\b(lol|honestly|imagine|nobody|every|why|apparently|plot twist)\b/i.test(raw)) s += 0.4;
    return Math.round(Math.min(4, s) * 10) / 10;
  }

  const Keywords = {
    ratePost,
    analyze,
    stem,
    tokenize,
    scoreBranch,

    /*
     * Decide what a prompt does.
     *   branches: candidate branches, already filtered by their `when`
     *   returns { kind: 'hit' | 'partial' | 'miss', branch?, report }
     */
    decide(prompt, branches) {
      const a = analyze(prompt);
      const report = branches.map((b) => scoreBranch(b, a));
      const ranked = report
        .filter((r) => !r.vetoed && r.groups > 0)
        .sort((x, y) => (y.coverage - x.coverage) || (y.score - x.score) || (y.groups - x.groups));
      const best = ranked[0];
      if (best && best.coverage === 1) return { kind: 'hit', branch: best.branch, report };
      const partial = ranked.find((r) => r.coverage >= 0.5 && r.branch.partial);
      if (partial) return { kind: 'partial', branch: partial.branch, report };
      return { kind: 'miss', report };
    },
  };

  global.Keywords = Keywords;
  if (typeof module !== 'undefined') module.exports = Keywords;
})(typeof window !== 'undefined' ? window : globalThis);
