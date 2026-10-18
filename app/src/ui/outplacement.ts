/*
 * Vantor Outplacement's resume upload (vantor.group/next-chapter), drawn under the landing page's
 * cards: the Upload button opens the file dialog (ui/filePicker.ts) on Qdrive, PDFs only (engine/uploads.ts). Whatever is uploaded, Next Chapter
 * matches it against every open role and finds 0.
 */
import type { GameStore } from '../game/store';
import { UPLOAD_MS, uploadsTo } from '../engine/uploads';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const OUTPLACEMENT = 'vantor.group/next-chapter';

export function outplacementUpload(store: GameStore): string {
  const s = store.state;
  const last = uploadsTo(s, OUTPLACEMENT).at(-1);
  const up = store.ui.uploading?.site === OUTPLACEMENT ? store.ui.uploading : null;
  let result = '';
  if (up && last) {
    // negative delays keep the animations where they were when the page redraws on the clock tick
    const ms = Math.min(UPLOAD_MS, Date.now() - up.at);
    const step = ms < UPLOAD_MS / 2 ? `Uploading ${esc(last.name)}…` : 'Comparing your resume with every open role in the region…';
    result = `<div class="up-loading" role="status" style="--up-ms:${UPLOAD_MS}ms;--up-at:-${ms}ms"><span class="up-spin" aria-hidden="true"></span><span>${step}</span><i class="up-bar"><b></b></i></div>`;
  } else if (last) {
    result = `<div class="up-result" role="status"><b>0 jobs found</b><span>We compared ${esc(last.name)} with every open role in the region. None of them are a match.</span></div>`;
  }
  const err = store.ui.uploadError ? `<p class="up-err" role="alert">${esc(store.ui.uploadError)}</p>` : '';
  return `<div class="up-form">
    <h2>Upload your resume</h2>
    <p>Next Chapter needs your resume to find roles that match. PDF only.</p>
    <div class="up-row"><button type="button" class="lp-btn" data-act="up-open" data-site="${OUTPLACEMENT}"${up ? ' disabled' : ''}>Upload resume</button></div>
    ${err}${result}
  </div>`;
}
