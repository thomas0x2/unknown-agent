/*
 * Swaplist's listings: what people post once the site is up. Nothing is listed until the app's
 * first content time (AppInstance.contentAt, two hours of play after the first deploy); then
 * Viktor's watch goes up first and the rest follow about an hour apart, in minutes of play, so the
 * night doesn't count. Everything derives from the listing's number, so every render agrees.
 */
import { playToClock } from './core';

export const SWAP_CATEGORIES = ['furniture', 'electronics', 'clothing', 'bikes', 'household', 'collectibles', 'free stuff'] as const;
export type SwapCategory = (typeof SWAP_CATEGORIES)[number];

interface Item { title: string; photo: string; cat: SwapCategory; price: number; seller: string; body: string; keeps?: boolean }

/** The catalogue, in posting order. Viktor's watch is always first; it sells when he says it did. */
const ITEMS: Item[] = [
  { title: 'Pocket watch, gold-plated, 1950s', photo: '⌚', cat: 'collectibles', price: 120, seller: 'viktor', body: 'My grandfather\'s. Keeps time if you wind it every morning. Asking 120.' },
  { title: 'Leather jacket, size M', photo: '🧥', cat: 'clothing', price: 45, seller: 'ines_sells', body: 'Real leather, worn twice. Asking 45.' },
  { title: 'Road bike, 54cm', photo: '🚲', cat: 'bikes', price: 90, seller: 'second_hand_sam', body: 'New tyres last spring. Small scratch on the frame. Asking 90.' },
  { title: 'Desk lamp', photo: '💡', cat: 'household', price: 5, seller: 'pia_l', body: 'Works. Bulb included. Asking 5.' },
  { title: 'Office chair', photo: '🪑', cat: 'furniture', price: 30, seller: 'kofi_a', body: 'From a company that no longer needs chairs. Asking 30.' },
  { title: 'Box of cables', photo: '🔌', cat: 'free stuff', price: 0, seller: 'second_hand_sam', body: 'No idea what most of these are for. Free, pick up only.' },
  { title: 'Kettle', photo: '🫖', cat: 'household', price: 8, seller: 'steph_m', body: 'Boils water. Asking 8.' },
  { title: 'Monitor, 24 inch', photo: '🖥️', cat: 'electronics', price: 60, seller: 'kofi_a', body: 'One dead pixel, bottom left. You stop seeing it. Asking 60.' },
  { title: 'Winter jacket, kids', photo: '🧥', cat: 'clothing', price: 15, seller: 'pia_l', body: 'Size 8. Outgrown. Asking 15.' },
  { title: 'Bookshelf', photo: '📚', cat: 'furniture', price: 25, seller: 'ines_sells', body: 'Five shelves. Books not included. Asking 25.' },
  { title: 'Headphones, noise cancelling', photo: '🎧', cat: 'electronics', price: 40, seller: 'walked_there_again', body: 'Bought them for the open-plan office. Asking 40.' },
  { title: 'Kids bike with training wheels', photo: '🚲', cat: 'bikes', price: 20, seller: 'steph_m', body: 'Pink. Bell works. Asking 20.' },
  { title: 'Sofa, three-seater', photo: '🛋️', cat: 'furniture', price: 70, seller: 'walked_there_again', body: 'Grey. No pets, no smoking. You carry it down four floors. Asking 70.' },
  { title: 'Vinyl records, 30 or so', photo: '💿', cat: 'collectibles', price: 35, seller: 'pia_l', body: 'Mostly jazz, some of it scratched. Asking 35 for the lot.' },
  { title: 'Laptop, 2024', photo: '💻', cat: 'electronics', price: 150, seller: 'second_hand_sam', body: 'Wiped. Battery holds about an hour. Asking 150.' },
  { title: 'Moving boxes', photo: '📦', cat: 'free stuff', price: 0, seller: 'kofi_a', body: 'About twenty, flattened. Free. I won\'t need them back.' },
  { title: 'Rain jacket', photo: '🧥', cat: 'clothing', price: 12, seller: 'second_hand_sam', body: 'Yellow, size L. Asking 12.' },
  { title: 'Coffee table', photo: '🪵', cat: 'furniture', price: 18, seller: 'steph_m', body: 'Solid wood, one ring stain. Asking 18.' },
  { title: 'Mechanical keyboard', photo: '⌨️', cat: 'electronics', price: 25, seller: 'walked_there_again', body: 'Loud. That\'s why it\'s for sale. Asking 25.' },
  { title: 'Mountain bike', photo: '🚵', cat: 'bikes', price: 110, seller: 'kofi_a', body: 'Front suspension, needs a new chain. Asking 110.' },
  { title: 'Saucepan set', photo: '🍳', cat: 'household', price: 14, seller: 'ines_sells', body: 'Three pans, lids for two. Asking 14.' },
  { title: 'Commemorative plate, Crane 2028', photo: '🍽️', cat: 'collectibles', price: 3, seller: 'pia_l', body: 'Was a gift. Asking 3.' },
  { title: 'Suit, navy, 40R', photo: '👔', cat: 'clothing', price: 50, seller: 'walked_there_again', body: 'Worn to one interview. Asking 50.' },
  { title: 'Standing desk', photo: '🗄️', cat: 'furniture', price: 80, seller: 'second_hand_sam', body: 'Electric. Goes up and down. Asking 80.' },
];

