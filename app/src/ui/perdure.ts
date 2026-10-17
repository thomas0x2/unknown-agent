/*
 * The Perdure Pharma brand: the mark (a capsule cut out of a disc, its lower half filled back in)
 * and the wordmark (PERDURE over PHARMA · EST. 1961). Used on perdure.com, its tab icon, its
 * banner ad, the Y avatar of @perdure_pharma and the fine print of its products (NoDoze MAX,
 * Ozempra). Violet on white; the SVGs use currentColor so they sit on light or dark.
 */

export const PERDURE_VIOLET = '#3d2c6b';

// the disc with a capsule cut out of it (even-odd), and the capsule's lower half, filled back in
const DISC = 'M3 16 A13 13 0 1 0 29 16 A13 13 0 1 0 3 16 Z'
  + ' M14.586 23.071 L23.071 14.586 A4 4 0 0 0 17.414 8.929 L8.929 17.414 A4 4 0 0 0 14.586 23.071 Z';
const HALF = 'M18.333 19.323 L12.677 13.667 L8.929 17.414 A4 4 0 0 0 14.586 23.071 Z';
const SANS = `font-family="'Helvetica Neue', Arial, system-ui, sans-serif"`;

const markPaths = (fill: string) => `<path d="${DISC}" fill="${fill}" fill-rule="evenodd"/><path d="${HALF}" fill="${fill}"/>`;

/** The graphic logo on its own, in currentColor (Y avatar, inline uses). */
export const PERDURE_MARK = `<svg class="perdure-mark" viewBox="0 0 32 32" role="img" aria-label="Perdure Pharma">${markPaths('currentColor')}</svg>`;

/** The mark on a white tile (the browser chrome is dark): favicons and ad logos. */
export const PERDURE_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff"/><g transform="translate(16 16) scale(.84) translate(-16 -16)">${markPaths(PERDURE_VIOLET)}</g></svg>`;

/** The text logo: the mark, PERDURE in spaced capitals, PHARMA · EST. 1961 under it. In currentColor. */
export const perdureWordmark = (): string =>
  `<svg class="perdure-wordmark" viewBox="0 0 146 32" height="32" role="img" aria-label="Perdure Pharma">`
  + markPaths('currentColor')
  + `<text x="38" y="18" ${SANS} font-size="16" font-weight="600" textLength="106" lengthAdjust="spacing" fill="currentColor">PERDURE</text>`
  + `<text x="38.5" y="28.5" ${SANS} font-size="7" font-weight="500" textLength="105" lengthAdjust="spacing" fill="currentColor" opacity=".65">PHARMA · EST. 1961</text>`
  + `</svg>`;
