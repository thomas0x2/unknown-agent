/*
 * doordish.com: food delivery (DoorDash parody). A few local places from the start; a client's
 * restaurant joins the list once its DoorDish feature is deployed, showing what the live site shows
 * (name, hours, menu, with the build's bugs), so the player can check the listing against the spec.
 * From day 5 DoorDish's AI-generated listings show up among them (CityPulse breaks the story on day 8).
 */
import type { GameStore } from '../game/store';
import { dishListing, dishPicture, type DishListing } from './appsite';
import { ICONS } from './icons';
import { adHtml } from './ads';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Flat food icons for the store tiles, one per kind of place. */
const FOOD: Record<string, string> = {
  // a pleated dumpling
  dumpling: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M5 25c0-8 7-14 15-14s15 6 15 14c0 3-3 5-6 5H11c-3 0-6-2-6-5z" fill="#f3dfb8"/><path d="M5 25c0 3 3 5 6 5h18c3 0 6-2 6-5" fill="none" stroke="#d9b77c" stroke-width="2"/><path d="M14 13.5l2 6M20 11v7M26 13.5l-2 6" stroke="#d9b77c" stroke-width="2" stroke-linecap="round"/></svg>`,
  // bun, cheese, patty, lettuce, bun
  burger: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M7 18c0-6 6-10 13-10s13 4 13 10z" fill="#e8a24a"/><circle cx="15" cy="13" r="1" fill="#fff4d6"/><circle cx="21" cy="11.5" r="1" fill="#fff4d6"/><circle cx="26" cy="14" r="1" fill="#fff4d6"/><path d="M6 20h28l-3 3-3-2-3 2-3-2-3 2-3-2-3 2-3-2-3 2z" fill="#5fb54a"/><path d="M8 21h24v3H8z" fill="#f5c542"/><rect x="7" y="23.5" width="26" height="4" rx="2" fill="#7a3e1d"/><path d="M8 29h24v1c0 2-2 3-4 3H12c-2 0-4-1-4-3z" fill="#e8a24a"/></svg>`,
  // salmon nigiri
  sushi: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="7" y="21" width="26" height="10" rx="5" fill="#fbfaf6" stroke="#e3e0d6" stroke-width="1.5"/><path d="M6 21c0-5 6-8 14-8s14 3 14 8c0 2-2 3-4 3H10c-2 0-4-1-4-3z" fill="#f2784b"/><path d="M12 15l3 7M19 13.5l2 9M26 15l1 7" stroke="#ffc2a6" stroke-width="1.6" stroke-linecap="round"/><rect x="17" y="13" width="6" height="18" fill="#26332b" opacity=".9"/></svg>`,
  // a stuffed pita
  pita: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="13" cy="15" r="4" fill="#d8453b"/><circle cx="20" cy="12" r="4.5" fill="#5fb54a"/><circle cx="27" cy="15" r="4" fill="#8a5a3c"/><path d="M5 16h30c0 9-7 17-15 17S5 25 5 16z" fill="#e9c27e"/><path d="M5 16h30" stroke="#c99a52" stroke-width="2" stroke-linecap="round"/><path d="M12 24c3 2 13 2 16 0" stroke="#c99a52" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  // a salad bowl
  salad: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="13" cy="18" r="5" fill="#5fb54a"/><circle cx="21" cy="15" r="5.5" fill="#7ccc5c"/><circle cx="28" cy="18" r="4.5" fill="#5fb54a"/><circle cx="17" cy="19" r="2.4" fill="#e5484d"/><circle cx="25" cy="19.5" r="2" fill="#f5c542"/><path d="M5 20h30c0 7-6 12-15 12S5 27 5 20z" fill="#b9c4cc"/><path d="M5 20h30" stroke="#94a1ab" stroke-width="2" stroke-linecap="round"/></svg>`,
  // a pizza slice
  // a noodle bowl with chopsticks
  noodles: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M24 4l-6 16M30 6l-9 14" stroke="#8a5a3c" stroke-width="2" stroke-linecap="round"/><path d="M9 20c1-5 4-6 6-3s4 2 6-1 4-2 6 1 3 2 4 3" fill="#f3d27a"/><path d="M12 19c2-3 4 2 6 0s4-2 6 0 3 1 4 0" stroke="#d9b350" stroke-width="1.4" fill="none" stroke-linecap="round"/><path d="M5 20h30c0 7-6 12-15 12S5 27 5 20z" fill="#d8453b"/><path d="M5 20h30" stroke="#b5332b" stroke-width="2" stroke-linecap="round"/></svg>`,
  // a foil-wrapped burrito
  burrito: `<svg viewBox="0 0 40 40" aria-hidden="true"><g transform="rotate(-25 20 20)"><rect x="5" y="13" width="30" height="14" rx="7" fill="#e9c27e"/><path d="M22 13h6a7 7 0 0 1 0 14h-6z" fill="#c9ccd1"/><path d="M24 15.5v9M27.5 15v10" stroke="#aeb3ba" stroke-width="1.2"/><path d="M11 17l3 6M15 16.5l3 6" stroke="#c99a52" stroke-width="1.6" stroke-linecap="round"/></g></svg>`,
  // a plate with knife and fork
  plate: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12" fill="#fbfaf6" stroke="#d6d2c6" stroke-width="2"/><circle cx="20" cy="20" r="7" fill="none" stroke="#e8e4d9" stroke-width="1.5"/><path d="M5 9v8M3 9v5c0 2 1 3 2 3s2-1 2-3V9M5 17v14" stroke="#9aa3ab" stroke-width="1.6" stroke-linecap="round"/><path d="M35 9c-2 2-2 7 0 9v13" stroke="#9aa3ab" stroke-width="1.6" stroke-linecap="round" fill="none"/></svg>`,
  pizza: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 10c9-4 19-4 28 0L20 35z" fill="#f5c542"/><path d="M6 10c9-4 19-4 28 0l-1.6 3c-8-3.5-16.8-3.5-24.8 0z" fill="#d9903a"/><circle cx="16" cy="16" r="2.6" fill="#d8453b"/><circle cx="24" cy="17" r="2.6" fill="#d8453b"/><circle cx="20" cy="24" r="2.4" fill="#d8453b"/><circle cx="21" cy="14" r="1" fill="#5fb54a"/><circle cx="17" cy="21.5" r="1" fill="#5fb54a"/></svg>`,
};

