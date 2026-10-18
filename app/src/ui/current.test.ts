import { describe, it, expect } from 'vitest';
import { newGame, type GameState } from '../engine';
import { pageCurrent } from './current';

const edition = (s: GameState, day: number, subject: string) =>
  s.delivered.push({ eventId: 'current_newsletter', site: 'qmail', day, min: 600, answered: false, subject, body: `${subject} story.\n\nVantor: An item.` });

describe('thecurrent.test front page', () => {
  it('leads with the latest edition and lists the earlier ones', () => {
    const s = newGame(1);
    edition(s, 1, 'First headline');
    edition(s, 2, 'Second headline');
    s.values.day = 2;
    const html = pageCurrent(s);
    expect(html.indexOf('Second headline')).toBeLessThan(html.indexOf('Earlier editions'));
    expect(html).toContain('data-nav="thecurrent.test/edition-1"');
    expect(html).toContain('First headline');
  });

  it('has no archive before a second edition, and no edition pages for days not received', () => {
    const s = newGame(1);
    edition(s, 1, 'First headline');
    expect(pageCurrent(s)).not.toContain('Earlier editions');
    expect(pageCurrent(s, 'edition-1')).toContain('First headline');
    expect(pageCurrent(s, 'edition-2')).toContain('Story not found');
  });
});
