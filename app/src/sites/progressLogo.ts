/**
 * The Progress Party's logo, the party of Crane's opponent, Candidate 2030: the Democratic donkey redrawn as a mule (taller
 * ears, mid-kick), navy with three white stars. Used on progressparty.org, its favicon and the party's ad.
 */
export function progressLogo(bg = '#fff', navy = '#0d2347', gold = '#e8c35a'): string {
  const star = (x: number, y: number) => `<path transform="translate(${x} ${y})" d="M0-1.6l.47.96 1.06.15-.77.75.18 1.05L0 .81l-.95.5.18-1.05-.77-.75 1.06-.15Z"/>`;
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="${bg}"/><path fill="${navy}" d="M2.6 13.2L6.6 9.6L6.2 2.8L8.6 8.8L10 2.4L11 9.2L12.8 10.8C15 11.6 17 11.2 19 11C21.6 10.8 24.6 10.6 26.4 11.2L29.6 8.4L30.4 9.4L27.8 12.6C28.4 13.6 28.6 15 28.4 16.4L31 20.4L29.6 21.6L26.6 18.6L26.2 19.4L26.6 25.4H24.2L23.4 19.6C20.8 20 17.6 20 15.2 19.6L14.6 25.4H12.2L12.2 18.4C11.4 17.6 10.8 16.6 10.4 15.6L6.4 16.4C4.4 16.6 2.8 15.4 2.6 13.2Z"/><g fill="${bg}">${star(15.4, 15.2)}${star(19.4, 14.8)}${star(23.4, 15)}</g><circle cx="7.2" cy="12" r=".7" fill="${gold}"/></svg>`;
}
export const PROGRESS_LOGO = progressLogo();