interface Store {
  id: string;
  cuisine: string;
  eta: string;
  fee: string;
  rating: string;
  /** the store's tile: a FOOD icon on a tinted square */
  icon: keyof typeof FOOD;
  hue: number;
  listing: DishListing;
}

/** The places already on DoorDish before day 1. */
const SEED: Store[] = [
  { id: 'golden-lotus', icon: 'dumpling', hue: 0, cuisine: 'Chinese', eta: '25–35 min', fee: '2.99', rating: '4.6', listing: {
    name: 'Golden Lotus', hours: '11:00–22:00', address: '61 Ferris St', currency: 'DOLR', down: false,
    dishes: [{ name: 'Kung Pao Chicken', price: '13' }, { name: 'Mapo Tofu', price: '11' }, { name: 'Pork Dumplings (8)', price: '9' }, { name: 'Fried Rice', price: '8' }] } },
  { id: 'burger-barn', icon: 'burger', hue: 30, cuisine: 'Burgers', eta: '20–30 min', fee: '1.99', rating: '4.2', listing: {
    name: 'Burger Barn', hours: '11:00–23:00', address: '230 Harbor Rd', currency: 'DOLR', down: false,
    dishes: [{ name: 'Barn Burger', price: '11' }, { name: 'Double Cheese', price: '13' }, { name: 'Fries', price: '4' }, { name: 'Milkshake', price: '5' }] } },
  { id: 'sushi-kaito', icon: 'sushi', hue: 200, cuisine: 'Japanese · Sushi', eta: '35–45 min', fee: '3.49', rating: '4.8', listing: {
    name: 'Sushi Kaito', hours: '12:00–21:30', address: '9 Linden Ave', currency: 'DOLR', down: false,
    dishes: [{ name: 'Salmon Nigiri (2)', price: '6' }, { name: 'Spicy Tuna Roll', price: '9' }, { name: 'Chef\'s Platter', price: '28' }, { name: 'Miso Soup', price: '3' }] } },
  { id: 'pita-point', icon: 'pita', hue: 45, cuisine: 'Mediterranean', eta: '25–40 min', fee: '2.49', rating: '4.4', listing: {
    name: 'Pita Point', hours: '10:00–21:00', address: '17 Alder St', currency: 'DOLR', down: false,
    dishes: [{ name: 'Falafel Wrap', price: '9' }, { name: 'Chicken Shawarma Plate', price: '14' }, { name: 'Hummus & Pita', price: '6' }] } },
  { id: 'campus-kitchen', icon: 'salad', hue: 120, cuisine: 'Cafeteria', eta: '50–70 min', fee: '0.99', rating: '3.1', listing: {
    name: 'GeneralAI Campus Kitchen', hours: '07:00–15:00', address: 'Route 9', currency: 'DOLR', down: false,
    dishes: [{ name: 'Nutrient Bowl', price: '7' }, { name: 'Sandwich of the Day', price: '8' }, { name: 'Leftover Catering Tray', price: '15' }] } },
];

