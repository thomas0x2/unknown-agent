/** a67x's logo: a white geometric lowercase "a" and a full stop, on the firm's red. Used on a67x.com, its favicon and the "Backed by" lines. */
export function a67xLogo(bg = '#c8372d', ink = '#fff'): string {
  return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><rect width="32" height="32" rx="6" fill="${bg}"/><circle cx="13.4" cy="17" r="5.6" stroke="${ink}" stroke-width="3.2"/><path d="M20.6 10.6V24" stroke="${ink}" stroke-width="3.2"/><rect x="23.6" y="20.8" width="3.2" height="3.2" fill="${ink}"/></svg>`;
}

export const A67X_LOGO = a67xLogo();
