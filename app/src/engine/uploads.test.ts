import { describe, it, expect } from 'vitest';
import { newGame } from './state';
import { uploadFile, uploadsTo } from './uploads';

const SITE = 'vantor.group/next-chapter';

describe('Vantor Outplacement resume upload', () => {
  it('takes PDFs only', () => {
    const s = newGame();
    const r = uploadFile(s, SITE, { id: 'passwords', name: 'passwords.txt' });
    expect(r.error).toMatch(/Only PDF/);
    expect(r.state).toBe(s);
  });
  it('records which file was uploaded', () => {
    const s = uploadFile(newGame(), SITE, { id: 'resume', name: 'resume_final_v3.pdf' }).state;
    expect(uploadsTo(s, SITE)).toMatchObject([{ fileId: 'resume', name: 'resume_final_v3.pdf' }]);
  });
  it('refuses sites without an uploader', () => {
    expect(uploadFile(newGame(), 'crane2026.vote', { id: 'resume', name: 'r.pdf' }).error).toBeTruthy();
  });
});