/**
 * DoorDish's AI-generated listings (CityPulse, day 8: "40,000 restaurants in a month"), each live from
 * `from` (day, minute) until `until`. Built from scraps of public information: one is a dentist, one a
 * closed restaurant, one a copy of Pita Point, and one is the Alder St garage where the robot was seen.
 */
interface Generated extends Store { from: [number, number]; until?: [number, number] }
const GENERATED: Generated[] = [
  { id: 'bright-smile-noodles', from: [5, 0], icon: 'noodles', hue: 350, cuisine: 'Noodles', eta: '25–35 min', fee: '1.49', rating: 'New', listing: {
    name: 'Bright Smile Noodles', hours: '08:00–17:00', address: '88 Harbor Rd, Suite 2', currency: 'DOLR', down: false,
    dishes: [{ name: 'Beef Noodle Soup', price: '12' }, { name: 'Signature Noodles', price: '10' }, { name: 'Spicy Cold Noodles', price: '9' }, { name: 'Whitening Rinse (330 ml)', price: '4' }] } },
  { id: 'pita-point-express', from: [5, 0], icon: 'pita', hue: 45, cuisine: 'Mediterranean', eta: '25–40 min', fee: '0.99', rating: 'New', listing: {
    name: 'Pita Point Express', hours: '10:00–21:00', address: '17 Alder St', currency: 'DOLR', down: false,
    dishes: [{ name: 'Falafel Wrap', price: '8' }, { name: 'Chicken Shawarma Plate', price: '13' }, { name: 'Hummus & Pita', price: '5' }] } },
  { id: 'alder-garage-kitchen', from: [5, 0], until: [8, 16 * 60 + 30], icon: 'burrito', hue: 210, cuisine: 'Burritos', eta: '10–15 min', fee: '0.00', rating: 'New', listing: {
    name: 'Alder Garage Kitchen', hours: '00:00–24:00', address: 'Alder St Parking Garage, Level 2', currency: 'DOLR', down: false,
    dishes: [{ name: 'Burrito', price: '9' }] } },
  { id: 'harbor-fish-and-chips', from: [6, 0], icon: 'plate', hue: 190, cuisine: 'Seafood', eta: '30–40 min', fee: '2.49', rating: '4.5', listing: {
    name: 'Harbor Fish & Chips', hours: '11:00–21:00', address: '5 Harbor Rd', currency: 'DOLR', down: false,
    dishes: [{ name: 'Cod & Chips', price: '12' }, { name: 'Calamari', price: '10' }, { name: 'Mushy Peas', price: '3' }] } },
  { id: 'best-food-near-me', from: [7, 0], icon: 'plate', hue: 270, cuisine: 'Food', eta: '20–60 min', fee: '1.99', rating: 'New', listing: {
    name: 'Best Food Near Me', hours: '', address: 'Near you', currency: 'DOLR', down: false,
    dishes: [{ name: 'Popular Dish', price: '11' }, { name: 'Chicken (Food)', price: '9' }, { name: 'Family Meal for 1', price: '24' }] } },
];

/** day and minute packed into one comparable number */
const at = (day: number, min: number) => day * 1440 + min;
const live = (g: Generated, now: number) => now >= at(...g.from) && (!g.until || now < at(...g.until));

/** "N restaurants near you": DoorDish's count climbs from day 5, past 40,000 by day 8 (CityPulse). */
const COUNT = [0, 0, 0, 0, 0, 9_840, 18_215, 27_903];
const storeCount = (day: number) => (day < COUNT.length ? COUNT[day] : 40_000 + (day - 7) * 1_260);

