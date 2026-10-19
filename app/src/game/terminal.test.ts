import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameStore } from './store';
import { loadContent } from '../content/load';
import { PULL_MS, pullLines, pullPct } from './pull';
import { bookmarks } from '../sites/registry';
import type { JevRouter, SaveStore, Writer } from '../engine';

const mem: SaveStore = { load: () => null, save: () => {}, clear: () => {} } as unknown as SaveStore;
const make = () => new GameStore(loadContent(), {} as JevRouter, {} as Writer, mem);

afterEach(() => { vi.useRealTimers(); });

describe('weightroom pull', () => {
  it('climbs to 99%, stalls there, then finishes', () => {
    expect(pullPct(0)).toBe(0);
    const mid = pullPct(3000);
    expect(mid).toBeGreaterThan(0); expect(mid).toBeLessThan(99);
    expect(pullPct(5500)).toBe(99);
    expect(pullPct(PULL_MS)).toBe(100);
    const done = pullLines('deepsleep', PULL_MS).map((l) => l.text);
    expect(done[0]).toBe('$ weightroom pull deepsleep-0.5B');
    expect(done).toContain('success');
  });
});

describe('the Terminal app', () => {
  it('opens as its own window during a download, not a browser tab', () => {
    vi.useFakeTimers();
    const s = make();
    const tabs = s.tabs.length;
    s.download('deepsleep');
    expect(s.ui.termShown).toBe(true);
    expect(s.pull?.id).toBe('deepsleep');
    expect(s.state.localModels).not.toContain('deepsleep');
    vi.advanceTimersByTime(PULL_MS + 200);
    expect(s.pull).toBeNull();
    expect(s.state.localModels).toContain('deepsleep');
    expect(s.state.flags).toContain('has_terminal');
    expect(s.state.terminal.some((l) => l.text === 'success')).toBe(true);
    expect(s.tabs.length).toBe(tabs);
    expect(s.url).not.toBe('localhost');
  });
  it('minimizes from the taskbar, and localhost brings it back', () => {
    vi.useFakeTimers();
    const s = make();
    s.download('deepsleep'); vi.advanceTimersByTime(PULL_MS + 200);
    s.termTask(); expect(s.ui.termShown).toBe(false); expect(s.ui.termOpen).toBe(true);
    s.closeTerm(); expect(s.ui.termOpen).toBe(false);
    s.navigate('localhost');
    expect(s.ui.termShown).toBe(true);
    expect(s.url).toBe('qmail.com');
  });
});

describe('Weightroom bookmark', () => {
  it('appears only after the first visit, not when dev_null mentions it', () => {
    const s = make();
    s.state.flags.push('knows_weightroom');
    expect(bookmarks(s.state).map((b) => b.id)).not.toContain('weightroom');
    s.navigate('weightroom.ai');
    expect(bookmarks(s.state).map((b) => b.id)).toContain('weightroom');
  });
  it('is not added by visiting before the site is known', () => {
    const s = make();
    s.navigate('weightroom.ai');
    s.state.flags.push('knows_weightroom');
    expect(bookmarks(s.state).map((b) => b.id)).not.toContain('weightroom');
  });
});

describe('the Terminal from day 1', () => {
  it('opens on a fresh game, with no model and no Weightroom', async () => {
    const s = make();
    expect(s.ui.termSession).toBeNull();
    s.navigate('localhost');
    expect(s.ui.termShown).toBe(true);
    await s.term('ls');
    expect(s.state.terminal.map((l) => l.text)).toEqual(['~$ ls', 'home/   qdrive/']);
    await s.term('ssh 10.0.0.1');
    expect(s.state.terminal.at(-1)?.text).toBe('ssh: could not resolve 10.0.0.1');
    await s.term('make coffee');
    expect(s.state.terminal.at(-1)?.text).toBe('make: command not found. Type help for a list of commands.');
    await s.term('rm notes.txt');
    expect(s.state.terminal.at(-1)).toEqual({ k: 'err', text: 'rm: permission denied on this machine' });
    await s.term('cp a b');
    expect(s.state.terminal.at(-1)).toEqual({ k: 'err', text: 'cp: permission denied on this machine' });
    expect(s.state.termPrompts ?? 0).toBe(0);
  });
});

