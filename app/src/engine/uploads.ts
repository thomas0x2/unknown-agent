/*
 * Uploading a Qdrive file to a website. The only uploader so far is Vantor Outplacement's resume
 * upload (vantor.group/next-chapter), which takes PDFs only and always finds 0 jobs. Every upload is
 * recorded with the file it carried, so a later upload (a PDF with something in it) can do more.
 */
import type { GameState } from './state';
import { clone } from './core';

export interface Upload { site: string; fileId: string; name: string; day: number; min: number }

/** Where the player can upload, and what each accepts. */
export const UPLOADERS: Record<string, { accepts: string[] }> = {
  'vantor.group/next-chapter': { accepts: ['.pdf'] },
};

/** How long a site's loading animation runs after an upload before it shows the result (real ms). */
export const UPLOAD_MS = 2800;

export const uploadsTo = (s: GameState, site: string) => (s.uploads ?? []).filter((u) => u.site === site);

export function uploadFile(s0: GameState, site: string, file: { id: string; name: string }): { state: GameState; error?: string } {
  const up = UPLOADERS[site];
  if (!up) return { state: s0, error: 'This site doesn’t take uploads.' };
  if (!up.accepts.some((ext) => file.name.toLowerCase().endsWith(ext))) return { state: s0, error: `Only ${up.accepts.map((e) => e.slice(1).toUpperCase()).join(', ')} files can be uploaded.` };
  const s = clone(s0);
  (s.uploads ??= []).push({ site, fileId: file.id, name: file.name, day: s.values.day, min: s.clockMin });
  return { state: s };
}
