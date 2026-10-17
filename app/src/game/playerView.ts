/*
 * What the player's own screens show right now, sent to Haiku with an agent.chat query so it can
 * answer questions about the player's mail, the Y timeline, Yowl and the rest (server/screens.mjs reads
 * it). Built in the UI (ui/queryView.ts) from the same rows the pages draw, so nothing the player
 * can't see gets in. Times are clock strings ("2:15 PM").
 */
export interface PlayerView {
  day: number;
  time: string;
  wallet: { dolr: number; followers: number; model: number; rent?: { day: number; amount: number } };
  tx: { day: number; time?: string; amount: number; memo: string }[];
  mail: { folder: 'inbox' | 'sent'; day: number; time?: string; from: string; addr: string; to?: string; subject: string; body: string; unread?: boolean }[];
  y: { day: number; time?: string; author: string; handle: string; text: string; mine?: boolean }[];
  yowl: { business: string; author: string; stars: number; text: string; day: number; mine?: boolean }[];
  citypulse: { day: number; time: string; title: string; dek: string }[];
  pollymarket?: { title: string; category: string; chance: number; resolved?: 'YES' | 'NO' }[];
  apps: { name: string; url: string; deployed: boolean; client?: string; users?: number }[];
}
