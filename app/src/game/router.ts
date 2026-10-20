/*
 * The game's Jev router, chosen by the Online / Offline setting (game/misses.ts). Online, every
 * judgment goes to the real Jev through the backend proxy (BackendJev), with no keyword fallback.
 * Offline, a local keyword matcher (engine/offlineJev.ts) decides instead, so the game needs no
 * network and no keys. Every engine action takes this one router; it switches as the player toggles.
 */
import type { JevRouter, RouteInput, PostInput, FeatureMatchInput } from '../engine';
import { offlineJev } from '../engine';
import { JEV } from './backendJev';
import { MISSES } from './misses';

const pick = (): JevRouter => (MISSES.offline ? offlineJev : JEV);

export const ROUTER: JevRouter = {
  route: (i: RouteInput) => pick().route(i),
  ratePost: (i: PostInput) => pick().ratePost(i),
  matchFeatures: (i: FeatureMatchInput) => pick().matchFeatures(i),
  // called as a method: pulled off its router first, it lost `this` and every query matching several wiki pages threw
  matchScores: (i: FeatureMatchInput) => { const r = pick(); return r.matchScores ? r.matchScores(i) : JEV.matchScores(i); },
};
