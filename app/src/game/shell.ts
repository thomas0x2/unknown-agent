/**
 * The you@laptop shell's own commands, there from day 1 with or without a model, and the laptop's
 * folders they walk: ~ holds home/ (just a desktop with invaders.exe) and qdrive/, a mirror of Qdrive.
 */
import type { GameState } from '../engine';
import { driveFiles, type DriveFile } from '../ui/qdrive';
import type { TermLine } from './pull';
import { SITES } from '../sites/registry';
import { AD_SITES } from '../sites/adSites';

export const SHELL_HELP: readonly string[] = [
  'Commands:',
  '  cd <folder>          go into a folder (cd .. goes back up)',
  '  ls                   list what is in this folder',
  '  cat <file>           show what is in a file',
  '  grep <word> <file>   show the lines of a file that contain a word',
  '  cp <file> <copy>     copy a file',
  '  rm <file>            delete a file',
  '  run <file>           start a program (.exe)',
  '  host <name>          look up the address of a server',
  '  ssh <user>@<name>    log in to another computer',
  '  clear                wipe the screen',
];

/** The sessions the shell can start, like `claude` in a real one: a local model, or agent-terminal. */
export type Session = 'deepsleep' | 'agent';
/** The help lines for the sessions the player has. */
function sessionHelp(s: GameState): string[] {
  const out: string[] = [];
  if (s.localModels.includes('deepsleep')) out.push('  deepsleep            start a deepsleep-0.5B session');
  if (s.flags.includes('has_agent_terminal')) out.push('  agent                start an agent-terminal session');
  if (out.length) out.push('  exit, quit           end the session');
  return out;
}

const COMMANDS = ['cd', 'ls', 'cat', 'grep', 'cp', 'rm', 'run', 'host', 'ssh'];
/** Not allowed on the player's own laptop (they work on other computers, over ssh). */
const LOCKED = ['cp', 'rm'];

/** A program the shell can start: a mini-game, or something that already exists in the game. */
export type Program = 'invaders' | 'pcmedic';

/** A file in the laptop's folders. */
export interface LocalFile { name: string; kind: DriveFile['kind']; text: string; program?: Program }
/** A folder: subfolders by name, and files. */
export interface LocalDir { dirs: Record<string, LocalDir>; files: LocalFile[] }

const INVADERS: LocalFile = { name: 'invaders.exe', kind: 'exe', text: '', program: 'invaders' };

/** The laptop's folders as they stand: qdrive/ follows Qdrive, folder by folder. */
export function localTree(s: GameState): LocalDir {
  const drive: LocalDir = { dirs: {}, files: [] };
  for (const f of driveFiles(s)) {
    const dir = (drive.dirs[f.folder] ??= { dirs: {}, files: [] });
    dir.files.push({ name: f.name, kind: f.kind, text: f.preview, ...(f.id === 'pcmedic' ? { program: 'pcmedic' as const } : {}) });
  }
  for (const id of ['documents', 'models']) drive.dirs[id] ??= { dirs: {}, files: [] };
  return { dirs: { home: { dirs: { desktop: { dirs: {}, files: [INVADERS] } }, files: [] }, qdrive: drive }, files: [] };
}

/** The folder at a path (names from ~ down), or null. */
function dirAt(root: LocalDir, path: readonly string[]): LocalDir | null {
  let d: LocalDir | undefined = root;
  for (const p of path) { d = d?.dirs[p]; if (!d) return null; }
  return d;
}

/** A path typed after cd, read against the current folder: "..", "~", "/", "a/b" and "~/a" all work. */
function resolve(cwd: readonly string[], arg: string): string[] {
  const out = arg.startsWith('~') || arg.startsWith('/') ? [] : [...cwd];
  for (const p of arg.replace(/^~/, '').split('/')) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  return out;
}

/** A file named in the current folder, or by a path to one. */
function fileAt(root: LocalDir, cwd: readonly string[], arg: string): LocalFile | null {
  const path = resolve(cwd, arg);
  const name = path.pop();
  return dirAt(root, path)?.files.find((f) => f.name.toLowerCase() === name?.toLowerCase()) ?? null;
}

/** How the prompt shows a folder: ~, ~/home/desktop… */
export const cwdLabel = (cwd: readonly string[]) => ['~', ...cwd].join('/');

/** A server's name as typed: no scheme, no www, no path. */
const hostOf = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

/** Every server name the player could reach right now: the sites, the ad sites, and the deployed apps. */
function knownHosts(s: GameState): string[] {
  const out = new Set<string>(['localhost']);
  for (const d of SITES) if (d.reachable(s)) out.add(hostOf(d.base));
  for (const a of AD_SITES) out.add(hostOf(a.url));
  for (const a of s.apps) if (a.deployed) out.add(hostOf(a.url));
  return [...out];
}

/** A server's address: made up, but the same every time for the same name. */
export function addressOf(host: string): string {
  if (host === 'localhost') return '127.0.0.1';
  let h = 2166136261;
  for (const c of host) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const b = (n: number) => (h >>> n) & 255;
  return `${11 + (b(24) % 212)}.${b(16)}.${b(8)}.${1 + (b(0) % 254)}`;
}

