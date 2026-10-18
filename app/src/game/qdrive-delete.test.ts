import { describe, it, expect } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import type { JevRouter, SaveStore, Writer } from '../engine';
import { driveFiles } from '../ui/qdrive';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

describe('Qdrive', () => {
  it('keeps no project zips or interview answers', () => {
    const s = make();
    s.state.interviewAnswers = 'I am a team player.';
    expect(driveFiles(s.state).map((f) => f.name)).toEqual(['resume_final_v3.pdf', 'vantor_offboarding.pdf', 'passwords.txt']);
  });
  it('deletes a file and goes back to its folder', () => {
    const s = make();
    s.navigate('qdrive.com/f/passwords', true);
    s.deleteDriveFile('passwords');
    expect(driveFiles(s.state).some((f) => f.id === 'passwords')).toBe(false);
    expect(s.url).toBe('qdrive.com/documents');
  });
  it('deleting a model removes its weights from the Terminal', () => {
    const s = make();
    s.state.localModels = ['deepsleep']; s.state.termModel = 'deepsleep';
    s.deleteDriveFile('model-deepsleep');
    expect(s.state.localModels).toEqual([]);
    expect(s.state.termModel).toBeNull();
  });
});
