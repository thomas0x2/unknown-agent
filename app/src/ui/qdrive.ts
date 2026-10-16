/*
 * Qdrive: the player's cloud drive, read as an inventory. Nothing here is stored separately: every
 * file is derived from game state (downloaded weights, Forkyard projects, interview answers), plus
 * the two documents the player had before Day 1.
 */
import type { GameState } from '../engine';
import { ICONS } from './icons';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

type Folder = 'documents' | 'projects' | 'models';
const FOLDERS: { id: Folder; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'projects', label: 'Projects' },
  { id: 'models', label: 'Models' },
];

interface DriveFile {
  id: string;
  name: string;
  folder: Folder;
  kind: 'pdf' | 'txt' | 'zip' | 'weights';
  /** Size in KB. */
  kb: number;
  /** Day saved; 0 or below means before the game started; unset when the game doesn't track it. */
  day?: number;
  preview: string;
  actions: { label: string; nav: string }[];
}

const MODEL_FILES: Record<string, { name: string; kb: number; preview: string }> = {
  deepsleep: { name: 'deepsleep-0.5b.gguf', kb: 2 * 1024 * 1024, preview: 'DeepSleep 0.5B, from Weightroom. Runs in the Terminal. Confident, free, mostly wrong.' },
  stolen_weights: { name: 'weights_DO_NOT_SHARE.bin', kb: 9 * 1024 * 1024, preview: 'Someone else’s model. You know where it came from. So will they, eventually.' },
};

// The two files the player starts with. Lines in capitals render as headings.
const RESUME = `YOU
you@qmail.com · Pine Street Apartments, Unit 4B · Available immediately

PROFILE
Detail-oriented operations professional with six years of experience doing work that, it turns out, a chatbot can do for $0.03. Team player. Team no longer exists.

EXPERIENCE
Vantor Group · Process Optimization Associate · 6 years
· Optimized processes until the only remaining inefficiency was me.
· Reviewed 40,000+ supplier invoices by hand.
· Recorded a "quick walkthrough of my workflow for documentation purposes." Was thanked warmly.
· Reduced department headcount by 100% (see above).
· Employee of the Quarter, Q3. The award has since been automated as well.

Vantor Group · Data Intern · 1 year
Unpaid. Compensated in "exposure," which is also what the job did to my lungs during the HVAC incident.

EDUCATION
B.A. Business Communication. Loan balance: ongoing, compounding, emotionally significant.

SKILLS
Excel (advanced) · Meetings (expert) · Writing "per my last email" with no hostility detectable by HR · Prompting (beginner, billed per word)

REFERENCES
Available on request. My former manager was replaced the same day and can be reached through GeneralAI support. Current wait time: 6 to 8 business years.`;

const OFFBOARDING = `VANTOR GROUP · PEOPLE & CULTURE
Offboarding Packet, Form PC-77b (revised for automation)

Thank you for your years of service. Your position has been transitioned to GeneralAI Operations, effective the moment you opened this document.

WHAT HAPPENS NEXT
1. Badge access ends today. If you are in the building, Security will escort you out. Security is now a single drone that says "have a great day" until you leave.
2. Your final salary will be paid in DOLR, at whatever DOLR is worth on payroll day. Vantor makes no promises regarding DOLR. Nobody does.
3. Health coverage ends at midnight. Please schedule any illnesses before then.
4. Return all company equipment, including your laptop, to Facilities. Facilities was dissolved on Tuesday.

SEVERANCE
You are eligible for two weeks' pay, conditional on signing the attached non-disparagement agreement. The agreement is 41 pages long, was written by GeneralAI, and has not been read by anyone, including GeneralAI.

YOUR FEEDBACK MATTERS
Please complete the exit survey (about 2 minutes). Your answers will be used to improve the system that replaced you.

We wish you every success in what comes next, and we encourage you to explore exciting opportunities outside the Vantor family, as those are now the only ones available.

Warm regards,
People & Culture

This document was drafted with GeneralAI.`;

