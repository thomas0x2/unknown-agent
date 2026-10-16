/*
 * Save slots. Each slot is a full snapshot of the game state under its own localStorage key: three
 * manual slots, plus 'auto', written every morning so a bad day can be rolled back. Separately, the
 * SaveStore keeps the current game saved after every action.
 */
import { type GameState, SAVE_VERSION } from '../engine';

export const SLOT_COUNT = 3;
export type Slot = number | 'auto';
const key = (n: Slot) => `unknown-agent-slot-${n}`;

export interface SlotInfo { slot: Slot; day: number; clockMin: number; savedAt: number }
interface SlotFile { savedAt: number; state: GameState }

function readFile(n: Slot): SlotFile | null {
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

export function autoSlot(): SlotInfo | null {
  const f = readFile('auto');
  return f ? { slot: 'auto', day: f.state.values.day, clockMin: f.state.clockMin, savedAt: f.savedAt } : null;
}

export function readSlot(n: Slot): GameState | null { return readFile(n)?.state ?? null; }

export function writeSlot(n: Slot, state: GameState): boolean {
  try {
    localStorage.setItem(key(n), JSON.stringify({ savedAt: Date.now(), state } satisfies SlotFile));
    return true;
  } catch {
    return false;
  }
}
