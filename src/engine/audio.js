// Procedural audio. No sample files: every sound is synthesised from oscillators
// and filtered noise at play time, which keeps the game asset-free and lets
// sounds take parameters -- an across-grain hit is literally a brighter, sharper
// version of the same crack as a glancing one.
//
// Sound direction follows art direction: wood, not metal. Nothing rings brightly
// except sunwood and a maturing graft, because those are the only things in this
// world that are meant to feel like light.

const MASTER = 0.3;

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = readMuted();
    this.ambient = null;
  }

  /** Browsers require a gesture before audio starts; call this from a keypress. */
  resume() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = makeNoise(this.ctx, 1.5);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  get available() { return !!this.ctx; }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.ctx.currentTime, 0.02);
    }
    try { localStorage.setItem('sh.muted', this.muted ? '1' : '0'); } catch { /* private mode */ }
    return this.muted;
  }

  // --- synthesis primitives (public so the kit table can compose them) ------

  tone({
    freq = 440, type = 'sine', gain = 0.25, attack = 0.005, decay = 0.2,
    glide = null, detune = 0, filter = null, delay = 0,
  }) {
    const { ctx } = this;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;
    if (glide != null) osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), t + decay);

    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type ?? 'lowpass';
      f.frequency.setValueAtTime(filter.freq ?? 1200, t);
      if (filter.sweep) {
        f.frequency.exponentialRampToValueAtTime(Math.max(filter.sweep, 20), t + decay);
      }
      f.Q.value = filter.q ?? 1;
      node.connect(f);
      node = f;
    }

    const amp = ctx.createGain();
    node.connect(amp);
    amp.connect(this.master);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  noise({
    gain = 0.25, attack = 0.002, decay = 0.15, type = 'lowpass',
    freq = 1400, sweep = null, q = 1, delay = 0, rate = 1,
  }) {
    const { ctx } = this;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = rate;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(sweep, 20), t + decay);
    f.Q.value = q;
    const amp = ctx.createGain();
    src.connect(f);
    f.connect(amp);
    amp.connect(this.master);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }

  play(name, opts = {}) {
    if (!this.ctx || this.muted) return;
    KIT[name]?.(this, opts);
  }

  /** A low bed under each region, swapped on scene change. */
  setAmbient(kind) {
    if (!this.ctx || this.ambient?.kind === kind) return;
    this.ambient?.stop();
    this.ambient = kind ? makeAmbient(this, kind) : null;
  }
}

// --- the kit ----------------------------------------------------------------