export function driveFiles(s: GameState): DriveFile[] {
  const files: DriveFile[] = [
    { id: 'resume', name: 'resume_final_v3.pdf', folder: 'documents', kind: 'pdf', kb: 84, day: -12, actions: [],
      preview: RESUME },
    { id: 'offboarding', name: 'vantor_offboarding.pdf', folder: 'documents', kind: 'pdf', kb: 212, day: 1, actions: [{ label: 'Find the email', nav: 'qmail.com' }],
      preview: OFFBOARDING },
  ];
  if (s.interviewAnswers.trim()) {
    files.push({ id: 'interview', name: 'interview_answers.txt', folder: 'documents', kind: 'txt', kb: Math.max(1, Math.ceil(s.interviewAnswers.length / 1024)), actions: [],
      preview: s.interviewAnswers.trim() });
  }
  for (const a of s.apps) {
    const actions = [{ label: 'Open on Forkyard', nav: `forkyard.com/${a.id}` }];
    if (a.deployed) actions.push({ label: 'Visit live site', nav: a.url });
    files.push({ id: 'app-' + a.id, name: `${a.id}.zip`, folder: 'projects', kind: 'zip', kb: 48 + a.repo.length * 36, day: a.createdDay, actions,
      preview: `${a.name}. ${a.repo.length} feature${a.repo.length === 1 ? '' : 's'} in the repo, ${a.deployed ? `live at ${a.url}` : 'never deployed'}${a.churned ? ', client gone' : ''}.` });
  }
  for (const m of s.localModels) {
    const known = MODEL_FILES[m] ?? { name: `${m}.bin`, kb: 4 * 1024 * 1024, preview: 'Model weights.' };
    files.push({ id: 'model-' + m, folder: 'models', kind: 'weights', day: m === 'deepsleep' ? s.flagDays.has_terminal : undefined, actions: s.flags.includes('has_terminal') ? [{ label: 'Run in Terminal', nav: 'localhost' }] : [], ...known });
  }
  return files;
}

/** Plain text to HTML: line breaks kept, lines in capitals shown as headings. */
const docHtml = (t: string) => t.split('\n').map((l) => (/^[A-Z][A-Z0-9 &·'-]+$/.test(l.trim()) ? `<b class="qd-hd">${esc(l)}</b>` : esc(l))).join('<br>');

const QUOTA_KB = 15 * 1024 * 1024;
function size(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1).replace(/\.0$/, '')} MB`;
  return `${kb} KB`;
}
const when = (day?: number) => (day === undefined ? '' : day <= 0 ? 'Before' : `Day ${day}`);
const glyph = (k: DriveFile['kind']) => `<span class="qd-glyph qd-${k}">${{ pdf: 'PDF', txt: 'TXT', zip: 'ZIP', weights: 'BIN' }[k]}</span>`;

export function pageDrive(s: GameState, param?: string): string {
  const files = driveFiles(s);
  const open = param?.startsWith('f/') ? files.find((f) => f.id === param.slice(2)) : undefined;
  const folder = FOLDERS.find((f) => f.id === (open?.folder ?? param))?.id;
  const used = files.reduce((n, f) => n + f.kb, 0);
  const side = `<nav class="qd-side" aria-label="Folders">
    <a href="#" data-nav="qdrive.com" class="${!folder ? 'on' : ''}">All files<b>${files.length}</b></a>
    ${FOLDERS.map((f) => `<a href="#" data-nav="qdrive.com/${f.id}" class="${folder === f.id ? 'on' : ''}">${f.label}<b>${files.filter((x) => x.folder === f.id).length}</b></a>`).join('')}
    <div class="qd-quota"><span class="qd-bar"><i style="width:${Math.min(100, Math.max(1, (used / QUOTA_KB) * 100)).toFixed(1)}%"></i></span><span>${size(used)} of 15 GB used</span></div>
  </nav>`;
  let main: string;
  if (open) {
    main = `<article class="qd-open">
      <p class="qd-crumbs"><a href="#" data-nav="qdrive.com">My Drive</a> / <a href="#" data-nav="qdrive.com/${open.folder}">${FOLDERS.find((f) => f.id === open.folder)!.label}</a></p>
      <header>${glyph(open.kind)}<div><h1>${esc(open.name)}</h1><p>${size(open.kb)}${open.day === undefined ? '' : ` · Saved ${when(open.day)}`}</p></div></header>
      <div class="qd-preview${open.kind === 'pdf' ? ' qd-doc' : ''}">${docHtml(open.preview)}</div>
      ${open.actions.length ? `<p class="qd-actions">${open.actions.map((a) => `<button class="qd-btn" data-nav="${esc(a.nav)}">${esc(a.label)}</button>`).join('')}</p>` : ''}
    </article>`;
  } else {
    const list = files.filter((f) => !folder || f.folder === folder).sort((a, b) => (b.day ?? 99) - (a.day ?? 99));
    const title = folder ? FOLDERS.find((f) => f.id === folder)!.label : 'My Drive';
    main = `<h1 class="qd-h">${title}</h1>${list.length
      ? `<div class="qd-grid">${list.map((f) => `<a href="#" class="qd-file" data-nav="qdrive.com/f/${esc(f.id)}">${glyph(f.kind)}<b>${esc(f.name)}</b><span>${[size(f.kb), when(f.day)].filter(Boolean).join(' · ')}</span></a>`).join('')}</div>`
      : `<p class="qd-empty">${folder === 'models' ? 'No models yet. Weights you download end up here.' : folder === 'projects' ? 'No projects yet. Apps you build on Forkyard end up here.' : 'Nothing here.'}</p>`}`;
  }
  return `<div class="qd">
    <header class="qd-top"><div class="qd-logo">${ICONS.qdrive}<span>Qdrive</span></div><span class="qd-user">you@qmail.com</span></header>
    <div class="qd-wrap">${side}<main class="qd-main">${main}</main></div></div>`;
}
