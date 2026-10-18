/*
 * The in-game calendar. Day 1 is Monday, October 7, 2030; day 28 is Sunday, November 3, 2030 (election day).
 * Days <= 0 are the weeks before the game (Coinbin history, Qdrive files).
 * The engine counts days; only the UI (and player-facing copy) shows dates. Dev tools keep day numbers.
 */

/** Calendar date of day 1. Months are 0-based, as in Date. */
export const DAY_ONE = { year: 2030, month: 9, date: 7 } as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayDate(day: number): Date {
  return new Date(Date.UTC(DAY_ONE.year, DAY_ONE.month, DAY_ONE.date + day - 1));
}

/** "Monday" */
export const weekdayName = (day: number) => WEEKDAYS[dayDate(day).getUTCDay()];
/** "Tue" */
export const weekdayShort = (day: number) => weekdayName(day).slice(0, 3);
/** "October 7" (no year) */
export const dateLong = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
/** "Oct 7" (no year, for list timestamps) */
export const dateShort = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; };
/** "Monday, October 7, 2030" */
export const dateFull = (day: number) => `${weekdayName(day)}, ${dateLong(day)}, ${dayDate(day).getUTCFullYear()}`;
/** "Mon, Oct 7, 2030" */
export const dateMedium = (day: number) => `${weekdayShort(day)}, ${dateShort(day)}, ${dayDate(day).getUTCFullYear()}`;

/** Minutes since midnight as a 12-hour clock time ("2:30 PM"). */
export function clockTime(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.round(min)));
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
