/**
 * Procedural audio system using Web Audio API.
 * No external audio files needed — all sounds synthesized at runtime.
 */
export class SoundManager {
  private static _ctx:       AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  private static sfxGain:   GainNode | null = null;
  private static bgmGain:   GainNode | null = null;
  private static _muted = false;
  private static bgmActive  = false;
  private static bgmTimerId = 0;
  private static bgmOscs:   AudioNode[] = [];

  static get ready():  boolean { return !!this._ctx; }
  static get muted():  boolean { return this._muted; }
  static get context(): AudioContext | null { return this._ctx; }

  // ── Init ──────────────────────────────────────────────────────────────────

  static init(): void {
    if (this._ctx) return;
    try {
      this._ctx     = new AudioContext();

      this.masterGain = this._ctx.createGain();
      this.masterGain.gain.value = 0.45;
      this.masterGain.connect(this._ctx.destination);

      this.sfxGain = this._ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this._ctx.createGain();
      this.bgmGain.gain.value = 0.3;
      this.bgmGain.connect(this.masterGain);
    } catch { /* unsupported */ }
  }

  static resume(): void {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
  }

  static toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.masterGain && this._ctx) {
      this.masterGain.gain.setTargetAtTime(
        this._muted ? 0 : 0.45,
        this._ctx.currentTime, 0.06,
      );
    }
    return this._muted;
  }

  // ── Low-level primitives ──────────────────────────────────────────────────

  /** Oscillator burst */
  private static tone(
    freq:    number,
    freqEnd: number,
    dur:     number,
    vol:     number,
    type:    OscillatorType = 'square',
    delay:   number = 0,
  ): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const t   = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t + dur);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol,  t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.sfxGain!);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  /** White-noise burst through a filter */
  private static noise(
    dur:    number,
    fFreq:  number,
    fQ:     number,
    fType:  BiquadFilterType,
    vol:    number,
    target: GainNode | null = null,
  ): void {
    const ctx = this._ctx;
    if (!ctx) return;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt  = ctx.createBiquadFilter();
    flt.type   = fType;
    flt.frequency.value = fFreq;
    flt.Q.value = fQ;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(flt); flt.connect(g);
    g.connect(target ?? this.sfxGain!);
    src.start(); src.stop(ctx.currentTime + dur + 0.05);
  }

  // ── Sound Effects ─────────────────────────────────────────────────────────

  static playShoot(isPlayer: boolean): void {
    if (!this._ctx) return;
    if (isPlayer) {
      this.tone(1200, 500, 0.07, 0.13, 'square');
      this.tone(900,  350, 0.06, 0.06, 'sine', 0.01);
    } else {
      this.tone(300, 140, 0.09, 0.07, 'sawtooth');
    }
  }

  static playExplosion(big: boolean): void {
    if (!this._ctx) return;
    if (big) {
      this.noise(0.7, 100, 0.5, 'lowpass',  0.55);
      this.noise(0.4, 400, 0.4, 'bandpass', 0.25);
      this.tone(80, 28, 0.55, 0.22, 'sine');
    } else {
      this.noise(0.22, 380, 0.5, 'bandpass', 0.28);
      this.tone(190, 45, 0.18, 0.10, 'sine');
    }
  }

  static playPowerup(): void {
    if (!this._ctx) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      this.tone(f, f, 0.12, 0.18, 'sine', i * 0.07),
    );
  }

  static playNuke(): void {
    if (!this._ctx) return;
    this.noise(1.2, 70,  0.3, 'lowpass',  0.6);
    this.noise(0.6, 500, 0.5, 'bandpass', 0.28);
    this.tone(55, 18, 0.85, 0.25, 'sine');
  }

  static playHit(): void {
    if (!this._ctx) return;
    this.noise(0.18, 900, 0.4, 'bandpass', 0.38);
    this.tone(220, 75, 0.15, 0.12, 'sawtooth');
  }

  static playGravFlip(): void {
    if (!this._ctx) return;
    this.tone(180, 900, 0.28, 0.20, 'sine');
    this.tone(900, 180, 0.28, 0.14, 'sine', 0.18);
    this.noise(0.45, 1200, 0.35, 'bandpass', 0.10);
  }

  static playWaveClear(): void {
    if (!this._ctx) return;
    [523, 659, 784, 880, 1047].forEach((f, i) =>
      this.tone(f, f, 0.15, 0.20, 'sine', i * 0.10),
    );
  }

  static playGameOver(): void {
    if (!this._ctx) return;
    [440, 370, 294, 220].forEach((f, i) =>
      this.tone(f, f * 0.88, 0.38, 0.20, 'sine', i * 0.24),
    );
    this.noise(0.9, 140, 0.3, 'lowpass', 0.15);
  }

  static playButtonClick(): void {
    if (!this._ctx) return;
    this.tone(880, 440, 0.06, 0.10, 'square');
  }

  // ── BGM ───────────────────────────────────────────────────────────────────

  static startBGM(type: 'menu' | 'game'): void {
    if (!this._ctx || !this.bgmGain) return;
    this.stopBGM();
    this.bgmActive = true;
    if (type === 'menu') this.startMenuBGM();
    else                 this.startGameBGM();
  }

  static stopBGM(): void {
    this.bgmActive = false;
    clearTimeout(this.bgmTimerId);
    this.bgmOscs.forEach(n => {
      try { (n as OscillatorNode).stop(); } catch { /* ok */ }
    });
    this.bgmOscs = [];
  }

  // Cm pentatonic ambient — slow and atmospheric
  private static startMenuBGM(): void {
    const ctx = this._ctx!;
    const out = this.bgmGain!;

    // Bass drones: C2 + G2
    [65.41, 98].forEach(freq => {
      const osc  = ctx.createOscillator();
      osc.type   = 'sine';
      osc.frequency.value = freq;
      const gn   = ctx.createGain(); gn.gain.value = 0.20;
      const lfo  = ctx.createOscillator(); lfo.frequency.value = 0.07;
      const lfog = ctx.createGain();  lfog.gain.value = 1.2;
      lfo.connect(lfog); lfog.connect(osc.frequency);
      osc.connect(gn); gn.connect(out);
      osc.start(); lfo.start();
      this.bgmOscs.push(osc, lfo);
    });

    // Slow arpeggio: Cm pentatonic C3 Eb3 F3 G3 Bb3
    const melody = [130.81, 155.56, 174.61, 196.00, 233.08];
    let step     = 0;
    const tempo  = 1200;

    const tick = () => {
      if (!this.bgmActive) return;
      this.tone(melody[step % melody.length], melody[step % melody.length], 0.9, 0.06, 'sine');
      step++;
      this.bgmTimerId = window.setTimeout(tick, tempo);
    };
    tick();
  }

  // Am pentatonic — faster and tense
  private static startGameBGM(): void {
    const ctx = this._ctx!;
    const out = this.bgmGain!;

    // Bass drones: A1 + E2
    [55, 82.41].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      osc.type   = 'sine';
      osc.frequency.value = freq;
      const gn   = ctx.createGain(); gn.gain.value = i === 0 ? 0.25 : 0.12;
      const lfo  = ctx.createOscillator(); lfo.frequency.value = 0.14;
      const lfog = ctx.createGain();  lfog.gain.value = 1.8;
      lfo.connect(lfog); lfog.connect(osc.frequency);
      osc.connect(gn); gn.connect(out);
      osc.start(); lfo.start();
      this.bgmOscs.push(osc, lfo);
    });

    // Arpeggio: A3 C4 D4 E4 G4 E4 D4 C4
    const melody = [220, 261.63, 293.66, 329.63, 392, 329.63, 293.66, 261.63];
    let step     = 0;
    const tempo  = 360;

    const tick = () => {
      if (!this.bgmActive) return;
      this.tone(melody[step % melody.length], melody[step % melody.length], 0.22, 0.045, 'square');
      step++;
      this.bgmTimerId = window.setTimeout(tick, tempo);
    };
    tick();
  }
}
