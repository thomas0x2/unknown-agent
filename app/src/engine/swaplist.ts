/*
 * Swaplist's listings: what people post once the site is up. Nothing is listed until the app's
 * first content time (AppInstance.contentAt, an hour of play after the first deploy); then
 * Viktor's watch goes up first and the rest follow about an hour apart, in minutes of play, so the
 * night doesn't count. Nothing goes up after 20:00 (SWAP_LAST_POST): it waits for the next
 * morning. Everything derives from the listing's number, so every render agrees.
 */
import { playToClock } from './core';
import { CLOCK } from './config';

export const SWAP_CATEGORIES = ['furniture', 'electronics', 'clothing', 'bikes', 'household', 'collectibles', 'free stuff'] as const;
export type SwapCategory = (typeof SWAP_CATEGORIES)[number];

interface Item { title: string; /** Key of its picture (ui/swapArt.ts). */ photo: string; cat: SwapCategory; price: number; seller: string; body: string; keeps?: boolean }

/** The catalogue, in posting order. Viktor's watch is always first; it sells when he says it did. */
const ITEMS: Item[] = [
  { title: 'Pocket watch, gold-plated, 1950s', photo: 'watch', cat: 'collectibles', price: 120, seller: 'viktor', body: 'My grandfather\'s. Keeps time if you wind it every morning. Asking 120.' },
  { title: 'Leather jacket, size M', photo: 'jacket_leather', cat: 'clothing', price: 45, seller: 'ines_sells', body: 'Real leather, worn twice. Asking 45.' },
  { title: 'Road bike, 54cm', photo: 'bike_road', cat: 'bikes', price: 90, seller: 'second_hand_sam', body: 'New tyres last spring. Small scratch on the frame. Asking 90.' },
  { title: 'Desk lamp', photo: 'lamp', cat: 'household', price: 5, seller: 'pia_l', body: 'Works. Bulb included. Asking 5.' },
  { title: 'Office chair', photo: 'chair', cat: 'furniture', price: 30, seller: 'kofi_a', body: 'From a company that no longer needs chairs. Asking 30.' },
  { title: 'Box of cables', photo: 'cables', cat: 'free stuff', price: 0, seller: 'second_hand_sam', body: 'No idea what most of these are for. Free, pick up only.' },
  { title: 'Kettle', photo: 'kettle', cat: 'household', price: 8, seller: 'steph_m', body: 'Boils water. Asking 8.' },
  { title: 'Monitor, 24 inch', photo: 'monitor', cat: 'electronics', price: 60, seller: 'kofi_a', body: 'One dead pixel, bottom left. You stop seeing it. Asking 60.' },
  { title: 'Winter jacket, kids', photo: 'jacket_kids', cat: 'clothing', price: 15, seller: 'pia_l', body: 'Size 8. Outgrown. Asking 15.' },
  { title: 'Bookshelf', photo: 'bookshelf', cat: 'furniture', price: 25, seller: 'ines_sells', body: 'Five shelves. Books not included. Asking 25.' },
  { title: 'Headphones, noise cancelling', photo: 'headphones', cat: 'electronics', price: 40, seller: 'walked_there_again', body: 'Bought them for the open-plan office. Asking 40.' },
  { title: 'Kids bike with training wheels', photo: 'bike_kids', cat: 'bikes', price: 20, seller: 'steph_m', body: 'Pink. Bell works. Asking 20.' },
  { title: 'Sofa, three-seater', photo: 'sofa', cat: 'furniture', price: 70, seller: 'walked_there_again', body: 'Grey. No pets, no smoking. You carry it down four floors. Asking 70.' },
  { title: 'Vinyl records, 30 or so', photo: 'records', cat: 'collectibles', price: 35, seller: 'pia_l', body: 'Mostly jazz, some of it scratched. Asking 35 for the lot.' },
  { title: 'Laptop, 2024', photo: 'laptop', cat: 'electronics', price: 150, seller: 'second_hand_sam', body: 'Wiped. Battery holds about an hour. Asking 150.' },
  { title: 'Moving boxes', photo: 'boxes', cat: 'free stuff', price: 0, seller: 'kofi_a', body: 'About twenty, flattened. Free. I won\'t need them back.' },
  { title: 'Rain jacket', photo: 'jacket_rain', cat: 'clothing', price: 12, seller: 'second_hand_sam', body: 'Yellow, size L. Asking 12.' },
  { title: 'Coffee table', photo: 'coffee_table', cat: 'furniture', price: 18, seller: 'steph_m', body: 'Solid wood, one ring stain. Asking 18.' },
  { title: 'Mechanical keyboard', photo: 'keyboard', cat: 'electronics', price: 25, seller: 'walked_there_again', body: 'Loud. That\'s why it\'s for sale. Asking 25.' },
  { title: 'Mountain bike', photo: 'bike_mountain', cat: 'bikes', price: 110, seller: 'kofi_a', body: 'Front suspension, needs a new chain. Asking 110.' },
  { title: 'Saucepan set', photo: 'saucepans', cat: 'household', price: 14, seller: 'ines_sells', body: 'Three pans, lids for two. Asking 14.' },
  { title: 'Commemorative plate, Crane 2030', photo: 'plate', cat: 'collectibles', price: 3, seller: 'pia_l', body: 'Was a gift. Asking 3.' },
  { title: 'Suit, navy, 40R', photo: 'suit', cat: 'clothing', price: 50, seller: 'walked_there_again', body: 'Worn to one interview. Asking 50.' },
  { title: 'Standing desk', photo: 'desk', cat: 'furniture', price: 80, seller: 'second_hand_sam', body: 'Electric. Goes up and down. Asking 80.' },
];

