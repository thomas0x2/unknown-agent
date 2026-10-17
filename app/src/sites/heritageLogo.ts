/**
 * The Heritage Party's logo, Randall Crane's party: the GOP elephant redrawn as a woolly mammoth,
 * blue back with three white stars over red stripes, one ivory tusk. Used on crane2026.vote, its
 * favicon and the Crane ads.
 */
export function heritageLogo(bg = '#fff', blue = '#0b2a6b', red = '#b3121f'): string {
  const body = 'M4.5 25V16C4.5 13.4 6 11.8 8.6 10.6C10 8.4 12 7 14.2 7C15.4 7 16.3 7.3 17 7.8C17.9 6.2 19.4 5.2 21.2 5.2C24.6 5.2 27 8 27.4 12.2C27.7 15 27.6 18.2 27.4 21C27.3 23.4 26.3 25 24.8 25C24 25 23.6 24.4 23.9 23.8C24.6 22.6 24.8 20.6 24.6 18.4C24.1 18.6 23.6 18.7 23.1 18.7V25H19.6V21.8L18.7 22.6L17.8 21.8L16.9 22.6L16 21.8L15.1 22.6L14.2 21.8L13.3 22.6L12.6 22V25H9.1V22.4L7.9 23.4L7.3 25Z';
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><clipPath id="hp-body"><path d="${body}"/></clipPath></defs><rect width="32" height="32" rx="7" fill="${bg}"/><g clip-path="url(#hp-body)"><rect width="32" height="15.5" fill="${blue}"/><rect y="15.5" width="32" height="17" fill="${red}"/><path d="M0 18.6H32M0 21.6H32" stroke="${bg}" stroke-width="1.1"/></g><g fill="${bg}"><path d="M10.4 11.1l.55 1.12 1.24.18-.9.87.21 1.23-1.1-.58-1.1.58.21-1.23-.9-.87 1.24-.18Z"/><path d="M14.9 9.6l.55 1.12 1.24.18-.9.87.21 1.23-1.1-.58-1.1.58.21-1.23-.9-.87 1.24-.18Z"/><path d="M19.4 9.2l.55 1.12 1.24.18-.9.87.21 1.23-1.1-.58-1.1.58.21-1.23-.9-.87 1.24-.18Z"/></g><path d="M23.4 17.6C25.6 20 28.6 19.6 29.4 15.6" fill="none" stroke="#e9dcc0" stroke-width="1.5" stroke-linecap="round"/></svg>`;
}
export const HERITAGE_LOGO = heritageLogo();
