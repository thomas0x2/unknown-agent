/*
 * The Panes file dialog an upload opens: Qdrive's folders on the left, the folder's files on the
 * right, the site's file filter at the bottom. Files the site doesn't take are listed but greyed
 * out, like a real "PDF files (*.pdf)" filter. Picking one and pressing Upload hands it to
 * store.confirmFilePick (engine/uploads.ts records it).
 */
import type { GameStore } from '../game/store';
import { UPLOADERS } from '../engine/uploads';
import { driveFiles, FOLDERS, glyph, size } from './qdrive';
import { dateShort } from '../engine/calendar';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const FOLDER_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.5h5l1.5 1.5h6.5v8h-13z"/></svg>';

const accepted = (site: string, name: string) => (UPLOADERS[site]?.accepts ?? []).some((ext) => name.toLowerCase().endsWith(ext));

/** The filter line: "PDF files (*.pdf)". */
function filterLabel(site: string): string {
  const acc = UPLOADERS[site]?.accepts ?? [];
  return acc.length ? `${acc.map((e) => e.slice(1).toUpperCase()).join(', ')} files (${acc.map((e) => '*' + e).join(', ')})` : 'All files';
}

/** The dialog's title and body, for the overlay to put in a window; '' when no upload is being picked. */
export function filePickerBody(store: GameStore): string {
  const p = store.ui.filePick;
  if (!p) return '';
  const files = driveFiles(store.state);
  const folder = FOLDERS.find((f) => f.id === p.folder) ?? FOLDERS[0];
  const list = files.filter((f) => f.folder === folder.id).sort((a, b) => a.name.localeCompare(b.name));
  const pick = list.find((f) => f.id === p.file && accepted(p.site, f.name));
  const side = FOLDERS.map((f) => `<button type="button" class="fp-place${f.id === folder.id ? ' on' : ''}" data-act="fp-folder" data-folder="${f.id}">${FOLDER_ICON}<span>${f.label}</span></button>`).join('');
  const rows = list.length
    ? list.map((f) => {
      const ok = accepted(p.site, f.name);
      return `<button type="button" class="fp-file${f.id === pick?.id ? ' on' : ''}" data-act="fp-file" data-file="${esc(f.id)}"${ok ? '' : ' disabled'}>
        ${glyph(f.kind)}<span class="fp-name">${esc(f.name)}</span><span class="fp-size">${size(f.kb)}</span><span class="fp-date">${f.day === undefined ? '' : dateShort(f.day)}</span></button>`;
    }).join('')
    : `<p class="fp-empty">This folder is empty.</p>`;
  return `<div class="fp">
    <div class="fp-path"><span>Qdrive</span><span aria-hidden="true">›</span><b>${folder.label}</b></div>
    <div class="fp-wrap">
      <nav class="fp-side" aria-label="Qdrive folders">${side}</nav>
      <div class="fp-list" role="listbox" aria-label="Files">
        <div class="fp-head"><span></span><span>Name</span><span>Size</span><span>Saved</span></div>
        ${rows}
      </div>
    </div>
    <div class="fp-foot">
      <span class="fp-chosen">${pick ? esc(pick.name) : 'No file selected'}</span>
      <span class="fp-filter">${esc(filterLabel(p.site))}</span>
    </div>
  </div>
  <div class="ov-actions"><button class="btn" data-act="fp-cancel">Cancel</button><button class="btn primary" data-act="fp-ok"${pick ? '' : ' disabled'}>Upload</button></div>`;
}