/** The server a name or an address points at, or null. */
function findHost(s: GameState, arg: string): string | null {
  const want = hostOf(arg);
  return knownHosts(s).find((h) => h === want || addressOf(h) === want) ?? null;
}

/** An ssh login waiting for its password. No password works on these servers. */
export interface SshLogin { user: string; host: string; tries: number }
const SSH_TRIES = 3;
/** The password prompt for a login. */
export const sshPrompt = (l: SshLogin) => `${l.user}@${l.host}'s password:`;

/** A password typed at an ssh prompt: always wrong. Returns the login still waiting, or null once it gives up. */
export function sshPassword(l: SshLogin): { lines: TermLine[]; login: SshLogin | null } {
  const tries = l.tries + 1;
  if (tries < SSH_TRIES) return { lines: [{ k: 'err', text: 'Permission denied, please try again.' }], login: { ...l, tries } };
  return { lines: [{ k: 'err', text: `${l.user}@${l.host}: Permission denied.` }], login: null };
}

export interface ShellResult { lines: TermLine[]; cwd?: string[]; run?: Program; session?: Session; ssh?: SshLogin }

/** The shell's answer to a command typed at the you@laptop prompt (inside a session the session gets it instead). */
export function shellLines(text: string, s: GameState, cwd: readonly string[] = []): ShellResult {
  const [cmd = '', ...args] = text.trim().split(/\s+/);
  const lines: TermLine[] = [{ k: 'in', text: `${cwdLabel(cwd)}$ ${text}` }];
  const err = (t: string): ShellResult => ({ lines: [...lines, { k: 'err', text: t }] });
  const out = (ts: string[]): ShellResult => ({ lines: [...lines, ...ts.map((t) => ({ k: 'sys' as const, text: t }))] });
  if (cmd === 'help') return out([...SHELL_HELP, ...sessionHelp(s)]);
  if (cmd === 'deepsleep' && s.localModels.includes('deepsleep')) return { lines, session: 'deepsleep' };
  if (cmd === 'agent' && s.flags.includes('has_agent_terminal')) {
    return s.suspended ? err('agent: account suspended (GeneralAI Trust & Safety)') : { lines, session: 'agent' };
  }
  if (cmd === 'exit' || cmd === 'quit') return err(`${cmd}: not in a session`);
  if (!COMMANDS.includes(cmd)) return err(`${cmd}: command not found. Type help for a list of commands.`);
  if (LOCKED.includes(cmd)) return err(`${cmd}: permission denied on this machine`);
  const root = localTree(s);
  const here = dirAt(root, cwd) ?? root;
  if (cmd === 'ls') {
    const target = args[0] ? dirAt(root, resolve(cwd, args[0])) : here;
    if (!target) return err(`ls: ${args[0]}: no such folder`);
    const names = [...Object.keys(target.dirs).map((d) => d + '/'), ...target.files.map((f) => f.name)];
    return out(names.length ? [names.join('   ')] : []);
  }
  if (cmd === 'cd') {
    const path = resolve(cwd, args[0] ?? '~');
    if (!dirAt(root, path)) return err(`cd: ${args[0]}: no such folder`);
    return { lines, cwd: path };
  }
  if (cmd === 'cat' || cmd === 'grep' || cmd === 'run') {
    const want = cmd === 'grep' ? args[1] : args[0];
    if (!want || (cmd === 'grep' && !args[0])) return err(cmd === 'grep' ? 'grep: give a word and a file' : `${cmd}: give a file`);
    const f = fileAt(root, cwd, want);
    if (!f) return err(dirAt(root, resolve(cwd, want)) ? `${cmd}: ${want} is a folder` : `${cmd}: ${want}: no such file`);
    if (cmd === 'run') {
      if (f.program === 'pcmedic' && s.adware) return err(`run: ${f.name} is already running`);
      return f.program ? { lines, run: f.program } : err(`run: ${f.name} is not a program`);
    }
    if (f.kind !== 'txt' && f.kind !== 'pdf') return err(`${cmd}: ${f.name} is not a text file`);
    const fileLines = f.text.split('\n');
    if (cmd === 'cat') return out(fileLines);
    const word = args[0].toLowerCase();
    return out(fileLines.filter((l) => l.toLowerCase().includes(word)));
  }
  if (cmd === 'host') {
    if (!args[0]) return err('host: give a server name');
    const host = findHost(s, args[0]);
    return host ? out([`${host} has address ${addressOf(host)}`]) : err(`host: ${hostOf(args[0])}: not found`);
  }
  // ssh
  if (!args[0]) return err('ssh: give a server, like ssh admin@example.com');
  const at = args[0].lastIndexOf('@');
  const user = at > 0 ? args[0].slice(0, at) : 'you';
  const name = at >= 0 ? args[0].slice(at + 1) : args[0];
  const host = findHost(s, name);
  if (!host) return err(`ssh: could not resolve ${hostOf(name) || name}`);
  return { lines, ssh: { user, host, tries: 0 } };
}
