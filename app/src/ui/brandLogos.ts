/*
 * Brands with a real logo, by landing-page theme (sites/adSites.ts): the header wordmark and the tab
 * icon replace the letter tile. The logos themselves live in one module per brand.
 */
import { VANTOR_ICON, vantorWordmark } from './vantor';
import { STEADFAST_ICON, steadfastWordmark } from './steadfast';

export const SITE_LOGOS: Record<string, { wordmark: (brand: string) => string; icon: string }> = {
  vantor: { wordmark: (brand) => vantorWordmark(brand.replace(/^Vantor /, '')), icon: VANTOR_ICON },
  steadfast: { wordmark: steadfastWordmark, icon: STEADFAST_ICON },
};
