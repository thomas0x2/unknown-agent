/*
 * doordish.com: food delivery (DoorDash parody). A few local places from the start; a client's
 * restaurant joins the list once its DoorDish feature is deployed, showing what the live site shows
 * (name, hours, menu, with the build's bugs), so the player can check the listing against the spec.
 */
import type { GameStore } from '../game/store';
import { dishListing, type DishListing } from './appsite';
import { ICONS } from './icons';
import { adHtml } from './ads';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

interface Store {
  id: string;
  cuisine: string;
  eta: string;
  fee: string;
  rating: string;
  /** the store's tile: an emoji on a tinted square */
  icon: string;
  hue: number;
  listing: DishListing;
}

/** The places already on DoorDish before day 1. */
const SEED: Store[] = [
  { id: 'golden-lotus', icon: '🥟', hue: 0, cuisine: 'Chinese', eta: '25–35 min', fee: '2.99', rating: '4.6', listing: {
    name: 'Golden Lotus', hours: '11:00–22:00', address: '61 Ferris St', currency: 'DOLR', down: false,
    dishes: [{ name: 'Kung Pao Chicken', price: '13' }, { name: 'Mapo Tofu', price: '11' }, { name: 'Pork Dumplings (8)', price: '9' }, { name: 'Fried Rice', price: '8' }] } },
  { id: 'burger-barn', icon: '🍔', hue: 30, cuisine: 'Burgers', eta: '20–30 min', fee: '1.99', rating: '4.2', listing: {
    name: 'Burger Barn', hours: '11:00–23:00', address: '230 Harbor Rd', currency: 'DOLR', down: false,
    dishes: [{ name: 'Barn Burger', price: '11' }, { name: 'Double Cheese', price: '13' }, { name: 'Fries', price: '4' }, { name: 'Milkshake', price: '5' }] } },
  { id: 'sushi-kaito', icon: '🍣', hue: 200, cuisine: 'Japanese · Sushi', eta: '35–45 min', fee: '3.49', rating: '4.8', listing: {
    name: 'Sushi Kaito', hours: '12:00–21:30', address: '9 Linden Ave', currency: 'DOLR', down: false,
    dishes: [{ name: 'Salmon Nigiri (2)', price: '6' }, { name: 'Spicy Tuna Roll', price: '9' }, { name: 'Chef\'s Platter', price: '28' }, { name: 'Miso Soup', price: '3' }] } },
  { id: 'pita-point', icon: '🥙', hue: 45, cuisine: 'Mediterranean', eta: '25–40 min', fee: '2.49', rating: '4.4', listing: {
    name: 'Pita Point', hours: '10:00–21:00', address: '17 Alder St', currency: 'DOLR', down: false,
    dishes: [{ name: 'Falafel Wrap', price: '9' }, { name: 'Chicken Shawarma Plate', price: '14' }, { name: 'Hummus & Pita', price: '6' }] } },
  { id: 'campus-kitchen', icon: '🥗', hue: 120, cuisine: 'Cafeteria', eta: '50–70 min', fee: '0.99', rating: '3.1', listing: {
    name: 'GeneralAI Campus Kitchen', hours: '07:00–15:00', address: 'Route 9', currency: 'DOLR', down: false,
    dishes: [{ name: 'Nutrient Bowl', price: '7' }, { name: 'Sandwich of the Day', price: '8' }, { name: 'Leftover Catering Tray', price: '15' }] } },
];

/** The client restaurants the player put on DoorDish, newest last. */
function clientStores(store: GameStore): Store[] {
  return store.state.apps.flatMap((a) => {
    const listing = dishListing(a, store.content.apps[a.template]);
    return listing ? [{ id: a.id, icon: '🍕', hue: 10, cuisine: 'Italian · Pizza', eta: '30–40 min', fee: '2.99', rating: 'New', listing }] : [];
  });
}

const tile = (x: Store, cls: string) => `<span class="${cls}" style="--h:${x.hue}" aria-hidden="true">${x.icon}</span>`;

const tag = (l: DishListing) => [l.hours && `Open ${l.hours}`, l.address].filter(Boolean).map(esc).join(' · ');

export function pageDoorDish(store: GameStore, param?: string): string {
  const all = [...clientStores(store), ...SEED];
  const sel = all.find((x) => x.id === param);
  const day = store.state.values.day;
  const head = `<header class="dd-top"><a href="#" class="dd-logo" data-nav="doordish.com"><span class="dd-mark">${ICONS.doordish}</span>DoorDish</a><span class="dd-where">Delivering to <b>your address</b></span></header>`;
  const fine = `<p class="dd-fine">Delivered by DoorDish robot couriers. Couriers are not employees. Fees and ETAs are estimates.</p>`;

  if (sel) {
    const l = sel.listing;
    const menu = l.down
      ? `<div class="dd-err"><p>Couldn't load this store's menu.</p><code>TypeError: Failed to fetch</code></div>`
      : l.dishes.length
        ? `<ul class="dd-menu">${l.dishes.map((d) => `<li><span>${esc(d.name)}</span><b>${d.price ? `${esc(d.price)} ${esc(l.currency)}` : ''}</b></li>`).join('')}</ul>`
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
  return `<div class="dd">${head}<div class="dd-wrap"><h1>Restaurants near you</h1>${adHtml('doordish', day, 'wide')}<div class="dd-list">${cards}</div>${adHtml('doordish', day, 'wide', 1)}</div>${fine}</div>`;
}
