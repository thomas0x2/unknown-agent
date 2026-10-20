/*
 * Brands with a real logo, by landing-page theme (sites/adSites.ts): the header wordmark and the tab
 * icon replace the letter tile. The logos themselves live in one module per brand.
 */
import { VANTOR_ICON, vantorWordmark } from './vantor';
import { PERDURE_ICON, perdureWordmark } from './perdure';

export const SITE_LOGOS: Record<string, { wordmark: (brand: string) => string; icon: string }> = {
  vantor: { wordmark: (brand) => vantorWordmark(brand.replace(/^Vantor /, '')), icon: VANTOR_ICON },
  perdure: { wordmark: perdureWordmark, icon: PERDURE_ICON },
};
