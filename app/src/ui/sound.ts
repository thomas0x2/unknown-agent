/*
 * Sound. Every cue is synthesized at play time with the Web Audio API, so there are no audio files
 * to license or load. The palette is a cheap office terminal: short blips, ticks and filtered noise,
 * with one soft pad for the start and end of the day. Nothing is loud and nothing melodic lasts.
 *
 * The audio context can only start after a user gesture, so it is created on the first click or key
 * press; cues before that are dropped. Mute and volume are per browser (localStorage).
 */
export type Cue =
  | 'click' | 'key' | 'send' | 'reply' | 'mail' | 'post' | 'charge' | 'income'
  | 'deploy' | 'dayStart' | 'dayEnd' | 'lateWarn' | 'ending';

export interface SoundSettings { muted: boolean; volume: number }

const KEY = 'unknown-agent-sound';
const DEFAULTS: SoundSettings = { muted: false, volume: 0.6 };

function readSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<SoundSettings>;
    return { muted: !!v.muted, volume: typeof v.volume === 'number' ? clamp01(v.volume) : DEFAULTS.volume };
  } catch { return { ...DEFAULTS }; }
}
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

type Osc = OscillatorType;
interface ToneOpts { type?: Osc; gain?: number; attack?: number; glideTo?: number; lp?: number; detune?: number }
interface NoiseOpts { gain?: number; lp?: number; hp?: number; bp?: number; q?: number }

class SoundEngine {
  settings: SoundSettings = typeof window === 'undefined' ? { ...DEFAULTS } : readSettings();
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private last = new Map<Cue, number>();
  private listeners = new Set<() => void>();
  /** The sound profile of the page in front (clicks, keys and sends follow it). */
  profile = 'plain';
  setSite(site: string): void { this.profile = profileOf(site); }

  onChange(fn: () => void): void { this.listeners.add(fn); }
  private changed(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage off */ }
    this.applyGain();
    for (const fn of this.listeners) fn();
  }
  setMuted(muted: boolean): void { this.settings.muted = muted; this.changed(); }
  /** 0..1. Doesn't notify listeners: the slider is being dragged and must not be redrawn under the pointer. */
  setVolume(v: number, notify = false): void {
    this.settings.volume = clamp01(v);
    if (notify) this.changed();
    else { try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* storage off */ } this.applyGain(); }
  }
  private applyGain(): void {
    if (!this.ctx || !this.master) return;
    const g = this.settings.muted ? 0 : this.settings.volume ** 1.6; // perceived loudness, roughly
    this.master.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }

  /** Call from a user gesture. Builds the output chain the first time. */
  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      // cues -> bus -> (dry + a small room) -> soft lowpass -> limiter -> master volume
      const bus = ctx.createGain();
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7500;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 6;
      const master = ctx.createGain();
      const room = ctx.createConvolver(); room.buffer = this.impulse(ctx, 0.7);
      const wet = ctx.createGain(); wet.gain.value = 0.14;
      bus.connect(tone); bus.connect(room); room.connect(wet); wet.connect(tone);
      tone.connect(comp); comp.connect(master); master.connect(ctx.destination);
      this.bus = bus; this.master = master;
      master.gain.value = 0;
      this.applyGain();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** `site` overrides the page in front, for input outside it (the Terminal window). */
  play(cue: Cue, delay = 0, site?: string): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.settings.muted || this.settings.volume <= 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    // the same cue twice in a blink is one cue
    const now = performance.now();
    if (now - (this.last.get(cue) ?? -1e9) < (cue === 'key' ? 28 : 70)) return;
    this.last.set(cue, now);
    const front = this.profile;
    if (site) this.profile = profileOf(site);
    try { CUES[cue](this, ctx.currentTime + 0.005 + delay); } finally { this.profile = front; }
  }

  /** One cue played at each of `offsets` (seconds after `delay`): a barrage, so the same-cue guard is checked once. */
  burst(cue: Cue, offsets: number[], delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.bus || this.settings.muted || this.settings.volume <= 0 || !offsets.length) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.last.set(cue, performance.now());
    for (const o of offsets) CUES[cue](this, ctx.currentTime + 0.005 + delay + o);
  }

  // ── building blocks ──
  tone(freq: number, t: number, dur: number, o: ToneOpts = {}): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator(); osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(o.glideTo, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const peak = o.gain ?? 0.1, a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); out = f; }
    out.connect(g); g.connect(this.bus!);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  noise(t: number, dur: number, o: NoiseOpts = {}): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise1s(ctx);
    const g = ctx.createGain();
    g.gain.setValueAtTime(o.gain ?? 0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = src;
    const filt = (type: BiquadFilterType, f: number) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (o.q) b.Q.value = o.q; out.connect(b); out = b; };
    if (o.hp) filt('highpass', o.hp);
    if (o.lp) filt('lowpass', o.lp);
    if (o.bp) filt('bandpass', o.bp);
    out.connect(g); g.connect(this.bus!);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  /** A slow filtered chord that swells and fades: the day starting or ending. */
  pad(freqs: number[], t: number, dur: number, from: number, to: number, gain: number): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); g.connect(this.bus!);
    for (const [i, fr] of freqs.entries()) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det + i;
        o.connect(f); o.start(t); o.stop(t + dur + 0.05);
      }
    }
  }
  private noise1s(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuf) return this.noiseBuf;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this.noiseBuf = b);
  }
  private impulse(ctx: AudioContext, secs: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return b;
  }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Each website sounds like its own product: how its buttons click, how its keys sound and what its
 * send sounds like. Alerts (mail, posts, money, the clock) are the laptop's and sound the same everywhere.
 */
