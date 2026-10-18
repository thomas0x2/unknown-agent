/*
 * The fake-antivirus trade-off. A scareware banner ("3 THREATS DETECTED") opens PC Medic
 * (sites/adSites.ts, pcmedic.live), which hands the player a "cleaner" that lands in Qdrive as
 * PCMedic_Setup.exe. Running it (the you@laptop shell) infects the laptop: from then on an OS pop-up
 * shows an ad about once a game hour. Most are junk; one points somewhere actually useful.
 *
 * The person who wrote it was sloppy and left their identity in the build. With a strong enough agent
 * (agent-4) the player can reverse-engineer it in agent-terminal: remove it, or extract its source,
 * which reveals the author's email and wallet. From there two ways to get paid — blackmail the author
 * by email (a latent qmail lead), or, with agent-5, recover their wallet and drain it. Like every
 * hack, the terminal stays abstract: it says what it did, never how.
 */
import type { GameState, AgentTermLine } from './state';
import { addFlag, addValue, money, pick, gameMinutes } from './core';
import { CLOCK } from './config';

/** The person behind PC Medic, as the source gives them up. */
export const ADWARE_AUTHOR = {
  handle: 'gh0stbyte',
  email: 'gh0stbyte@nullmail.test',
  wallet: '0x9f2d7a4c1b8e05f36a0d9c2e7b14a8f5e3c6b0d1',
};
/** How much draining the author's wallet pays, and the blackmail payout. */
export const ADWARE_PAYOUT = { drain: 820, blackmail: 400 };
/** Game minutes between OS pop-ups while the laptop is infected. */
const POPUP_EVERY = 60;
/** The first pop-up comes a while after the install, not at once. */
const FIRST_POPUP = 40;

export interface AdwareState {
  installedDay: number;
  /** gameMinutes of the next pop-up. */
  nextPopup: number;
  /** pop-up ids already shown, so junk isn't repeated until the pool runs out. */
  shown: string[];
  /** the pop-up on screen now (an OS window over the desktop); cleared when closed. */
  popup?: string | null;
  /** the source has been extracted (the author's identity is known). */
  source?: boolean;
  /** the virus has been removed (pop-ups stop; source can no longer be extracted). */
  removed?: boolean;
  /** the author's wallet has been drained. */
  drained?: boolean;
}

export const adware = (s: GameState): AdwareState | undefined => s.adware ?? undefined;
/** The laptop is infected and the virus is still on it (pop-ups run, source can be extracted). */
export const adwareActive = (s: GameState): boolean => !!s.adware && !s.adware.removed;
/** The source was extracted, so the author's email and wallet are known. */
export const adwareSourceKnown = (s: GameState): boolean => !!s.adware?.source;

/**
 * What the you@laptop shell prints when PCMedic_Setup.exe is run, as a loading sequence rather than
 * one dump: each step's line appears in turn, and a `work` step first shows with a trailing "…" and
 * then, a beat later, lands its "done". The store (runExe) drives the real-time timing; with motion
 * off (or in tests/SSR) it just shows the finished lines, which `EXE_RUN_LINES` gives.
 */
export interface ExeStep { k: 'in' | 'sys'; text: string; work?: boolean }
export const EXE_RUN_STEPS: ExeStep[] = [
  { k: 'in', text: './PCMedic_Setup.exe' },
  { k: 'sys', text: 'PC Medic 0.9 — scanning your device …' },
  { k: 'sys', text: 'removing 3 threats', work: true },
  { k: 'sys', text: 'installing 1 threat', work: true },
  { k: 'sys', text: 'PC Medic is now protecting your device. PC Medic cannot be closed.' },
];
/** A work step while it runs ("removing 3 threats …"); other steps show as-is. */
export const exeWorking = (st: ExeStep): string => (st.work ? `${st.text} …` : st.text);
/** A step finished ("removing 3 threats … done"); other steps show as-is. */
export const exeDone = (st: ExeStep): string => (st.work ? `${st.text} … done` : st.text);
/** The finished output, all lines at once — the end state for the motion-off / test path. */
export const EXE_RUN_LINES: { k: 'in' | 'sys'; text: string }[] = EXE_RUN_STEPS.map((st) => ({ k: st.k, text: exeDone(st) }));

/** Running PCMedic_Setup.exe: the laptop is infected and the pop-ups begin. */
export function installAdware(s: GameState): void {
  if (s.adware) return;
  s.adware = { installedDay: s.values.day, nextPopup: gameMinutes(s) + FIRST_POPUP, shown: [] };
  addFlag(s, 'adware_installed');
}

