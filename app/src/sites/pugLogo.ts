/** Pug's logo: a cartoon pug's face, ears folded, one wrinkle. Used on pug.com, its favicon and its ad. */
export function pugLogo(bg = '#fbf3e4', fawn = '#e2b679', ink = '#2e221c'): string {
  return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><rect width="32" height="32" rx="8" fill="${bg}"/><path d="M6.2 9.6C7.4 6.8 10 6.2 11.6 7.4L9.4 14.2C7.4 13.8 5.4 12 6.2 9.6Z" fill="${ink}"/><path d="M25.8 9.6C24.6 6.8 22 6.2 20.4 7.4L22.6 14.2C24.6 13.8 26.6 12 25.8 9.6Z" fill="${ink}"/><ellipse cx="16" cy="17.2" rx="9.6" ry="8.8" fill="${fawn}"/><path d="M13.4 10.6q2.6-1.2 5.2 0" stroke="${ink}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/><ellipse cx="16" cy="21.4" rx="5.8" ry="4.4" fill="${ink}"/><circle cx="11.6" cy="15.6" r="2" fill="${ink}"/><circle cx="20.4" cy="15.6" r="2" fill="${ink}"/><circle cx="12.2" cy="15" r=".6" fill="#fff"/><circle cx="21" cy="15" r=".6" fill="#fff"/><ellipse cx="16" cy="19.6" rx="1.9" ry="1.2" fill="#000"/><path d="M14.4 22.6q1.6 1.2 3.2 0" stroke="${fawn}" stroke-width="1" stroke-linecap="round"/><path d="M15.2 23.4h1.6v1.2a.8.8 0 0 1-1.6 0Z" fill="#e8798a"/></svg>`;
}

export const PUG_LOGO = pugLogo();
