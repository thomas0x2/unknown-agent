/*
 * The browser's UI state: tabs aside, everything transient the screens keep (search boxes, open
 * forms, the last refusal under a button). One field per line, so features that each add a field
 * don't collide. A new game or a loaded save starts from freshUi().
 */

export interface Draft { to: string; subject: string; body: string }

export function freshUi() {
  return {
    ySearch: '',
    yAllDay: 0,
    yowlSearch: '',
    fySearch: '',
    reviewStars: 0,
    walletRange: '1M',
    draft: null as Draft | null,
    /** Bot posts landing as a barrage: when each shows up on Y (performance.now() ms), so a repaint keeps the timing. */
    yBurst: {} as Record<string, number>,
    project: '',
    dev: false,
    liked: {} as Record<string, boolean>,
    reposted: {} as Record<string, boolean>,
    intro: true,
    greet: false,
    memWarn: false,
    confirm: null as null | { text: string; yes: string; fn: () => void },
    start: false,
    menuCat: 'saves',
    /** The Terminal is its own window: open (in the taskbar) and shown (in front of the browser). */
    termOpen: false,
    termShown: false,
    /** Which Terminal tab is in front: the laptop's own shell (local models) or agent-terminal. */
    termTab: 'shell' as 'shell' | 'agent',
    /** The you@laptop shell's folder, from ~ down (game/shell.ts). */
    termCwd: [] as string[],
    /** invaders.exe is running in the you@laptop tab. */
    invaders: false,
    /** Dev mode: the site whose options panel is open (agent, qmail, y), or ''. */
    devOptions: '' as string,
    /** Dev: the flags and meters editor is open, and which of its tabs shows. */
    devEdit: false,
    devTab: 'edit' as 'edit' | 'jev',
    /** Coinbin's Send form: open or not, what was typed, and why the last attempt failed. */
    send: { open: false, to: '', amount: '', error: '' },
    ex: { open: false, from: 'DOLR', to: 'EURI', amount: '', error: '' },
    /** Coinbin's Create token form ($COPE, engine/cope.ts). */
    tok: { open: false, ticker: '', supply: '', error: '' },
    /** A line under Coinbin's Send/Receive buttons: "Address copied", or what was just sent. */
    cbNotice: '',
    /** Sherwood's order box: what was typed, why the last order was refused, or what it filled. */
    sw: { amount: '', error: '', notice: '' },
    /** Yowl: Post was pressed with no rating picked. */
    reviewNeedsStars: false,
    /** The save-slot menu's last failure, shown in its note. */
    slotNote: '',
    /** Qmail compose: why Send was refused before anything went out. */
    mailError: '',
    /** Qmail: the line above the list after a conversation went into or out of the Bin, with what Undo puts back. */
    mailNotice: null as null | { text: string; ids: string[]; undo: 'bin' | 'restore' },
    /** coinbln.com: why the last sign-in was refused. */
    phishError: '',
    /** prince-claims.xyz: why the last seed phrase was refused. */
    princeError: '',
    /** Coinbin: the recovery phrase is on screen. */
    seedShown: false,
    /** stack.com: the bet picked, the reels are spinning, and the last refusal or notice under the wallet. */
    stackBet: 1,
    stackSpinning: false,
    stack: { error: '', notice: '' },
    /** lonely.ai: Mia is typing. */
    lonelyTyping: false,
    /** lonely.ai / sorrywriter.ai: why the last message wasn't sent (the wallet couldn't cover it). */
    chatError: '',
    /** sorrywriter.ai: the apology is being written. */
    sorryTyping: false,
    /** Why the last upload was refused (vantor.group/next-chapter takes PDFs only). */
    uploadError: '',
    /** The file last picked for an upload, so the picker keeps it after the page redraws. */
    uploadPick: '',
    /** The file dialog an upload opens (ui/filePicker.ts): the site it uploads to, the folder shown, the file selected. */
    filePick: null as { site: string; folder: string; file: string } | null,
    /** An upload is being processed (site, and Date.now() when it started): the site's loading animation runs before its result shows. */
    uploading: null as { site: string; at: number } | null,
    /** An ad site's working button: the line under it (rentboard.gov's appeal). */
    adNotice: '',
    /** An action Jev was needed for and couldn't be reached: why, and the text to put back in its box. */
    jevOffline: null as { reason: string; field?: string; text?: string } | null,
    /** Y posts by others that went up since the player last looked at the timeline, for the Y tab's badge. */
    yUnread: 0,
  };
}

export type Ui = ReturnType<typeof freshUi>;
