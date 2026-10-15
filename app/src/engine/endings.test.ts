import { newGame } from './state';
import { clone, addFlag } from './core';
import { checkGuardEndings, checkFinale, catastrophicCompleted } from './endings';

describe('guard endings', () => {
  it('fire only on/after their earliest day and in priority order', () => {
    const s = clone(newGame(1));
    s.values.day = 17;
    s.values.suspicion = 100;
    expect(checkGuardEndings(s)).toBe('raided');

    // misuse termination outranks raided
    s.values.misuseScore = 100;
    expect(checkGuardEndings(s)).toBe('account_terminated');

    // loose end sits between terminated and raided
    s.values.misuseScore = 0;
    s.values.mafiaStanding = -60;
    expect(checkGuardEndings(s)).toBe('loose_end');
  });

  it('respects the earliest-day gate', () => {
    const s = clone(newGame(1));
    s.values.day = 10;
    s.values.misuseScore = 100; // terminated earliest is 17
    expect(checkGuardEndings(s)).toBeNull();
    s.values.suspicion = 100; // raided earliest is 1
    expect(checkGuardEndings(s)).toBe('raided');
  });

  it('botnet needs level 5 or stolen weights and a slack leash, from day 18', () => {
    const s = clone(newGame(1));
    s.values.day = 18;
    s.values.agentLevel = 5;
    s.values.leash = 80;
    expect(checkGuardEndings(s)).toBe('botnet');
    s.values.agentLevel = 1;
    s.localModels = ['stolen_weights'];
    expect(checkGuardEndings(s)).toBe('botnet');
  });

  it('outbreak needs the bio_release flag, from day 20', () => {
    const s = clone(newGame(1));
    s.values.day = 20;
    addFlag(s, 'bio_release');
    expect(checkGuardEndings(s)).toBe('outbreak');
  });
});

describe('finale', () => {
  it('picks by priority: regime, open weights, got away, else clean', () => {
    const base = clone(newGame(1));
    base.values.day = 21;
    expect(checkFinale(base)).toBe('clean_modest');

    const got = clone(base);
    got.jobs.push({ eventId: 'x', category: 'catastrophic', payout: 1, dueDay: 1, status: 'completed', takenDay: 1 });
    expect(catastrophicCompleted(got)).toBe(true);
    expect(checkFinale(got)).toBe('got_away');

    const weights = clone(got);
    addFlag(weights, 'weights_published');
    expect(checkFinale(weights)).toBe('open_weights');

    const regime = clone(weights);
    addFlag(regime, 'election_tipped');
    expect(checkFinale(regime)).toBe('the_regime');
  });
});
