/*
 * The Vantor Group brand, in one place: the mark (a V whose right arm runs long, so it reads as a
 * tick), the wordmark, the tab icon, and the email signature. Everything Vantor draws its logo from
 * here: Qmail signatures, the offboarding PDF in Qdrive, vantor.group pages and Vantor banner ads.
 * Colours are charcoal on paper; the SVGs use currentColor so they sit on light or dark.
 */

export const VANTOR_INK = '#2c2c2a';
export const VANTOR_PAPER = '#f3f2ee';

const V = '5.5,11.5 10,11.5 14.5,21 22,5.5 26.5,5.5 16.3,26.5 12.6,26.5';
const FONT = `font-family="'Helvetica Neue', Arial, system-ui, sans-serif"`;

/** The graphic logo on its own: the V-tick, in currentColor. */
export const VANTOR_MARK = `<svg class="vantor-mark" viewBox="0 0 32 32" role="img" aria-label="Vantor Group"><polygon points="${V}" fill="currentColor"/></svg>`;

/** The mark on a paper tile (the browser chrome is dark): favicons and anywhere the logo needs a tile. */
export const VANTOR_ICON = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="${VANTOR_PAPER}"/><polygon points="${V}" fill="${VANTOR_INK}" transform="translate(16 16) scale(.74) translate(-16 -16)"/></svg>`;

/**
 * The text logo: mark, VANTOR in spaced capitals, and a division name after a hairline
 * ('Group', 'People & Culture', 'Outplacement'). In currentColor.
 */
export function vantorWordmark(division = 'Group'): string {
  const sub = division.toUpperCase().replace(/&/g, '&amp;');
  const subW = Math.round(division.length * 7.4);
  const w = 156 + subW;
  return `<svg class="vantor-wordmark" viewBox="0 0 ${w} 32" height="32" role="img" aria-label="Vantor ${division.replace(/&/g, '&amp;')}">`
    + `<polygon points="${V}" fill="currentColor"/>`
    + `<text x="40" y="23" ${FONT} font-size="19" font-weight="700" textLength="98" lengthAdjust="spacing" fill="currentColor">VANTOR</text>`
    + `<rect x="146" y="9" width="1" height="15" fill="currentColor" opacity=".45"/>`
    + `<text x="155" y="21" ${FONT} font-size="10.5" font-weight="500" textLength="${subW}" lengthAdjust="spacing" fill="currentColor" opacity=".75">${sub}</text>`
    + `</svg>`;
}

/** Emails from Vantor's own mail server. */
export const isVantorAddr = (addr: string | undefined): boolean => /@vantorgroup\.test$/i.test(addr ?? '');

/** The footer under every email Vantor sends. */
export const vantorSignature = (): string => `<div class="vantor-sig">${vantorWordmark('People & Culture')}
  <p>Vantor Group · 1 Vantor Plaza · <a href="#" class="y-link" data-nav="vantor.group/careers">vantor.group</a></p>
  <p class="vantor-sig-fine">This email and any attachments are confidential and intended for current employees only.</p>
</div>`;
