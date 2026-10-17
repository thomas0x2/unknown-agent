/*
 * Trattoria's AI-generated dish pictures: glossy, evenly lit, a little too perfect. One per kind of
 * dish (engine/restaurant.ts dishKind); the fork on the lasagne has five tines.
 */
import type { DishKind } from '../engine/restaurant';

const frame = (id: string, a: string, b: string, inner: string) =>
  `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><radialGradient id="dish-bg-${id}" cx="35%" cy="25%" r="85%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>` +
  `<linearGradient id="dish-gloss-${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
  `<rect width="64" height="64" rx="8" fill="url(#dish-bg-${id})"/>${inner}<rect width="64" height="64" rx="8" fill="url(#dish-gloss-${id})"/></svg>`;

const ART: Record<DishKind, string> = {
  // a whole pizza from above, every basil leaf the same size
  pizza: frame('pizza', '#f6e3c4', '#b98a5c', `<circle cx="32" cy="34" r="22" fill="#d9903a"/><circle cx="32" cy="34" r="18.5" fill="#d8453b"/>` +
    `<circle cx="25" cy="28" r="4" fill="#fff4dc"/><circle cx="39" cy="30" r="4" fill="#fff4dc"/><circle cx="30" cy="41" r="4" fill="#fff4dc"/><circle cx="41" cy="41" r="3.5" fill="#fff4dc"/>` +
    `<ellipse cx="32" cy="34" rx="2.6" ry="1.6" fill="#3f9a3a"/><ellipse cx="22" cy="37" rx="2.6" ry="1.6" fill="#3f9a3a"/><ellipse cx="36" cy="24" rx="2.6" ry="1.6" fill="#3f9a3a"/>`),
  // a slab of lasagne beside a fork with five tines
  pasta: frame('pasta', '#f3e6d2', '#a9845e', `<ellipse cx="30" cy="44" rx="22" ry="8" fill="#fbfaf6"/>` +
    `<path d="M14 26l26-4 4 16-26 4z" fill="#e9b45c"/><path d="M14 31l27-4M15 36l27-4" stroke="#c2412f" stroke-width="2.5"/><path d="M14 26l26-4 2 3-26 4z" fill="#f2d07c"/>` +
    `<path d="M50 14v30" stroke="#b8c0c7" stroke-width="2.4" stroke-linecap="round"/><path d="M46 12v8M48 12v8M50 12v8M52 12v8M54 12v8" stroke="#b8c0c7" stroke-width="1.2" stroke-linecap="round"/><path d="M46 20h8" stroke="#b8c0c7" stroke-width="2"/>`),
  // tiramisu in layers, cocoa on top
  dessert: frame('dessert', '#f4e8dc', '#9c7a62', `<ellipse cx="32" cy="46" rx="20" ry="6" fill="#fbfaf6"/>` +
    `<path d="M17 24h30v18H17z" fill="#f7ecd6"/><path d="M17 29h30v4H17zM17 37h30v4H17z" fill="#7a4a2a"/><path d="M17 22h30v4H17z" fill="#6b3d22"/>` +
    `<circle cx="24" cy="23" r=".8" fill="#4a2a16"/><circle cx="33" cy="22.5" r=".8" fill="#4a2a16"/><circle cx="41" cy="23.5" r=".8" fill="#4a2a16"/>`),
  // an espresso cup with a perfect crema
  coffee: frame('coffee', '#efe2d4', '#7d5c46', `<ellipse cx="32" cy="46" rx="18" ry="5" fill="#fbfaf6"/>` +
    `<path d="M20 26h22v10c0 6-5 10-11 10s-11-4-11-10z" fill="#fbfaf6"/><path d="M42 29c5 0 6 6 0 7" stroke="#fbfaf6" stroke-width="3" fill="none"/>` +
    `<ellipse cx="31" cy="26" rx="11" ry="3" fill="#b7793f"/><ellipse cx="31" cy="26" rx="6" ry="1.4" fill="#d39a5c"/>` +
    `<path d="M27 20c-2-3 2-4 0-7M34 20c-2-3 2-4 0-7" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" fill="none" stroke-linecap="round"/>`),
  // tomato, mozzarella and basil in a perfect circle
  salad: frame('salad', '#eef2e4', '#7c9a6a', `<ellipse cx="32" cy="36" rx="22" ry="16" fill="#fbfaf6"/>` +
    `<circle cx="22" cy="34" r="5" fill="#d8453b"/><circle cx="32" cy="30" r="5" fill="#fff4dc"/><circle cx="42" cy="34" r="5" fill="#d8453b"/><circle cx="27" cy="41" r="5" fill="#fff4dc"/><circle cx="37" cy="41" r="5" fill="#d8453b"/>` +
    `<ellipse cx="32" cy="36" rx="3" ry="1.8" fill="#3f9a3a"/>`),
  // a plate with something on it, hard to say what
  plate: frame('plate', '#ece7df', '#8d8478', `<ellipse cx="32" cy="38" rx="22" ry="12" fill="#fbfaf6"/><ellipse cx="32" cy="38" rx="14" ry="7" fill="none" stroke="#e5e0d4"/>` +
    `<path d="M24 37c3-6 13-6 16 0-3 3-13 3-16 0z" fill="#b26b3a"/><ellipse cx="33" cy="34" rx="3" ry="1.5" fill="#3f9a3a"/>`),
};

export const dishArt = (kind: DishKind): string => ART[kind];