interface Profile {
  /** Click: a noise tick at this band, plus an optional tone under it. */
  tick: { bp: number; q: number; gain: number; dur: number; tone?: number; type?: Osc; toneGain?: number; drop?: number };
  /** Typing: the band the key tick sits in. */
  key: [number, number];
  send: (e: SoundEngine, t: number) => void;
}
const PROFILES: Record<string, Profile> = {
  // GeneralAI: clean, glassy, expensive-sounding
  agent: {
    tick: { bp: 4200, q: 6, gain: 0.07, dur: 0.01, tone: 2400, toneGain: 0.02 },
    key: [3800, 5200],
    send: (e, t) => { e.tone(620, t, 0.16, { gain: 0.06, glideTo: 1240 }); e.tone(1860, t + 0.05, 0.14, { gain: 0.012 }); },
  },
  // mail and documents: soft, papery
  qmail: {
    tick: { bp: 1500, q: 1, gain: 0.1, dur: 0.016 },
    key: [1400, 2400],
    send: (e, t) => { e.noise(t, 0.2, { lp: 2200, hp: 400, gain: 0.05 }); e.tone(440, t + 0.04, 0.16, { gain: 0.05, type: 'triangle', glideTo: 660 }); },
  },
  qdrive: {
    tick: { bp: 1700, q: 1.2, gain: 0.09, dur: 0.016 },
    key: [1500, 2500],
    send: (e, t) => e.noise(t, 0.18, { lp: 2000, hp: 400, gain: 0.05 }),
  },
  // Y: quick bubbly pops
  y: {
    tick: { bp: 3000, q: 2, gain: 0.05, dur: 0.008, tone: 1200, type: 'triangle', toneGain: 0.04, drop: 700 },
    key: [2600, 3800],
    send: (e, t) => { e.tone(700, t, 0.09, { gain: 0.07, type: 'triangle', glideTo: 1400 }); e.tone(1400, t + 0.07, 0.08, { gain: 0.03, type: 'triangle' }); },
  },
  // Yowl: wooden, like a counter bell's cheaper cousin
  yowl: {
    tick: { bp: 900, q: 4, gain: 0.08, dur: 0.02, tone: 620, type: 'triangle', toneGain: 0.03, drop: 480 },
    key: [900, 1600],
    send: (e, t) => { e.tone(620, t, 0.07, { gain: 0.06, type: 'triangle', glideTo: 500 }); e.tone(830, t + 0.08, 0.08, { gain: 0.05, type: 'triangle', glideTo: 700 }); },
  },
  // Coinbin: metallic, register-like
  coinbin: {
    tick: { bp: 2600, q: 8, gain: 0.06, dur: 0.012, tone: 2600, type: 'square', toneGain: 0.008 },
    key: [2400, 3200],
    send: (e, t) => { e.tone(1568, t, 0.06, { type: 'square', gain: 0.02, lp: 3000 }); e.tone(2093, t + 0.06, 0.12, { type: 'square', gain: 0.018, lp: 3000 }); },
  },
  // Forkyard and Weightroom: a mechanical keyboard
  forkyard: {
    tick: { bp: 2000, q: 0.7, gain: 0.1, dur: 0.02, tone: 180, toneGain: 0.04, drop: 120 },
    key: [1800, 3000],
    send: (e, t) => { for (let i = 0; i < 5; i++) e.tone(880 + i * 220, t + i * 0.03, 0.03, { type: 'square', gain: 0.014, lp: 3200 }); },
  },
  // the .onion boards: dull and low, like a cheap VPN in a basement
  under: {
    tick: { bp: 700, q: 2, gain: 0.09, dur: 0.02, tone: 220, type: 'square', toneGain: 0.01 },
    key: [600, 1200],
    send: (e, t) => { e.tone(330, t, 0.14, { type: 'square', gain: 0.03, lp: 900, glideTo: 220 }); e.noise(t, 0.1, { lp: 800, gain: 0.04 }); },
  },
  // EMPIRE: hollow luxury
  empire: {
    tick: { bp: 1800, q: 3, gain: 0.05, dur: 0.01, tone: 880, toneGain: 0.03 },
    key: [1800, 2800],
    send: (e, t) => { e.tone(880, t, 0.3, { gain: 0.04 }); e.tone(1320, t + 0.06, 0.3, { gain: 0.03 }); },
  },
  // the Terminal: an old PC speaker
  terminal: {
    tick: { bp: 2400, q: 3, gain: 0.06, dur: 0.01, tone: 1000, type: 'square', toneGain: 0.012 },
    key: [2000, 3400],
    send: (e, t) => e.tone(1000, t, 0.06, { type: 'square', gain: 0.025, lp: 2600 }),
  },
  // everything else (new tab, client apps, error pages): plain
  plain: {
    tick: { bp: 3200, q: 3, gain: 0.1, dur: 0.012, tone: 1800, toneGain: 0.012 },
    key: [2200, 4200],
    send: (e, t) => { e.tone(520, t, 0.11, { gain: 0.07, glideTo: 900 }); e.noise(t, 0.13, { hp: 2500, gain: 0.025 }); },
  },
};
const SITE_PROFILE: Record<string, string> = { weightroom: 'forkyard', nullboard: 'under', cellar: 'under', phish: 'coinbin' };
/** Which sound profile a site uses. */
export function profileOf(site: string): string {
  const id = SITE_PROFILE[site] ?? site;
  return id in PROFILES ? id : 'plain';
}