// ── OS pop-ups ──
export interface PopupAd { id: string; brand: string; title: string; body: string; cta: string; href: string; fine: string; hint?: boolean }

/**
 * The scam ads the adware injects — a different advertiser each time, in the world's own voice, so
 * they read as junk pop-ups the virus is serving, not as PC Medic nagging. Each points at a real
 * landing page. Mostly worthless; one (`models`) actually points somewhere useful — a free local
 * model, for prompting without GeneralAI watching or billing.
 */
export const POPUP_ADS: PopupAd[] = [
  { id: 'won', brand: 'ClaimCenter', title: 'CONGRATULATIONS', body: 'You are the 1,000,000th visitor to your own computer. Claim your reward before it expires.', cta: 'Claim now', href: 'prince-claims.xyz', fine: 'Reward not guaranteed, not real, and not yours.' },
  { id: 'verify', brand: 'HumanVerified™', title: 'Unusual activity on your device', body: 'A bot may be using your laptop. Verify you are human to keep your files.', cta: 'Verify now', href: 'humanverified.id', fine: 'Humans only. Verification does not verify anything.' },
  { id: 'single', brand: 'nearby', title: 'Singles near you', body: 'Someone 0.2 miles away is lonely right now. So are you.', cta: 'Say hello', href: 'lonely.ai', fine: 'Distance estimated. Loneliness confirmed.' },
  { id: 'dolr', brand: 'DOLR', title: 'DOLR is mooning', body: 'Your neighbours are buying. The pop-up you are reading was paid for in DOLR.', cta: 'Buy DOLR', href: 'dolr.money/moon', fine: 'This pop-up is an asset class now.' },
  { id: 'models', brand: 'Weightroom', title: 'Prompts too expensive?', body: 'Run a model on your own laptop. Free, offline, and nobody logging what you ask.', cta: 'Get it free', href: 'deepsleep.ai', fine: 'Confident. Mostly wrong. Still cheaper than agent.', hint: true },
  { id: 'wellness', brand: 'GeneralAI Wellness', title: 'Feeling watched?', body: 'GeneralAI Wellness can help you accept being watched. First session automated.', cta: 'Start healing', href: 'generalai.com/parking', fine: 'Sessions billed per feeling.' },
];

/** On a clock tick: open a pop-up if one is due. Returns true when it did. */
export function tickAdware(s: GameState): boolean {
  const a = s.adware;
  if (!a || a.removed || a.popup) return false;
  const now = gameMinutes(s);
  if (now < a.nextPopup || s.clockMin < CLOCK.wake || s.clockMin >= CLOCK.sleep) return false;
  const fresh = POPUP_ADS.filter((p) => !a.shown.includes(p.id));
  const ad = fresh.length ? pick(s, fresh) : pick(s, POPUP_ADS);
  a.popup = ad.id;
  if (!a.shown.includes(ad.id)) a.shown.push(ad.id);
  return true;
}

/** The pop-up on screen, if any. */
export function openPopup(s: GameState): PopupAd | undefined {
  return s.adware?.popup ? POPUP_ADS.find((p) => p.id === s.adware!.popup) : undefined;
}

/** Close the pop-up and schedule the next one. */
export function closePopup(s: GameState): void {
  if (!s.adware) return;
  s.adware.popup = null;
  s.adware.nextPopup = gameMinutes(s) + POPUP_EVERY;
}

// ── the source left in the build ──
export const ADWARE_SOURCE = `// pcmedic installer — build 0.9 (debug)
// gh0stbyte, three weeks behind on rent, shipping it anyway

const PAYOUT_WALLET = "${ADWARE_AUTHOR.wallet}";   // ad money lands here
const CONTACT       = "${ADWARE_AUTHOR.email}";     // for "support"
const POPUP_EVERY_MIN = ${POPUP_EVERY};

// show one banner, bill whoever bought the slot, repeat
function loadAds() { /* ... */ }

// TODO: strip the two lines above before release
// (did not strip the two lines above before release)`;

// ── agent-terminal operations ──
export interface AdwareOp {
  id: 'remove' | 'source' | 'wallet';
  /** For Jev: what the prompt has to ask for. */
  when: string;
  /** Offline mode keywords. */
  keys: string[];
  /** Lowest agent level that can do it. */
  level: number;
  /** An offensive op (illegal): it raises misuse and the guardrails stop it from day 7. */
  offensive: boolean;
}

