/*
 * Deterministic RNG (mulberry32). The whole engine draws randomness from state.rng so a save
 * replays identically and tests can pin outcomes. Never call Math.random in the engine.
 */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, seed: t };
}

/** Random seed for a new game. */
export function makeSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) | 0) || 1;
}
