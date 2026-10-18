import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { UPLOAD_MS, uploadsTo, type JevRouter, type SaveStore, type Writer } from '../engine';
import { outplacementUpload, OUTPLACEMENT } from '../ui/outplacement';
import { filePickerBody } from '../ui/filePicker';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('upload file dialog', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('stops the clock, greys out files the site does not take, and uploads behind a loading animation', () => {
    vi.useFakeTimers();
    const store = make();
    store.openFilePicker(OUTPLACEMENT, 'documents', '');
    expect(store.dialogOpen).toBe(true);
    const body = filePickerBody(store);
    expect(body).toMatch(/data-file="passwords"[^>]*disabled/);
    expect(body).toContain('PDF files (*.pdf)');
    store.filePickFile('resume');
    store.confirmFilePick({ id: 'resume', name: 'resume_final_v3.pdf' });
    expect(store.ui.filePick).toBeNull();
    expect(uploadsTo(store.state, OUTPLACEMENT)).toHaveLength(1);
    expect(outplacementUpload(store)).toContain('up-loading');
    expect(outplacementUpload(store)).not.toContain('0 jobs found');
    vi.advanceTimersByTime(UPLOAD_MS);
    expect(outplacementUpload(store)).toContain('0 jobs found');
  });
});
