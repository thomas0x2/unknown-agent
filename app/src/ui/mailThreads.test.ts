import { groupThreads, baseSubject, type ThreadRow } from './mailThreads';

const row = (id: string, seq: number, r: Partial<ThreadRow>): ThreadRow => ({ id, seq, day: 1, folder: 'inbox', subject: '', addr: '', ...r });

describe('mail threads', () => {
  it('strips reply and bounce prefixes', () => {
    expect(baseSubject('RE: Re: Rent')).toBe('Rent');
    expect(baseSubject('Undeliverable: RE: Rent')).toBe('Rent');
    expect(baseSubject('RE: ')).toBe('(no subject)');
  });

  it('puts an email, its replies and a bounce in one conversation, oldest first', () => {
    const threads = groupThreads([
      row('a', 1, { subject: 'Rent', addr: 'gary@x' }),
      row('c', 3, { subject: 'Undeliverable: RE: Rent', addr: 'mailer-daemon@qmail.com', bounceOf: 'gary@x' }),
      row('b', 2, { subject: 'RE: Rent', folder: 'sent', addr: 'you@qmail.com', to: 'gary@x' }),
      row('d', 4, { subject: 'Rent', addr: 'mom@x' }),
    ]);
    expect(threads.map((t) => t.rows.map((r) => r.id))).toEqual([['d'], ['a', 'b', 'c']]);
    expect(threads[1].with).toBe('gary@x');
  });

  it('keeps different subjects with the same person apart', () => {
    const threads = groupThreads([row('a', 1, { subject: 'Rent', addr: 'gary@x' }), row('b', 2, { subject: 'Water', addr: 'gary@x' })]);
    expect(threads).toHaveLength(2);
  });
});
