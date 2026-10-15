import { createContext, useContext, useSyncExternalStore } from 'react';
import type { GameStore } from './store';

export const StoreContext = createContext<GameStore | null>(null);

export function useGame(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error('GameStore missing from context');
  useSyncExternalStore(store.subscribe, store.getSnapshot);
  return store;
}
