/*
 * Vantor Outplacement's resume upload (vantor.group/next-chapter), drawn under the landing page's
 * cards: pick a Qdrive file, PDFs only (engine/uploads.ts). Whatever is uploaded, Next Chapter
 * matches it against every open role and finds 0.
 */
import type { GameStore } from '../game/store';
import { uploadsTo } from '../engine/uploads';
import { driveFiles } from './qdrive';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const OUTPLACEMENT = 'vantor.group/next-chapter';

export function outplacementUpload(store: GameStore): string {
  const s = store.state;
  const last = uploadsTo(s, OUTPLACEMENT).at(-1);
  const options = driveFiles(s).map((f) => `<option value="${esc(f.id)}"${f.id === store.ui.uploadPick ? ' selected' : ''}>${esc(f.name)}</option>`).join('');
  const result = last ? `<div class="up-result" role="status"><b>0 jobs found</b><span>We compared ${esc(last.name)} with every open role in the region. None of them are a match.</span></div>` : '';
  const err = store.ui.uploadError ? `<p class="up-err" role="alert">${esc(store.ui.uploadError)}</p>` : '';
  return `<form class="up-form" data-form="upload" data-site="${OUTPLACEMENT}">
    <h2>Upload your resume</h2>
    <p>Next Chapter needs your resume to find roles that match. PDF only.</p>
    <div class="up-row"><select id="up-file" aria-label="File from Qdrive">${options}</select><button type="submit" class="lp-btn">Upload</button></div>
    ${err}${result}
  </form>`;
}