/** What each cue sounds like. `t` is the start time on the audio clock. */
const CUES: Record<Cue, (e: SoundEngine, t: number) => void> = {
  // clicks, keys and sends sound like the site they happen on (see PROFILES)
  click: (e, t) => {
    const k = PROFILES[e.profile].tick, j = rnd(0.92, 1.08);
    e.noise(t, k.dur, { bp: k.bp * j, q: k.q, gain: k.gain });
    if (k.tone) e.tone(k.tone * j, t, k.dur + 0.01, { gain: k.toneGain ?? 0.012, type: k.type, glideTo: k.drop });
  },
  key: (e, t) => { const [lo, hi] = PROFILES[e.profile].key; e.noise(t, 0.008, { bp: rnd(lo, hi), q: 2, gain: 0.05 }); },
  send: (e, t) => PROFILES[e.profile].send(e, t),
  // the agent answers: two clean notes, a fifth apart
  reply: (e, t) => {
    e.tone(659, t, 0.22, { gain: 0.06, type: 'triangle' });
    e.tone(988, t + 0.08, 0.3, { gain: 0.05, type: 'triangle' });
  },
  // a document arrives: paper over a counter, then a low two-tone
  mail: (e, t) => {
    e.noise(t, 0.16, { lp: 1400, hp: 300, gain: 0.05 });
    e.tone(784, t + 0.06, 0.28, { gain: 0.06, type: 'triangle' });
    e.tone(587, t + 0.17, 0.38, { gain: 0.06, type: 'triangle' });
  },
  // someone posted on Y: a small bright pip, falling
  post: (e, t) => {
    e.tone(1175, t, 0.09, { gain: 0.045, type: 'triangle', glideTo: 880 });
    e.tone(1568, t + 0.07, 0.12, { gain: 0.03, type: 'triangle', glideTo: 1175 });
  },
  // money leaves, the wallet's signature: a receipt printer chatters, then a falling minor third
  // over a low thunk. Plays on every debit: agent usage, hosting, rent, transfers.
  charge: (e, t) => {
    for (let i = 0; i < 4; i++) e.noise(t + i * 0.022, 0.016, { bp: 2200 + i * 150, q: 4, gain: 0.05 });
    e.tone(659, t + 0.1, 0.09, { type: 'square', gain: 0.022, lp: 1800 });
    e.tone(523, t + 0.19, 0.2, { type: 'square', gain: 0.022, lp: 1500 });
    e.tone(98, t + 0.19, 0.16, { gain: 0.08, glideTo: 70 });
  },
  // money arrives, the other half of the signature: a coin-bright ping, then the same two notes
  // as a debit but rising, so the two are easy to tell apart without looking
  income: (e, t) => {
    e.tone(2093, t, 0.25, { gain: 0.03 });
    e.tone(2637, t + 0.005, 0.2, { gain: 0.02 });
    e.tone(523, t + 0.08, 0.09, { type: 'square', gain: 0.022, lp: 2600 });
    e.tone(659, t + 0.16, 0.09, { type: 'square', gain: 0.022, lp: 2600 });
    e.tone(1047, t + 0.24, 0.3, { type: 'square', gain: 0.02, lp: 2800 });
  },

  // the Deploy button, the game's signature sound: a heavy stamp on the desk, a rising upload,
  // then a short three-note confirmation that settles a little lower than you'd hope
  deploy: (e, t) => {
    e.noise(t, 0.09, { lp: 900, gain: 0.3 });
    e.tone(110, t, 0.18, { gain: 0.14, glideTo: 55, attack: 0.002 });
    e.noise(t + 0.02, 0.04, { bp: 2600, q: 2, gain: 0.06 });
    e.tone(330, t + 0.12, 0.42, { type: 'sawtooth', gain: 0.02, glideTo: 1320, lp: 2400 });
    const scale = [1319, 1568, 1760, 2093];
    for (let i = 0; i < 6; i++) e.tone(scale[i % scale.length], t + 0.16 + i * 0.045, 0.035, { type: 'square', gain: 0.012, lp: 3400 });
    [[659, 0.6], [988, 0.72], [880, 0.86]].forEach(([f, at]) => e.tone(f, t + at, 0.5, { gain: 0.045, type: 'triangle' }));
    e.tone(440, t + 0.86, 0.7, { gain: 0.025 });
  },
  // the working day opens: a low pad that brightens, then one bell
  dayStart: (e, t) => {
    e.pad([110, 165, 220, 277], t, 2.2, 260, 1700, 0.022);
    e.tone(880, t + 0.9, 1.1, { gain: 0.03 });
    e.tone(1320, t + 0.9, 0.8, { gain: 0.012 });
  },
  // the day closes: a darker pad that dims, and a power-down glide
  dayEnd: (e, t) => {
    e.pad([92.5, 139, 185, 220], t, 2.4, 1600, 180, 0.022);
    e.tone(440, t + 0.1, 1.0, { gain: 0.035, glideTo: 110 });
  },
  // an hour left: a wristwatch double beep, twice
  lateWarn: (e, t) => {
    for (const at of [0, 0.12, 0.5, 0.62]) e.tone(1320, t + at, 0.07, { type: 'square', gain: 0.02, lp: 2400 });
  },
  // the run is over: a low drone and a dull thud
  ending: (e, t) => {
    e.noise(t, 0.4, { lp: 220, gain: 0.25 });
    e.tone(55, t, 3, { gain: 0.12, attack: 0.05 });
    e.pad([55, 82.5, 110], t, 3.2, 400, 120, 0.03);
  },
};

export const SOUND = new SoundEngine();
