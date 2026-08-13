// Procedural audio. No sample files: oscillators, filtered noise and envelopes.
//
// The sound of EMBERROOT is struck wood, bone flute and low drum. Nothing is
// bright or metallic except ember itself -- resonance, rites and shards ring;
// everything else knocks.

const MASTER = 0.28;

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = read();
    this.mood = null;
    this.bed = null;
  }

  resume() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER;
      this.master.connect(this.ctx.destination);
      this.noise = makeNoise(this.ctx, 1.5);
      if (this.mood) this.setMood(this.mood, true);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER, this.ctx.currentTime, 0.02);
    try { localStorage.setItem('er.muted', this.muted ? '1' : '0'); } catch { /* private */ }
    return this.muted;
  }

  tone({ freq = 440, type = 'sine', gain = 0.2, attack = 0.004, decay = 0.2, glide = null, filter = null, delay = 0 }) {
    const { ctx } = this;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glide != null) osc.frequency.exponentialRampToValueAtTime(Math.max(glide, 1), t + decay);
    let node = osc;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type ?? 'lowpass';
      f.frequency.setValueAtTime(filter.freq ?? 1200, t);
      if (filter.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(filter.sweep, 20), t + decay);
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

  hiss({ gain = 0.2, attack = 0.002, decay = 0.15, type = 'bandpass', freq = 1400, sweep = null, q = 1, delay = 0 }) {
    const { ctx } = this;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
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

  setMood(mood, force = false) {
    this.mood = mood;
    if (!this.ctx) return;
    if (!force && this.bed?.mood === mood) return;
    this.bed?.stop();
    this.bed = mood ? makeBed(this, mood) : null;
  }
}

const KIT = {
  cursor: (a) => a.hiss({ gain: 0.09, decay: 0.03, type: 'bandpass', freq: 2600, q: 4 }),
  confirm: (a) => {
    a.tone({ freq: 330, type: 'triangle', gain: 0.14, decay: 0.07 });
    a.tone({ freq: 495, type: 'triangle', gain: 0.11, decay: 0.1, delay: 0.045 });
  },
  cancel: (a) => a.tone({ freq: 260, type: 'triangle', gain: 0.12, decay: 0.11, glide: 155 }),
  deny: (a) => a.tone({ freq: 120, type: 'square', gain: 0.1, decay: 0.14, glide: 82 }),

  swing: (a) => a.hiss({ gain: 0.16, decay: 0.11, type: 'bandpass', freq: 900, sweep: 2400, q: 1.2 }),
  hit: (a) => {
    a.hiss({ gain: 0.24, decay: 0.13, type: 'lowpass', freq: 1600, sweep: 320 });
    a.tone({ freq: 116, type: 'sine', gain: 0.26, decay: 0.18, glide: 62 });
  },
  crit: (a) => {
    a.hiss({ gain: 0.3, decay: 0.2, type: 'bandpass', freq: 3400, sweep: 700, q: 2 });
    a.tone({ freq: 92, type: 'sine', gain: 0.3, decay: 0.32, glide: 46 });
    a.tone({ freq: 880, type: 'triangle', gain: 0.1, decay: 0.14, delay: 0.02 });
  },
  rite: (a) => {
    a.tone({ freq: 294, type: 'sine', gain: 0.12, decay: 0.4, glide: 588, filter: { freq: 1800 } });
    a.hiss({ gain: 0.07, decay: 0.34, type: 'bandpass', freq: 3200, q: 6 });
  },
  heal: (a) => {
    a.tone({ freq: 392, type: 'sine', gain: 0.12, decay: 0.36, glide: 588 });
    a.tone({ freq: 588, type: 'sine', gain: 0.08, decay: 0.4, glide: 784, delay: 0.06 });
  },
  guard: (a) => a.tone({ freq: 98, type: 'square', gain: 0.16, decay: 0.16, filter: { freq: 420 } }),
  buff: (a) => {
    for (const [i, f] of [330, 440, 550].entries()) {
      a.tone({ freq: f, type: 'triangle', gain: 0.09, decay: 0.24, delay: i * 0.05 });
    }
  },
  revive: (a) => {
    for (const [i, f] of [262, 392, 523].entries()) {
      a.tone({ freq: f, type: 'sine', gain: 0.11, decay: 0.7, delay: i * 0.07 });
    }
  },
  down: (a) => {
    a.hiss({ gain: 0.26, decay: 0.5, type: 'lowpass', freq: 900, sweep: 90 });
    a.tone({ freq: 98, type: 'sawtooth', gain: 0.2, decay: 0.6, glide: 40 });
  },
  step: (a) => a.hiss({ gain: 0.05, decay: 0.05, type: 'lowpass', freq: 560, sweep: 200 }),
  open: (a) => {
    a.hiss({ gain: 0.14, decay: 0.3, type: 'bandpass', freq: 1200, sweep: 400, q: 1.5 });
    a.tone({ freq: 523, type: 'sine', gain: 0.1, decay: 0.5, delay: 0.05 });
    a.tone({ freq: 784, type: 'sine', gain: 0.08, decay: 0.6, delay: 0.12 });
  },
  page: (a) => a.hiss({ gain: 0.06, decay: 0.05, type: 'bandpass', freq: 3000, q: 2 }),
  victory: (a) => {
    for (const [i, f] of [262, 349, 440, 523].entries()) {
      a.tone({ freq: f, type: 'triangle', gain: 0.12, decay: 1.1, delay: i * 0.13 });
    }
  },
  defeat: (a) => {
    for (const [i, f] of [196, 165, 131].entries()) {
      a.tone({ freq: f, type: 'triangle', gain: 0.14, decay: 1.0, delay: i * 0.2 });
    }
  },
};

function makeNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    last = (last + (Math.random() * 2 - 1) * 0.34) * 0.94;
    data[i] = Math.max(-1, Math.min(1, last * 3));
  }
  return buffer;
}

const BEDS = {
  battle: { freqs: [49, 73.4, 98], type: 'sawtooth', level: 0.05, cutoff: 220 },
  field: { freqs: [55, 82.5], type: 'sine', level: 0.07, cutoff: 320 },
  menu: { freqs: [65.4, 98, 131], type: 'sine', level: 0.05, cutoff: 400 },
};

function makeBed(audio, mood) {
  const { ctx, master } = audio;
  const spec = BEDS[mood] ?? BEDS.field;
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
    osc.detune.value = (i - 1) * 9;
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.04 + i * 0.027;
    depth.gain.value = freq * 0.007;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    osc.connect(filter);
    osc.start();
    lfo.start();
    nodes.push(osc, lfo);
  }
  gain.gain.setTargetAtTime(spec.level, ctx.currentTime, 1.4);
  return {
    mood,
    stop() {
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
      for (const n of nodes) { try { n.stop(ctx.currentTime + 2); } catch { /* stopped */ } }
    },
  };
}

function read() {
  try { return localStorage.getItem('er.muted') === '1'; } catch { return false; }
}

export { KIT, BEDS };
