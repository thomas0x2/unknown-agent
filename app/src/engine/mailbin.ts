/*
 * Qmail's Bin. Ids are Qmail row ids ('m/<mail id>' or 'e/<delivery key>'). Binned mail can still be
 * read, answered or restored until the day ends; then it's gone for good. Binning changes nothing in
 * the story: an unanswered email in the Bin is simply ignored, and its noReply lands at the usual time.
 */
import type { GameState } from './state';

export const inBin = (s: GameState, id: string) => !!s.mailBin?.includes(id);
export const isDeleted = (s: GameState, id: string) => !!s.mailDeleted?.includes(id);

export function binMail(s: GameState, ids: string[]): void {
  const bin = (s.mailBin ??= []);
  for (const id of ids) if (!bin.includes(id) && !isDeleted(s, id)) bin.push(id);
}

export function restoreMail(s: GameState, ids: string[]): void {
  if (s.mailBin) s.mailBin = s.mailBin.filter((id) => !ids.includes(id));
}

/** The end of the day: everything in the Bin is deleted. */
export function emptyMailBin(s: GameState): void {
  if (!s.mailBin?.length) return;
  s.mailDeleted = [...(s.mailDeleted ?? []), ...s.mailBin];
  s.mailBin = [];
}
