/**
 * The you@laptop shell's own commands, there from day 1 with or without a model.
 * Only `help` does anything yet; the rest are listed for the hacking mini-games.
 */
import type { TermLine } from './pull';

export const SHELL_HELP: readonly string[] = [
  'Commands:',
  '  cd <folder>          go into a folder',
  '  ls                   list what is in this folder',
  '  cat <file>           show what is in a file',
  '  grep <word> <file>   show the lines of a file that contain a word',
  '  cp <file> <copy>     copy a file',
  '  rm <file>            delete a file',
  '  host <name>          look up the address of a server',
  '  ssh <address>        log in to another computer',
  '  clear                wipe the screen',
];

const COMMANDS = ['cd', 'ls', 'cat', 'grep', 'cp', 'rm', 'host', 'ssh'];
/** Not allowed on the player's own laptop (they work on other computers, over ssh). */
const LOCKED = ['cp', 'rm'];

/** The shell's answer to a command, or null when it isn't one (a model, if running, gets it instead). */
export function shellLines(text: string, hasModel: boolean): TermLine[] | null {
  const cmd = text.trim().split(/\s+/)[0];
  if (cmd === 'help') return [{ k: 'in', text: `$ ${text}` }, ...SHELL_HELP.map((t) => ({ k: 'sys' as const, text: t }))];
  if (LOCKED.includes(cmd)) return [{ k: 'in', text: `$ ${text}` }, { k: 'err', text: `${cmd}: permission denied on this machine` }];
  if (COMMANDS.includes(cmd)) return [{ k: 'in', text: `$ ${text}` }, { k: 'err', text: `${cmd}: nothing to work with here yet` }];
  if (!hasModel) return [{ k: 'in', text: `$ ${text}` }, { k: 'err', text: `${cmd}: command not found. Type help for a list of commands.` }];
  return null;
}