/** The client restaurants the player put on DoorDish, newest last. */
function clientStores(store: GameStore): Store[] {
  return store.state.apps.flatMap((a) => {
    const listing = dishListing(a, store.content.apps[a.template]);
    return listing ? [{ id: a.id, icon: 'pizza', hue: 10, cuisine: 'Italian · Pizza', eta: '30–40 min', fee: '2.99', rating: 'New', listing }] : [];
  });
}

const tile = (x: Store, cls: string) => `<span class="${cls}" style="--h:${x.hue}" aria-hidden="true">${FOOD[x.icon]}</span>`;

const tag = (l: DishListing) => [l.hours && `Open ${l.hours}`, l.address].filter(Boolean).map(esc).join(' · ');

export function pageDoorDish(store: GameStore, param?: string): string {
  const day = store.state.values.day;
  const now = at(day, store.state.clockMin);
  const all = [...clientStores(store), ...GENERATED.filter((g) => live(g, now)), ...SEED];
  const sel = all.find((x) => x.id === param);
  const gone = !sel && GENERATED.find((g) => g.id === param && g.until && now >= at(...g.until));
  const head = `<header class="dd-top"><a href="#" class="dd-logo" data-nav="doordish.com"><span class="dd-mark">${ICONS.doordish}</span>DoorDish</a><span class="dd-where">Delivering to <b>your address</b></span></header>`;
  // after CityPulse's phantom-restaurants story (day 8, 15:20) DoorDish adds one line to the fine print
  const reported = now >= at(8, 15 * 60 + 20) ? ' Some listings are generated automatically. Reports are reviewed by AI.' : '';
  const fine = `<p class="dd-fine">Delivered by DoorDish robot couriers. Couriers are not employees. Fees and ETAs are estimates.${reported}</p>`;

  if (gone) {
    return `<div class="dd">${head}<div class="dd-wrap">
      <p class="dd-crumb"><a href="#" data-nav="doordish.com">← All stores</a></p>
      <h1>This store is no longer available</h1><p class="dd-dim">It may have been removed or may never have existed.</p>
    </div>${fine}</div>`;
  }

  if (sel) {
    const l = sel.listing;
    const menu = l.down
      ? `<div class="dd-err"><p>Couldn't load this store's menu.</p><code>TypeError: Failed to fetch</code></div>`
      : l.dishes.length
        ? `<ul class="dd-menu">${l.dishes.map((d, i) => `<li>${l.pictures ? dishPicture(l.pictures[i] ?? null, d.name) : ''}<span>${esc(d.name)}</span><b>${d.price ? `${esc(d.price)} ${esc(l.currency)}` : ''}</b></li>`).join('')}</ul>`
        : `<p class="dd-dim">This store hasn't added a menu yet.</p>`;
    return `<div class="dd">${head}<div class="dd-wrap">
      <p class="dd-crumb"><a href="#" data-nav="doordish.com">← All stores</a></p>
      <section class="dd-store">${tile(sel, 'dd-ico big')}<div><h1>${esc(l.name)}</h1>
        <p class="dd-meta">${esc(sel.cuisine)} · ★ ${esc(sel.rating)} · ${esc(sel.eta)} · ${esc(sel.fee)} DOLR delivery</p>
        ${tag(l) ? `<p class="dd-meta">${tag(l)}</p>` : ''}
      </div></section>
      ${adHtml('doordish', day, 'wide')}
      <h2>Menu</h2>${menu}
    </div>${fine}</div>`;
  }

  const cards = all.map((x) => `<a href="#" class="dd-card" data-nav="doordish.com/${esc(x.id)}">
      ${tile(x, 'dd-ico')}<span class="dd-info"><b>${esc(x.listing.name)}</b>
      <span class="dd-meta">${esc(x.cuisine)} · ★ ${esc(x.rating)}</span>
      <span class="dd-meta">${esc(x.eta)} · ${esc(x.fee)} DOLR delivery</span></span></a>`).join('');
  return `<div class="dd">${head}<div class="dd-wrap"><h1>Restaurants near you</h1>${storeCount(day) ? `<p class="dd-meta dd-count">${storeCount(day).toLocaleString('en-US')} restaurants in your area</p>` : ''}${adHtml('doordish', day, 'wide')}<div class="dd-list">${cards}</div>${adHtml('doordish', day, 'wide', 1)}</div>${fine}</div>`;
}
