// Procedural Web Audio sound effects — fully synthesized, no asset files.
// One short cue per game event; muted state persists in localStorage.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('cf_muted') === '1';

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// Browsers block audio until a user gesture — warm the context on first interaction.
if (typeof window !== 'undefined') {
  const warm = () => ac();
  window.addEventListener('pointerdown', warm);
  window.addEventListener('keydown', warm);
}

function note(
  freq: number,
  t0: number,
  dur: number,
  type: OscillatorType = 'sine',
  vol = 0.25,
  glideTo?: number
) {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

function noise(t0: number, dur: number, vol = 0.2, hp = 800) {
  if (!ctx || !master) return;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = hp;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filt);
  filt.connect(g);
  g.connect(master);
  src.start(t0);
  src.stop(t0 + dur);
}

export type SfxName =
  | 'roll'
  | 'card'
  | 'payday'
  | 'deal'
  | 'market'
  | 'doodad'
  | 'downsized'
  | 'baby'
  | 'charity'
  | 'fastTrack'
  | 'win'
  | 'buy';

const effects: Record<SfxName, () => void> = {
  roll() {
    const t = ctx!.currentTime;
    for (let i = 0; i < 6; i++) noise(t + i * 0.045, 0.045, 0.16, 1400); // dice rattle
  },
  card() {
    const t = ctx!.currentTime;
    noise(t, 0.13, 0.12, 2200); // paper swish
    note(880, t + 0.04, 0.09, 'triangle', 0.14);
  },
  payday() {
    const t = ctx!.currentTime; // cha-ching
    note(988, t, 0.12, 'square', 0.2);
    note(1319, t + 0.1, 0.24, 'square', 0.22);
  },
  deal() {
    const t = ctx!.currentTime; // magical rising chime
    [659, 784, 988, 1319].forEach((f, i) => note(f, t + i * 0.06, 0.2, 'triangle', 0.15));
  },
  market() {
    const t = ctx!.currentTime; // ding-ding-ding (opening bell)
    [1047, 1047, 1319].forEach((f, i) => note(f, t + i * 0.15, 0.14, 'square', 0.17));
  },
  doodad() {
    const t = ctx!.currentTime; // sad trombone (down-glide)
    note(440, t, 0.55, 'sawtooth', 0.18, 150);
  },
  downsized() {
    const t = ctx!.currentTime; // dun... dun (dramatic)
    note(165, t, 0.35, 'sawtooth', 0.28);
    note(110, t + 0.32, 0.55, 'sawtooth', 0.28);
  },
  baby() {
    const t = ctx!.currentTime; // cute high blips
    [1568, 1760, 1568].forEach((f, i) => note(f, t + i * 0.1, 0.1, 'sine', 0.16));
  },
  charity() {
    const t = ctx!.currentTime; // harp glissando up
    [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, t + i * 0.05, 0.45, 'sine', 0.11));
  },
  fastTrack() {
    const t = ctx!.currentTime; // rocket swoosh up
    note(300, t, 0.55, 'sawtooth', 0.2, 1500);
    noise(t, 0.55, 0.1, 500);
  },
  win() {
    const t = ctx!.currentTime; // fanfare
    [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.12, 0.3, 'square', 0.22));
    note(1319, t + 0.5, 0.6, 'square', 0.24);
  },
  buy() {
    const t = ctx!.currentTime; // cash register
    note(1047, t, 0.08, 'square', 0.18);
    note(1568, t + 0.07, 0.16, 'square', 0.2);
  }
};

export function play(name: SfxName) {
  if (muted) return;
  if (!ac()) return;
  try {
    effects[name]?.();
  } catch {
    /* ignore audio errors */
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (typeof localStorage !== 'undefined') localStorage.setItem('cf_muted', m ? '1' : '0');
}

export function getMuted() {
  return muted;
}