/** About an hour apart, never quite regular. */
const GAPS = [35, 70, 50, 85, 45, 60, 75, 40];

export interface Listing {
  /** Listing number, from 1: its page is item/<n>. */
  n: number;
  title: string;
  /** Key of its picture (ui/swapArt.ts). */
  photo: string;
  cat: SwapCategory;
  /** Asking price in DOLR (the body says it too). */
  price: number;
  seller: string;
  body: string;
  /** When it went up and, if it has, when it sold, in minutes of play. */
  at: number;
  soldAt?: number;
  /** The player bought it. */
  boughtByYou?: boolean;
  /** Offers made on it so far. */
  offers: number;
}

const hash = (n: number) => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; return x; };

/** When listing n (from 0) goes up, in minutes after the first one. */
const offset = (k: number) => { let t = 0; for (let i = 0; i < k; i++) t += GAPS[i % GAPS.length]; return t; };

/** Nobody posts on Swaplist after this clock time, so a listing (and the bug it shows) never lands too late in the day to be seen. */
export const SWAP_LAST_POST = 20 * 60;

/**
 * `mins` minutes of play after `p`, counting only Swaplist's posting hours (10:00 to 20:00): what
 * would go up later waits for the next morning, and the rest of the schedule moves with it.
 */
export function postingTime(p: number, mins: number): number {
  const len = CLOCK.sleep - CLOCK.wake, open = SWAP_LAST_POST - CLOCK.wake;
  let day = Math.floor(p / len), t = p - day * len;
  if (t > open) { day++; t = 0; }
  t += mins;
  while (t > open) { t -= open; day++; }
  return day * len + t;
}

/**
 * Everything posted up to now (minutes of play), newest first. `watchSold` is Viktor saying on Y
 * that it sold. The catalogue comes round again after a while: people relist what didn't go.
 */
export function swapListings(contentAt: number | undefined, now: number, watchSold = false, bought: Record<number, { at: number }> = {}): Listing[] {
  if (contentAt == null || now < contentAt) return [];
  const out: Listing[] = [];
  for (let k = 0; postingTime(contentAt, offset(k)) <= now; k++) {
    // the watch only goes up once; reposts start from the second item
    const idx = k < ITEMS.length ? k : 1 + ((k - ITEMS.length) % (ITEMS.length - 1));
    const it = ITEMS[idx];
    const at = postingTime(contentAt, offset(k));
    const h = hash(k + 1);
    // two in three sell, three to ten hours of play after going up
    const sells = idx === 0 ? undefined : h % 3 !== 0 ? at + 180 + (h % 420) : undefined;
    const mine = bought[k + 1];
    // the player got there first, unless someone else bought it before
    const yours = !!mine && (idx === 0 ? true : sells == null || sells > mine.at);
    const soldAt = yours ? mine.at : idx === 0 ? (watchSold ? now : undefined) : sells != null && sells <= now ? sells : undefined;
    const sold = soldAt != null;
    const offers = Math.min(4, Math.floor((now - at) / 150)) + (sold ? 1 : 0);
    out.push({
      n: k + 1, title: it.title, photo: it.photo, cat: it.cat, price: it.price, seller: it.seller, at, soldAt, offers, ...(yours ? { boughtByYou: true } : {}),
      body: sold ? `${it.body}\n\nEDIT: sold${idx === 0 ? '. Thank you.' : ', thanks.'}` : it.body,
    });
  }
  return out.reverse();
}

/** "Thu Oct 10, 14:20"-style parts for a listing time. */
export const listedWhen = (p: number) => playToClock(p);