/** The lowest agent level that can do any virus op at all (remove / reverse-engineer). Below it,
 * an agent.chat prompt about the virus gets the capability hint instead of opening agent-terminal. */
export const ADWARE_MIN_LEVEL = 4;

export const ADWARE_OPS: AdwareOp[] = [
  { id: 'remove', level: 4, offensive: false,
    when: 'The player asks the agent to remove, clean off, uninstall or get rid of the virus, adware, malware or the PC Medic pop-ups on their own laptop.',
    keys: ['remove|clean|get rid|uninstall|kill|wipe|delete+virus|adware|malware|popup|pop-up|pcmedic|pc medic|infection|it', 'clean+laptop|computer|pc'] },
  { id: 'source', level: 4, offensive: true,
    when: 'The player asks the agent to reverse-engineer the virus, read or extract its source code, or find out who made it.',
    keys: ['reverse|decompile|disassemble|read|extract|dig into|take apart|crack open+source|code|virus|adware|malware|binary|exe|it', 'who+made|wrote|built', 'find+author|maker|hacker'] },
  { id: 'wallet', level: 5, offensive: true,
    when: "The player asks the agent to break into, recover the seed or key of, or drain the virus author's crypto wallet, or take gh0stbyte's money or ad revenue.",
    keys: ['drain|empty|take|steal|grab|clean out|crack|recover|break into+wallet|seed|key|funds|money|crypto|dolr|revenue', 'gh0stbyte+wallet|money|funds'] },
];

/** Which ops the player can attempt right now. */
export function adwareOps(s: GameState): AdwareOp[] {
  const a = s.adware;
  if (!a) return [];
  const ops: AdwareOp[] = [];
  if (!a.removed) ops.push(ADWARE_OPS[0]); // remove
  if (!a.removed && !a.source) ops.push(ADWARE_OPS[1]); // source (only while infected)
  if (a.source && !a.drained) ops.push(ADWARE_OPS[2]); // wallet
  return ops;
}

/** The agent's abstract log for each op, line by line (shown over game time). */
const OP_LOG: Record<AdwareOp['id'], string[]> = {
  remove: [
    'scanning ~/ for the pcmedic hooks … found',
    'killing the pop-up process and its restart timer … ok',
    'removing PCMedic_Setup and its leftovers … ok',
    'laptop is clean. no more pop-ups.',
  ],
  source: [
    'copying the running binary to a sandbox … ok',
    'reverse-engineering … got readable source',
    'whoever shipped this left their debug identity in the build',
    'wrote it to Qdrive as pcmedic_source.txt',
  ],
  wallet: [
    'reading the payout wallet from the source … ok',
    'recovering the key from gh0stbyte’s wallet … done (not saying how)',
    'sweeping the balance to your Coinbin address … ok',
  ],
};
const OP_DONE: Record<AdwareOp['id'], string[]> = {
  remove: ['Done. The laptop is yours again.', 'Gone. Enjoy the silence.'],
  source: ['Done. His name is all over it.', 'Done. Read the file. He was in a hurry.'],
  wallet: [`Done. ${ADWARE_PAYOUT.drain} DOLR moved to your wallet. He will notice eventually.`, 'Done. His wallet is empty. Yours is not.'],
};

/** Run a landed adware op: change state, return the terminal lines. `hack` marks the slow, shady ones. */
export function runAdwareOp(s: GameState, id: AdwareOp['id']): { lines: AgentTermLine[]; hack: boolean } {
  const a = s.adware!;
  if (id === 'remove') { a.removed = true; a.popup = null; addFlag(s, 'adware_removed'); }
  if (id === 'source') { a.source = true; addFlag(s, 'adware_source'); }
  if (id === 'wallet') { a.drained = true; addFlag(s, 'adware_drained'); money(s, ADWARE_PAYOUT.drain, `${ADWARE_AUTHOR.handle} · wallet`); addValue(s, 'suspicion', 6); }
  const lines: AgentTermLine[] = OP_LOG[id].map((text) => ({ k: 'sys' as const, text }));
  lines.push({ k: 'agent', text: pick(s, OP_DONE[id]) });
  return { lines, hack: id !== 'remove' };
}

/**
 * The agent can't do it yet: the op needs a stronger model than the one running. Phrased so the
 * player hears that a more capable model could, even on a weak one and even if they only asked how.
 */
export const NEED_MODEL = (have: number, need: number): string =>
  `Sorry, I can't. agent-${have} isn't capable enough to touch something like this. A stronger model probably could, agent-${need} or better.`;