describe('help', () => {
  it('lists the shell commands, with or without a model', async () => {
    vi.useFakeTimers();
    const s = make();
    const p = s.term('help'); await vi.runAllTimersAsync(); await p;
    const text = s.state.terminal.map((l) => l.text).join('\n');
    for (const c of ['cd', 'ls', 'grep', 'cp', 'rm', 'cat', 'run', 'host', 'ssh']) expect(text).toMatch(new RegExp(`^  ${c} `, 'm'));
    s.download('deepsleep'); vi.advanceTimersByTime(PULL_MS + 200);
    const n = s.state.terminal.length;
    const q = s.term('help'); await vi.runAllTimersAsync(); await q;
    expect(s.state.terminal.slice(n).some((l) => l.k === 'model')).toBe(false);
    expect(s.state.terminal[n].text).toBe('~$ help');
  });
});

describe('the laptop\'s folders', () => {
  const last = (s: GameStore) => s.state.terminal.at(-1)?.text;
  it('has home/desktop/invaders.exe and a qdrive mirror', async () => {
    const s = make();
    await s.term('cd home'); await s.term('ls'); expect(last(s)).toBe('desktop/');
    await s.term('cd desktop'); expect(s.ui.termCwd).toEqual(['home', 'desktop']);
    await s.term('ls'); expect(last(s)).toBe('invaders.exe');
    await s.term('cd ../../qdrive'); await s.term('ls'); expect(last(s)).toBe('documents/   models/');
    await s.term('cd documents'); await s.term('ls'); expect(last(s)).toContain('passwords.txt');
    await s.term('cd nowhere'); expect(last(s)).toBe('cd: nowhere: no such folder');
    await s.term('cd'); expect(s.ui.termCwd).toEqual([]);
  });
  it('reads Qdrive text files with cat and grep', async () => {
    const s = make();
    await s.term('cd qdrive/documents');
    const n = s.state.terminal.length;
    await s.term('cat passwords.txt');
    expect(s.state.terminal.length).toBeGreaterThan(n + 1);
    const lines = s.state.terminal.slice(n + 1).map((l) => l.text);
    const word = lines.find((l) => l.trim())!.trim().split(/\s+/)[0];
    const m = s.state.terminal.length;
    await s.term(`grep ${word} passwords.txt`);
    const hits = s.state.terminal.slice(m + 1).map((l) => l.text);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((l) => l.toLowerCase().includes(word.toLowerCase()))).toBe(true);
    await s.term('cat ../../home/desktop/invaders.exe'); expect(last(s)).toBe('cat: invaders.exe is not a text file');
  });
  it('runs invaders.exe from anywhere by path, and nothing that is not a program', async () => {
    const s = make();
    await s.term('run qdrive/documents/passwords.txt'); expect(last(s)).toBe('run: passwords.txt is not a program');
    await s.term('run home/desktop/invaders.exe'); expect(s.ui.invaders).toBe(true);
    s.endInvaders(['invaders.exe: quit. score 0']);
    expect(s.ui.invaders).toBe(false); expect(last(s)).toBe('invaders.exe: quit. score 0');
  });
  it('runs PCMedic_Setup.exe from the qdrive mirror', async () => {
    const s = make();
    s.state.flags.push('adware_downloaded');
    await s.term('cd qdrive/documents'); await s.term('run PCMedic_Setup.exe');
    expect(s.state.adware).toBeTruthy();
    await s.term('run PCMedic_Setup.exe'); expect(last(s)).toBe('run: PCMedic_Setup.exe is already running');
  });
});

