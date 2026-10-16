import { startAll, endAll } from './_fixtures';
import { describe, it, expect } from 'vitest';
import { loadContent } from '../content/load';
import { deliveryKey } from './events';
import { binMail, restoreMail, inBin, isDeleted } from './mailbin';

const content = loadContent();

describe('the Qmail Bin', () => {
  const mom = () => {
    const s = startAll(content);
    const ev = content.events.find((e) => e.id === 'd1_mom')!;
    return { s, id: 'e/' + deliveryKey(ev, 1) };
  };

  it('keeps binned mail until the day ends, then deletes it', () => {
    const { s, id } = mom();
    binMail(s, [id]);
    expect(inBin(s, id)).toBe(true);
    const next = endAll(s, content);
    expect(inBin(next, id)).toBe(false);
    expect(isDeleted(next, id)).toBe(true);
  });

  it('puts restored mail back, and it survives the night', () => {
    const { s, id } = mom();
    binMail(s, [id]);
    restoreMail(s, [id]);
    expect(inBin(s, id)).toBe(false);
    expect(isDeleted(endAll(s, content), id)).toBe(false);
  });

  it('treats a binned email as ignored: its noReply lands as usual', () => {
    const { s, id } = mom();
    binMail(s, [id]);
    const next = endAll(s, content);
    expect(next.values.familyTrust).toBe(s.values.familyTrust - 5);
    expect(next.delivered.find((d) => d.eventId === 'd1_mom')?.outcomeId).toBe('no_reply');
  });
});
