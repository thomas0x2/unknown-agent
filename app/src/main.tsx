import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import App from './App';
import { StoreContext } from './game/useGame';
import { GameStore } from './game/store';
import { loadContent } from './content/load';
import { offlineJev, localStorageStore } from './engine';
import { BackendJev } from './game/backendJev';

const content = loadContent();
// Use the backend Jev proxy when it's reachable; fall back to the offline keyword router otherwise.
const router = new BackendJev(offlineJev);
const store = new GameStore(content, router, localStorageStore());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreContext.Provider value={store}>
      <App />
    </StoreContext.Provider>
  </StrictMode>,
);