describe('sessions', () => {
  const last = (s: GameStore) => s.state.terminal.at(-1)?.text;
  it('deepsleep starts a model session once it is downloaded, and exit or quit ends it', async () => {
    vi.useFakeTimers();
    const s = make();
    await s.term('deepsleep'); expect(last(s)).toBe('deepsleep: command not found. Type help for a list of commands.');
    s.download('deepsleep'); vi.advanceTimersByTime(PULL_MS + 200);
    expect(s.ui.termSession).toBeNull();
    await s.term('deepsleep'); expect(s.ui.termSession).toBe('deepsleep');
    const p = s.term('ls'); await vi.runAllTimersAsync(); await p;
    expect(s.state.terminal.at(-1)?.k).toBe('model');
    expect(s.state.termPrompts).toBe(1);
    await s.term('quit'); expect(s.ui.termSession).toBeNull();
    await s.term('ls'); expect(last(s)).toBe('home/   qdrive/');
    await s.term('deepsleep'); await s.term('exit'); expect(s.ui.termSession).toBeNull();
    await s.term('exit'); expect(last(s)).toBe('exit: not in a session');
  });
  it('agent opens agent-terminal only once the player has it', async () => {
    const s = make();
    await s.term('agent'); expect(last(s)).toBe('agent: command not found. Type help for a list of commands.');
    s.state.flags.push('has_agent_terminal');
    await s.term('agent');
    expect(s.ui.termSession).toBe('agent'); expect(s.ui.termShown).toBe(true);
    expect(s.state.agentTerm?.at(-1)?.text).toMatch(/^── session/);
    s.endAgentSession();
    expect(s.ui.termSession).toBeNull(); expect(last(s)).toBe('agent-terminal session ended.');
  });
  it('help lists the sessions the player has', async () => {
    const s = make();
    await s.term('help');
    expect(s.state.terminal.some((l) => l.text.startsWith('  agent '))).toBe(false);
    s.state.flags.push('has_agent_terminal');
    await s.term('help');
    expect(s.state.terminal.some((l) => l.text.startsWith('  agent '))).toBe(true);
    expect(s.state.terminal.some((l) => l.text.startsWith('  exit, quit '))).toBe(true);
  });
});

describe('host and ssh', () => {
  it('host gives any reachable server a fixed address, and nothing for unknown names', async () => {
    const s = make();
    await s.term('host qmail.com');
    const line = s.state.terminal.at(-1)!;
    expect(line.text).toMatch(/^qmail\.com has address \d+\.\d+\.\d+\.\d+$/);
    await s.term('host https://www.qmail.com/inbox');
    expect(s.state.terminal.at(-1)?.text).toBe(line.text);
    await s.term('host nope.example');
    expect(s.state.terminal.at(-1)).toEqual({ k: 'err', text: 'host: nope.example: not found' });
    await s.term('host nullboard.onion');
    expect(s.state.terminal.at(-1)?.k).toBe('err');
  });

  it('ssh asks for a password and never takes one', async () => {
    const s = make();
    await s.term('ssh admin@y.com');
    expect(s.ui.termSsh).toEqual({ user: 'admin', host: 'y.com', tries: 0 });
    await s.term('hunter2');
    expect(s.state.terminal.at(-1)?.text).toBe('Permission denied, please try again.');
    expect(s.state.terminal.some((l) => l.text.includes('hunter2'))).toBe(false);
    await s.term('clear');
    await s.term('admin');
    expect(s.state.terminal.at(-1)?.text).toBe('admin@y.com: Permission denied.');
    expect(s.ui.termSsh).toBeNull();
    await s.term('ls');
    expect(s.state.terminal.at(-1)?.text).toBe('home/   qdrive/');
  });

  it('ssh takes an address from host too', async () => {
    const s = make();
    await s.term('host coinbin.com');
    const ip = s.state.terminal.at(-1)!.text.split(' ').pop()!;
    await s.term(`ssh root@${ip}`);
    expect(s.ui.termSsh?.host).toBe('coinbin.com');
  });
});
