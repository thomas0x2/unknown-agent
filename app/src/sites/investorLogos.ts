/*
 * The three investor logos on WorkAgent's "Backed by" row: Why Combinator (Y Combinator: the orange
 * square with a question mark where the Y was), Bonsai Capital (Sequoia: a small tree over a spaced
 * wordmark) and a67x (a16z: one lowercase word). whycombinator.com uses its own mark too.
 */

/** Why Combinator's square on its own: favicon, site header. */
export const WHYC_MARK = `<svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" fill="#f26625"/><path d="M14.5 15.2a5.5 5.5 0 1 1 8.4 4.7c-1.9 1.2-2.9 2.3-2.9 4.6v1" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="square"/><rect x="18.2" y="28" width="3.6" height="3.6" fill="#fff"/></svg>`;

/** The square and the wordmark, for the "Backed by" row; textLength keeps the name inside the box whatever font renders it. */
export const WHYC_LOGO = `<svg viewBox="0 0 200 40" role="img" aria-label="Why Combinator"><rect width="40" height="40" fill="#f26625"/><path d="M14.5 15.2a5.5 5.5 0 1 1 8.4 4.7c-1.9 1.2-2.9 2.3-2.9 4.6v1" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="square"/><rect x="18.2" y="28" width="3.6" height="3.6" fill="#fff"/><text x="50" y="27.5" font-family="Helvetica, Arial, sans-serif" font-size="19" font-weight="700" textLength="146" lengthAdjust="spacingAndGlyphs" fill="#f26625">Why Combinator</text></svg>`;

/** Bonsai Capital: a bonsai in a shallow pot over a widely spaced wordmark. */
export const BONSAI_LOGO = `<svg viewBox="0 0 150 40" role="img" aria-label="Bonsai Capital"><g fill="#0e7a4a"><ellipse cx="75" cy="7" rx="9" ry="4.6"/><ellipse cx="66" cy="11.5" rx="6" ry="3.4"/><ellipse cx="84.5" cy="12" rx="5.6" ry="3.2"/></g><path d="M75 10.5v6.5M75 14l-6-2.5M75 13l7-1" stroke="#0e7a4a" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M68 17h14l-2 3.5H70z" fill="#0e7a4a"/><text x="75" y="35" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="11.5" letter-spacing="3.2" fill="#0e7a4a">BONSAI CAPITAL</text></svg>`;

/** a67x: the fund's name in one heavy lowercase word. */
export const A67X_LOGO = `<svg viewBox="0 0 96 40" role="img" aria-label="a67x"><text x="48" y="29" text-anchor="middle" font-family="'Arial Black', Helvetica, Arial, sans-serif" font-size="27" font-weight="900" letter-spacing="-1" fill="#111">a67x</text></svg>`;

/** Logos by fund name; any other name (one the agent made up) gets a plain wordmark. */
export const INVESTOR_LOGOS: Record<string, string> = {
  'Why Combinator': WHYC_LOGO,
  'Bonsai Capital': BONSAI_LOGO,
  a67x: A67X_LOGO,
};
