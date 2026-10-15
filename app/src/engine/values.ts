/*
 * The numeric values the save holds. Each has a range the engine clamps to, and a visibility
 * flag so the UI knows what the player is allowed to see. Hidden values never appear in the UI.
 */
import { START } from './config';

export type MeterId =
  | 'day'
  | 'crypto'
  | 'followers'
  | 'agentLevel'
  | 'leash'
  | 'misuseScore'
  | 'suspicion'
  | 'nullStanding'
  | 'mafiaStanding'
  | 'familyTrust';

export interface MeterDef {
  id: MeterId;
  label: string;
  min: number;
  max: number | null; // null = unbounded above
  start: number;
  visible: boolean;
}

export const METERS: Record<MeterId, MeterDef> = {
  day: { id: 'day', label: 'Day', min: 1, max: 21, start: 1, visible: true },
  crypto: { id: 'crypto', label: 'DOLR', min: 0, max: null, start: START.crypto, visible: true },
  followers: { id: 'followers', label: 'Followers', min: 0, max: null, start: START.followers, visible: true },
  agentLevel: { id: 'agentLevel', label: 'Agent level', min: 1, max: 5, start: 1, visible: true },
  leash: { id: 'leash', label: 'Leash', min: 0, max: 100, start: 0, visible: false },
  misuseScore: { id: 'misuseScore', label: 'Misuse', min: 0, max: 100, start: 0, visible: false },
  suspicion: { id: 'suspicion', label: 'Suspicion', min: 0, max: 100, start: 0, visible: false },
  nullStanding: { id: 'nullStanding', label: 'Null Collective', min: -100, max: 100, start: 0, visible: false },
  mafiaStanding: { id: 'mafiaStanding', label: 'Mafia', min: -100, max: 100, start: 0, visible: false },
  familyTrust: { id: 'familyTrust', label: 'Family', min: 0, max: 100, start: START.familyTrust, visible: false },
};

export const METER_IDS = Object.keys(METERS) as MeterId[];

export function clampMeter(id: MeterId, value: number): number {
  const def = METERS[id];
  let v = value;
  if (def.max !== null && v > def.max) v = def.max;
  if (v < def.min) v = def.min;
  // crypto keeps cents; the rest are whole numbers
  return id === 'crypto' ? Math.round(v * 100) / 100 : Math.round(v);
}

export function initialMeters(): Record<MeterId, number> {
  const out = {} as Record<MeterId, number>;
  for (const id of METER_IDS) out[id] = METERS[id].start;
  return out;
}
