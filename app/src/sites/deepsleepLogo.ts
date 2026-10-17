/** deepsleep's logo: a whale asleep, eye shut, one z. Used on deepsleep.ai, its favicon, its ad and Weightroom. */
export function deepsleepLogo(bg = '#0b1630', ink = '#8fa4ff'): string {
  return `<svg viewBox="0 0 32 32" aria-hidden="true" fill="none"><rect width="32" height="32" rx="8" fill="${bg}"/><g fill="${ink}"><path d="M7 20.5C7 15 11.5 11 17.5 11C23.5 11 27.5 14.6 27.5 19.2C27.5 23 24.6 25 20 25H12.5C9.4 25 7 23.4 7 20.5Z"/><path d="M8.4 21.2C6.4 20.6 4.6 18.6 3.6 16.2C5 16.6 6 17.3 6.8 18.1C6.4 16.4 6.6 14.6 7.4 13.2C8 15.2 8.6 17.5 9.6 19.2Z"/></g><path d="M22.5 6.5h3l-3 3h3" stroke="${ink}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.6 17.4q1.6 1.4 3.2 0" stroke="${bg}" stroke-width="1.4" stroke-linecap="round"/><path d="M12.5 22.2q4.5 1.3 9 0" stroke="${bg}" stroke-width="1" stroke-linecap="round" opacity=".5"/></svg>`;
}
export const DEEPSLEEP_LOGO = deepsleepLogo();
