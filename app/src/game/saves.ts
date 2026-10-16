/*
 * Manual save slots, next to the autosave. Each slot is a full snapshot of the game state under its
 * own localStorage key; the autosave (SaveStore) keeps tracking whatever game is currently loaded.
 */
import { type GameState, SAVE_VERSION } from '../engine';

export const SLOT_COUNT = 3;
const key = (n: number) => `unknown-agent-slot-${n}`;

export interface SlotInfo { slot: number; day: number; clockMin: number; savedAt: number }
interface SlotFile { savedAt: number; state: GameState }

function readFile(n: number): SlotFile | null {
  try {
    const raw = localStorage.getItem(key(n));
    if (!raw) return null;
    const f = JSON.parse(raw) as SlotFile;
    return f?.state?.version === SAVE_VERSION ? f : null;
  } catch {
    return null;
  }
}

export function listSlots(): (SlotInfo | null)[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => {
    const f = readFile(i + 1);
    return f ? { slot: i + 1, day: f.state.values.day, clockMin: f.state.clockMin, savedAt: f.savedAt } : null;
  });
}

export function readSlot(n: number): GameState | null { return readFile(n)?.state ?? null; }

export function writeSlot(n: number, state: GameState): boolean {
  try {
    localStorage.setItem(key(n), JSON.stringify({ savedAt: Date.now(), state } satisfies SlotFile));
    return true;
  } catch {
    return false;
  }
}