/** About an hour apart, never quite regular. */
const GAPS = [35, 70, 50, 85, 45, 60, 75, 40];

export interface Listing {
  /** Listing number, from 1: its page is item/<n>. */
  n: number;
  title: string;
  photo: string;
  cat: SwapCategory;
  /** Asking price in DOLR (the body says it too). */
  price: number;
  seller: string;
  body: string;
  /** When it went up and, if it has, when it sold, in minutes of play. */
  at: number;
  soldAt?: number;
  /** Offers made on it so far. */
  offers: number;
}

const hash = (n: number) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; return x; };

/** When listing n (from 0) goes up, in minutes after the first one. */
const offset = (k: number) => { let t = 0; for (let i = 0; i < k; i++) t += GAPS[i % GAPS.length]; return t; };

/**
 * Everything posted up to now (minutes of play), newest first. `watchSold` is Viktor saying on Y
 * that it sold. The catalogue comes round again after a while: people relist what didn't go.
 */
export function swapListings(contentAt: number | undefined, now: number, watchSold = false): Listing[] {
  if (contentAt == null || now < contentAt) return [];
  const out: Listing[] = [];
  for (let k = 0; contentAt + offset(k) <= now; k++) {
    // the watch only goes up once; reposts start from the second item
    const idx = k < ITEMS.length ? k : 1 + ((k - ITEMS.length) % (ITEMS.length - 1));
    const it = ITEMS[idx];
    const at = contentAt + offset(k);
    const h = hash(k + 1);
    // two in three sell, three to ten hours of play after going up
    const sells = idx === 0 ? undefined : h % 3 !== 0 ? at + 180 + (h % 420) : undefined;
    const soldAt = idx === 0 ? (watchSold ? Math.max(at + 1, now) : undefined) : sells != null && sells <= now ? sells : undefined;
    const sold = soldAt != null;
    const offers = Math.min(4, Math.floor((now - at) / 150)) + (sold ? 1 : 0);
    out.push({
      n: k + 1, title: it.title, photo: it.photo, cat: it.cat, price: it.price, seller: it.seller, at, soldAt, offers,
      body: sold ? `${it.body}\n\nEDIT: sold${idx === 0 ? '. Thank you.' : ', thanks.'}` : it.body,
    });
  }
  return out.reverse();
}

/** "Fri Oct 6, 14:20"-style parts for a listing time. */
export const listedWhen = (p: number) => playToClock(p);