const KIT = {
  // UI: dry, wooden, quiet. These fire constantly, so they must never nag.
  cursor: (a) => a.noise({ gain: 0.1, decay: 0.035, type: 'bandpass', freq: 2200, q: 3 }),
  confirm: (a) => {
    a.tone({ freq: 392, type: 'triangle', gain: 0.16, decay: 0.09 });
    a.tone({ freq: 587, type: 'triangle', gain: 0.12, decay: 0.11, delay: 0.05 });
  },
  cancel: (a) => a.tone({ freq: 300, type: 'triangle', gain: 0.14, decay: 0.13, glide: 170 }),
  denied: (a) => a.tone({ freq: 150, type: 'square', gain: 0.1, decay: 0.16, glide: 96 }),
  page: (a) => a.noise({ gain: 0.07, decay: 0.06, type: 'bandpass', freq: 3000, q: 1.6, rate: 1.4 }),

  // Field
  step: (a, { pitch = 1 } = {}) => a.noise({
    gain: 0.055, decay: 0.055, type: 'lowpass', freq: 620 * pitch, sweep: 200,
  }),
  door: (a) => {
    a.noise({ gain: 0.16, decay: 0.3, type: 'lowpass', freq: 500, sweep: 140 });
    a.tone({ freq: 98, type: 'sine', gain: 0.18, decay: 0.34 });
  },

  // Combat. `strike` takes the grain relation, so the same gesture reads
  // brighter across the fibre and duller along it.
  strike: (a, { relation = 'oblique', power = 1 } = {}) => {
    const spec = {
      across: { freq: 3600, sweep: 700, gain: 0.3, decay: 0.2, thump: 132, q: 2.2 },
      oblique: { freq: 1700, sweep: 380, gain: 0.24, decay: 0.16, thump: 104, q: 1.2 },
      along: { freq: 520, sweep: 150, gain: 0.16, decay: 0.26, thump: 78, q: 0.8 },
    }[relation] ?? {};
    a.noise({
      gain: spec.gain * power, decay: spec.decay, type: 'bandpass',
      freq: spec.freq, sweep: spec.sweep, q: spec.q,
    });
    a.tone({
      freq: spec.thump, type: 'sine', gain: 0.26 * power,
      decay: spec.decay * 1.5, glide: spec.thump * 0.55,
    });
    if (relation === 'across') {
      a.tone({ freq: 1180, type: 'square', gain: 0.07, decay: 0.05, filter: { freq: 2600 } });
    }
  },
  /** Force absorbed as growth: a swallowed, upward-bending thud. */
  absorb: (a) => {
    a.noise({ gain: 0.12, decay: 0.34, type: 'lowpass', freq: 380, sweep: 900 });
    a.tone({ freq: 88, type: 'sine', gain: 0.2, decay: 0.4, glide: 150 });
  },
  graft: (a) => {
    a.tone({ freq: 262, type: 'triangle', gain: 0.15, decay: 0.24, filter: { freq: 1400, sweep: 500 } });
    a.noise({ gain: 0.06, decay: 0.1, type: 'bandpass', freq: 900, q: 4 });
  },
  /** The one genuinely bell-like sound in the game. */
  mature: (a) => {
    for (const [i, freq] of [523.25, 784, 1046.5].entries()) {
      a.tone({ freq, type: 'sine', gain: 0.14 / (i + 1), decay: 0.9 + i * 0.3, delay: i * 0.015 });
    }
  },
  harvest: (a) => a.tone({ freq: 330, type: 'triangle', gain: 0.13, decay: 0.18, glide: 247 }),
  excise: (a) => {
    a.noise({ gain: 0.2, decay: 0.11, type: 'highpass', freq: 2400, sweep: 5200 });
    a.tone({ freq: 740, type: 'sawtooth', gain: 0.07, decay: 0.07, glide: 330 });
  },
  scar: (a) => {
    a.noise({ gain: 0.3, decay: 0.42, type: 'lowpass', freq: 1500, sweep: 130, q: 2 });
    a.tone({ freq: 74, type: 'sawtooth', gain: 0.16, decay: 0.45, glide: 41 });
  },
  heal: (a) => {
    a.tone({ freq: 349, type: 'sine', gain: 0.13, decay: 0.4, glide: 523 });
    a.tone({ freq: 523, type: 'sine', gain: 0.08, decay: 0.45, glide: 698, delay: 0.06 });
  },
  read: (a) => {
    a.tone({ freq: 880, type: 'sine', gain: 0.09, decay: 0.3, glide: 1320 });
    a.noise({ gain: 0.05, decay: 0.24, type: 'bandpass', freq: 4200, q: 6 });
  },
  rotate: (a) => a.noise({ gain: 0.09, decay: 0.13, type: 'bandpass', freq: 1300, sweep: 2600, q: 5 }),
  down: (a) => {
    a.noise({ gain: 0.26, decay: 0.6, type: 'lowpass', freq: 900, sweep: 90 });
    a.tone({ freq: 110, type: 'sawtooth', gain: 0.2, decay: 0.7, glide: 44 });
  },
  burn: (a) => a.noise({ gain: 0.22, decay: 0.5, type: 'bandpass', freq: 700, sweep: 180, q: 1.4 }),
  victory: (a) => {
    for (const [i, freq] of [261.6, 392, 523.25, 784].entries()) {
      a.tone({ freq, type: 'triangle', gain: 0.12, decay: 1.1, delay: i * 0.11 });
    }
  },
  defeat: (a) => {
    for (const [i, freq] of [196, 155.6, 130.8].entries()) {
      a.tone({ freq, type: 'triangle', gain: 0.14, decay: 1.0, delay: i * 0.18 });
    }
  },

  // Audit bench
  sample: (a) => {
    a.noise({ gain: 0.13, decay: 0.07, type: 'bandpass', freq: 2600, q: 5 });
    a.tone({ freq: 1046, type: 'sine', gain: 0.05, decay: 0.06 });
  },
  suspicious: (a) => a.tone({ freq: 660, type: 'sine', gain: 0.1, decay: 0.32, glide: 990 }),
  bracket: (a) => a.tone({ freq: 440, type: 'square', gain: 0.07, decay: 0.08, filter: { freq: 1800 } }),
  certified: (a) => {
    for (const [i, freq] of [523.25, 659.25, 987.77].entries()) {
      a.tone({ freq, type: 'sine', gain: 0.13, decay: 1.4, delay: i * 0.09 });
    }
  },
  rejected: (a) => {
    a.tone({ freq: 196, type: 'triangle', gain: 0.15, decay: 0.7, glide: 130 });
    a.noise({ gain: 0.09, decay: 0.5, type: 'lowpass', freq: 600, sweep: 160 });
  },
};

function makeNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    // Brownish noise: closer to wood and wind than to white hiss.
    last = (last + (Math.random() * 2 - 1) * 0.34) * 0.94;
    data[i] = Math.max(-1, Math.min(1, last * 3));
  }
  return buffer;
}

const AMBIENT = {
  field: { freqs: [55, 82.5], type: 'sine', level: 0.075, cutoff: 340 },
  town: { freqs: [65.4, 98], type: 'triangle', level: 0.06, cutoff: 420 },
  battle: { freqs: [49, 73.4, 98], type: 'sawtooth', level: 0.045, cutoff: 240 },
  audit: { freqs: [110, 220], type: 'sine', level: 0.035, cutoff: 620 },
};

function makeAmbient(audio, kind) {
  const { ctx, master } = audio;
  const spec = AMBIENT[kind] ?? AMBIENT.field;

  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(master);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.cutoff;
  filter.connect(gain);

  const nodes = [];
  for (const [i, freq] of spec.freqs.entries()) {
    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.value = freq;
    osc.detune.value = (i - 1) * 8;
    // A slow drift so the bed breathes instead of sitting perfectly still.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.05 + i * 0.031;
    depth.gain.value = freq * 0.006;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    osc.connect(filter);
    osc.start();
    lfo.start();
    nodes.push(osc, lfo);
  }

  gain.gain.setTargetAtTime(spec.level, ctx.currentTime, 1.5);
  return {
    kind,
    stop() {
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
      for (const n of nodes) {
        try { n.stop(ctx.currentTime + 2); } catch { /* already stopped */ }
      }
    },
  };
}

function readMuted() {
  try { return localStorage.getItem('sh.muted') === '1'; } catch { return false; }
}

export { KIT, AMBIENT };
