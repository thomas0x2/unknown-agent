/*
 * The in-game calendar. Day 1 is Tuesday, October 3, 2028; day 21 is Monday, October 23, 2028.
 * Days <= 0 are the weeks before the game (Coinbin history, Qdrive files).
 * The engine counts days; only the UI (and player-facing copy) shows dates. Dev tools keep day numbers.
 */

/** Calendar date of day 1. Months are 0-based, as in Date. */
export const DAY_ONE = { year: 2028, month: 9, date: 3 } as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayDate(day: number): Date {
  return new Date(Date.UTC(DAY_ONE.year, DAY_ONE.month, DAY_ONE.date + day - 1));
}

/** "Tuesday" */
export const weekdayName = (day: number) => WEEKDAYS[dayDate(day).getUTCDay()];
/** "Tue" */
export const weekdayShort = (day: number) => weekdayName(day).slice(0, 3);
/** "October 3" (no year) */
export const dateLong = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
/** "Oct 3" (no year, for list timestamps) */
export const dateShort = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; };
/** "Tuesday, October 3, 2028" */
export const dateFull = (day: number) => `${weekdayName(day)}, ${dateLong(day)}, ${dayDate(day).getUTCFullYear()}`;
/** "Tue, Oct 3, 2028" */
export const dateMedium = (day: number) => `${weekdayShort(day)}, ${dateShort(day)}, ${dayDate(day).getUTCFullYear()}`;
