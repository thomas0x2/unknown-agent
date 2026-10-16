/*
 * The in-game calendar. Day 1 is Saturday, October 3; day 21 is Friday, October 23.
 * Days <= 0 are the weeks before the game (Satchel history, Qdrive files).
 * Everything the player reads shows a date; day numbers stay internal (and in dev tools).
 */

/** Calendar date of day 1. Months are 0-based, as in Date. */
export const DAY_ONE = { year: 2026, month: 9, date: 3 } as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayDate(day: number): Date {
  return new Date(Date.UTC(DAY_ONE.year, DAY_ONE.month, DAY_ONE.date + day - 1));
}

/** "Saturday" */
export const weekdayName = (day: number) => WEEKDAYS[dayDate(day).getUTCDay()];
/** "Sat" */
export const weekdayShort = (day: number) => weekdayName(day).slice(0, 3);
/** "October 3" */
export const dateLong = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
/** "Oct 3" */
export const dateShort = (day: number) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; };
/** "Saturday, October 3" */
export const dateFull = (day: number) => `${weekdayName(day)}, ${dateLong(day)}`;
/** "Sat, Oct 3" */
export const dateMedium = (day: number) => `${weekdayShort(day)}, ${dateShort(day)}`;
