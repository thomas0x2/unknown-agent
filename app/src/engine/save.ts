/*
 * Saving behind a small interface so the Steam build can swap localStorage for save files + Steam
 * Cloud without touching the engine. State is plain JSON (no Sets/Maps), so persistence is trivial.
 */
import type { GameState } from './state';
import { SAVE_VERSION } from './state';

export interface SaveStore {
  load(): GameState | null;
  save(state: GameState): void;
  clear(): void;
}

function valid(s: unknown): s is GameState {
  return !!s && typeof s === 'object' && (s as GameState).version === SAVE_VERSION;
}

export function localStorageStore(key = 'unknown-agent-save'): SaveStore {
  return {
    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return valid(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage unavailable (private window, quota) — the game stays playable, just not saved */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** In-memory store for tests and server rendering. */
export function memoryStore(): SaveStore {
  let held: GameState | null = null;
  return {
    load: () => (held ? structuredClone(held) : null),
    save: (state) => {
      held = structuredClone(state);
    },
    clear: () => {
      held = null;
    },
  };
}
