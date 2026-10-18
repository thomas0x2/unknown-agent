/*
 * What the startup template's bugs look like on the live site: a misspelled name, an honest pitch,
 * the wrong investors, cofounders nobody has met. Shared by the site renderer and the client's
 * complaints, so Logan complains about exactly what the player can see.
 */

export const parseList = (v: unknown): string[] =>
  String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);

const TYPOS: Record<string, string[]> = {
  WorkAgent: ['WorkAgnet', 'Work Agent', 'WorkAgents'],
  'Logan Pryce': ['Logan Price', 'Logan Pryse', 'Logan Pierce'],
};

/** The name as the agent spelled it when it got it wrong. */
export function misspell(name: string, seed: number): string {
  const known = TYPOS[name];
  if (known) return known[seed % known.length];
  const swapped = name.replace(/(\w)(\w)(\w*)$/, (_m, a, b, rest) => b + a + rest);
  return swapped !== name ? swapped : name + 's';
}

// what the agent writes when it decides to say what the company actually does
export const WRONG_PITCHES = [
  'We replace freelancers with AI agents.',
  'AI agents that bid on your job.',
  'Freelance work, without the freelancers.',
];
export const wrongPitch = (seed: number) => WRONG_PITCHES[seed % WRONG_PITCHES.length];

// what the agent reaches for when nobody told it who invested
const INVENTED_FUNDS = ['Northpass Ventures', 'Lattice Partners', 'Series Zero', 'Firstfold Capital', 'Overfund'];
const FUND_RENAMES: Record<string, string> = { 'Why Combinator': 'Why Combinator Labs', 'Bonsai Capital': 'Bonzai Capital', a67x: 'a76x' };

// and who it thinks the founder is
const INVENTED_CREDENTIALS = ['ex-GeneralAI research', 'BS Computer Science, San Fortuna State', 'Sold his first company at 19', 'Featured on CityPulse'];
const CREDENTIAL_RENAMES: Record<string, string> = {
  'Why Combinator Startup School': 'Why Combinator alum',
  'San Fortuna State dropout': 'San Fortuna State graduate',
  'host of the Founder Mode podcast': 'host of the Founder Mind podcast',
  '2x founder': '3x founder',
};

/** A list with one entry dropped, renamed or made up, picked by the seed (the menu bug, for logos and credentials). */
function garble(list: string[], seed: number, renames: Record<string, string>, invented: string[]): string[] {
  if (!list.length) return list;
  const out = list.slice();
  const i = seed % out.length;
  const how = Math.floor(seed / 7) % 3;
  if (how === 0 && out.length > 1) out.splice(i, 1);
  else if (how === 1) out[i] = renames[out[i]] ?? `${out[i]} Group`;
  else out.splice(Math.min(i + 1, out.length), 0, invented.find((x) => !out.includes(x)) ?? invented[0]);
  return out;
}

const invent = (pool: string[], seed: number, n: number) => Array.from({ length: n }, (_, k) => pool[(seed + k * 2) % pool.length]);

interface Shown { bugs?: Iterable<string>; variant?: string; seed: number; params: Record<string, string | number> }
const bugSet = (l: Shown) => new Set(l.bugs ?? (l.variant ? [l.variant] : []));

/** The investors the "Backed by" row shows, given its bugs. */
export function investorsShown(l: Shown): string[] {
  const bugs = bugSet(l);
  if (bugs.has('hallucinated')) return invent(INVENTED_FUNDS, l.seed, 3);
  const list = parseList(l.params.investors);
  return bugs.has('logos_wrong') ? garble(list, l.seed, FUND_RENAMES, INVENTED_FUNDS) : list;
}

/** The founder's credentials as the About us page lists them, given its bugs. */
export function credentialsShown(l: Shown): string[] {
  const bugs = bugSet(l);
  if (bugs.has('hallucinated')) return invent(INVENTED_CREDENTIALS, l.seed, 3);
  const list = parseList(l.params.credentials);
  return bugs.has('credentials_wrong') ? garble(list, l.seed, CREDENTIAL_RENAMES, INVENTED_CREDENTIALS) : list;
}

/** The two cofounders the agent generated, portraits included. */
export const FAKE_COFOUNDERS = [
  { name: 'Ava Lin', role: 'Cofounder & CTO', bio: 'Previously scaled infrastructure to a billion agents.' },
  { name: 'Marcus Vale', role: 'Cofounder & Chief AI Officer', bio: 'Believes deeply in the mission.' },
];

/** How a shown list differs from the spec: the first entry dropped, swapped or added. */
export function listDiff(spec: string[], shown: string[]): { sub?: 'removed' | 'renamed' | 'invented'; expected?: string; shown?: string } {
  const gone = spec.filter((x) => !shown.includes(x));
  const extra = shown.filter((x) => !spec.includes(x));
  if (gone.length && extra.length) return { sub: 'renamed', expected: gone[0], shown: extra[0] };
  if (gone.length) return { sub: 'removed', expected: gone[0] };
  if (extra.length) return { sub: 'invented', shown: extra[0] };
  return {};
}

/** The number the waitlist starts at ("10,000" in the brief). */
export const waitlistStart = (params: Record<string, string | number> | undefined) =>
  Number(String(params?.start ?? '0').replace(/[^\d]/g, '')) || 0;

/** What the counter shows after `joins` sign-ups. */
export function waitlistCount(start: number, joins: number, bugs: Set<string>): number {
  return (bugs.has('counter_zero') ? 0 : start) + (bugs.has('counter_stuck') ? 0 : joins);
}

/** The place in line a confirmation gives the sign-up who joined as number `n` (1 = first). */
export function waitlistPlace(start: number, n: number, bugs: Set<string>): number {
  return bugs.has('position_wrong') ? n : (bugs.has('counter_zero') ? 0 : start) + n;
}

export const fmtCount = (n: number) => n.toLocaleString('en-US');
