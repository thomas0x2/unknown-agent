/*
 * The Steadfast Mutual brand: the mark (a fluted column cut out of a shield) and the wordmark
 * (STEADFAST in serif capitals over MUTUAL · EST. 1952). Used on steadfast.insure, its tab icon and
 * its banner ad. Navy on white; the SVGs use currentColor so they sit on light or dark.
 */

export const STEADFAST_NAVY = '#13314d';

// one path, even-odd: the shield, with the column's capital, three flutes and base cut out of it
const SHIELD = 'M16 2 L28 6 V15 C28 22.5 22.8 27.6 16 30 C9.2 27.6 4 22.5 4 15 V6 Z'
  + ' M10.5 9 H21.5 V11 H10.5 Z M12.5 12 H14 V21 H12.5 Z M15.25 12 H16.75 V21 H15.25 Z M18 12 H19.5 V21 H18 Z M10.5 22 H21.5 V24 H10.5 Z';
const SERIF = `font-family="Georgia, 'Times New Roman', serif"`;
const SANS = `font-family="'Helvetica Neue', Arial, system-ui, sans-serif"`;

/** The graphic logo on its own: the shield and column, in currentColor. */
export const STEADFAST_MARK = `<svg class="steadfast-mark" viewBox="0 0 32 32" role="img" aria-label="Steadfast Mutual"><path d="${SHIELD}" fill="currentColor" fill-rule="evenodd"/></svg>`;

/** The shield on a white tile (the browser chrome is dark): favicons. */
export const STEADFAST_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#fff"/><path d="${SHIELD}" fill="${STEADFAST_NAVY}" fill-rule="evenodd" transform="translate(16 16) scale(.84) translate(-16 -16)"/></svg>`;

/** The text logo: the shield, STEADFAST in serif capitals, and MUTUAL · EST. 1952 under it. In currentColor. */
export const steadfastWordmark = (): string =>
  `<svg class="steadfast-wordmark" viewBox="0 0 150 32" height="32" role="img" aria-label="Steadfast Mutual">`
  + `<path d="${SHIELD}" fill="currentColor" fill-rule="evenodd"/>`
  + `<text x="38" y="17" ${SERIF} font-size="16.5" font-weight="700" textLength="110" lengthAdjust="spacing" fill="currentColor">STEADFAST</text>`
  + `<text x="38.5" y="28" ${SANS} font-size="7.5" font-weight="600" textLength="109" lengthAdjust="spacing" fill="currentColor" opacity=".7">MUTUAL · EST. 1952</text>`
  + `</svg>`;
