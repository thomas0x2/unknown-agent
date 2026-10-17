/*
 * Qdrive: the player's cloud drive, read as an inventory. Nothing here is stored separately: every
 * file is derived from game state (downloaded weights, Forkyard projects, interview answers), plus
 * the documents the player had before Day 1.
 */
import type { GameState } from '../engine';
import { ICONS } from './icons';
import { dateShort } from '../engine/calendar';
import { onForkyard } from '../engine/apps';
import { PASSWORDS_TXT } from '../engine/phishing';
import { vantorWordmark } from './vantor';

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
  /** a letterhead drawn above a PDF's text (markup) */
  letterhead?: string;
  actions: { label: string; nav: string }[];
}

const MODEL_FILES: Record<string, { name: string; kb: number; preview: string }> = {
  deepsleep: { name: 'deepsleep-0.5B.gguf', kb: 2 * 1024 * 1024, preview: 'deepsleep-0.5B, from Weightroom. Runs in the Terminal. Confident, free, mostly wrong.' },
  stolen_weights: { name: 'weights_DO_NOT_SHARE.bin', kb: 9 * 1024 * 1024, preview: 'Someone else’s model. You know where it came from. So will they, eventually.' },
};

// The files the player starts with. Lines in capitals render as headings.
const RESUME = `YOU
you@qmail.com · Pine Street Apartments, Unit 4B

PROFILE
Operations professional with six years of experience in invoice processing, vendor reconciliation and workflow documentation. Reliable, detail-oriented and comfortable with repetitive work.

EXPERIENCE
Vantor Group · Process Optimization Associate · 6 years
· Processed and reconciled supplier invoices for the Eastern region.
· Maintained the team's shared tracking spreadsheet.
· Documented the team's workflows step by step for the GeneralAI integration project.
· Employee of the Quarter, Q3.

Vantor Group · Data Intern · 1 year
Unpaid.

EDUCATION
B.A. Business Communication

SKILLS
Excel (advanced) · Data entry · Vendor communication · Meeting notes

REFERENCES
Available on request.`;

const OFFBOARDING = `Offboarding Packet, Form PC-77b

Thank you for your years of service. As communicated, your position has been transitioned to GeneralAI Operations, effective today.

NEXT STEPS
1. Badge access ends at 5:00 PM today.
2. Your final salary payment has already been made. No further payments are due.
3. Health coverage ends at midnight.
4. Please return your laptop to Facilities. Facilities is currently unstaffed, so keep the device until further notice.

SEVERANCE
Positions transitioned to automation are not eligible for severance under current policy (PC-77b, section 4).

EXIT SURVEY
Please complete the exit survey. Your answers help us improve our automated operations.

We wish you every success in what comes next.

People & Culture

This document was drafted with GeneralAI.`;

export function driveFiles(s: GameState): DriveFile[] {
  const files: DriveFile[] = [
    { id: 'resume', name: 'resume_final_v3.pdf', folder: 'documents', kind: 'pdf', kb: 84, day: -12, actions: [],
      preview: RESUME },
    { id: 'offboarding', name: 'vantor_offboarding.pdf', folder: 'documents', kind: 'pdf', kb: 212, day: 1, actions: [{ label: 'Find the email', nav: 'qmail.com' }],
      preview: OFFBOARDING, letterhead: `<header class="qd-letterhead vantor-lh">${vantorWordmark('People & Culture')}<span>Confidential</span></header>` },
    { id: 'passwords', name: 'passwords.txt', folder: 'documents', kind: 'txt', kb: 1, day: -40, actions: [],
      preview: PASSWORDS_TXT },
  ];
  if (s.interviewAnswers.trim()) {
    files.push({ id: 'interview', name: 'interview_answers.txt', folder: 'documents', kind: 'txt', kb: Math.max(1, Math.ceil(s.interviewAnswers.length / 1024)), actions: [],
      preview: s.interviewAnswers.trim() });
  }
  for (const a of s.apps.filter(onForkyard)) {
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
const when = (day?: number) => (day === undefined ? '' : dateShort(day));
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
      <div class="qd-preview${open.kind === 'pdf' ? ' qd-doc' : ''}">${open.letterhead ?? ''}${docHtml(open.preview)}</div>
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
