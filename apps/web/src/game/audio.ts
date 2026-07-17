/**
 * Synthesized comic sound effects via Web Audio — no audio assets required.
 * The AudioContext is created lazily on the first punch (a user gesture), so
 * autoplay policies never block playback.
 */
export class SoundPlayer {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (typeof AudioContext === "undefined") return null;
    this.ctx ??= new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Comic punch: thumpy pitch-dropping osc + a bandpassed noise slap. */
  punch(strength = 1) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const pitchJitter = 0.85 + Math.random() * 0.3;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(190 * pitchJitter, t);
    osc.frequency.exponentialRampToValueAtTime(55 * pitchJitter, t + 0.12);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5 * strength, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.2);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.12);
    noise.playbackRate.value = pitchJitter;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(900 * pitchJitter, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.1);
    filter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35 * strength, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
  }

  /** Deep cartoon bonk for the mallet. */
  bonk(strength = 1) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const jitter = 0.9 + Math.random() * 0.2;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150 * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(58 * jitter, t + 0.22);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);

    const over = ctx.createOscillator();
    over.type = "triangle";
    over.frequency.setValueAtTime(300 * jitter, t);
    over.frequency.exponentialRampToValueAtTime(110, t + 0.12);
    const overGain = ctx.createGain();
    overGain.gain.setValueAtTime(0.2 * strength, t);
    overGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    over.connect(overGain).connect(ctx.destination);
    over.start(t);
    over.stop(t + 0.15);
  }

  /** Wet fish thwap: slap crack layered with a plop. */
  fish(strength = 1) {
    this.slap(strength * 0.8);
    this.splat();
  }

  /** Sizzle for the chili gag. */
  sizzle() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.35);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2800;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  /** Sharp bright crack for a slap. */
  slap(strength = 1) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const jitter = 0.9 + Math.random() * 0.2;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.09);
    noise.playbackRate.value = 1.6 * jitter;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * strength, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(900 * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.05);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.18 * strength, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  /** Wet plop for food splats. */
  splat() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const jitter = 0.85 + Math.random() * 0.3;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.16);
    noise.playbackRate.value = 0.6 * jitter;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900 * jitter, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.14);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300 * jitter, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.1);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.22, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  /** Short airy whoosh for the incoming fist. */
  whoosh() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(ctx, 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2500, t + 0.13);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t);
  }

  /** Rising arpeggio blip for combo milestones. */
  comboDing(step: number) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const base = 440 * Math.pow(1.06, Math.min(step, 24));
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = base * (i === 0 ? 1 : 1.5);
      const gain = ctx.createGain();
      const start = t + i * 0.05;
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.13);
    }
  }

  private noiseCache: AudioBuffer | null = null;

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    if (this.noiseCache && this.noiseCache.duration >= seconds) return this.noiseCache;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseCache = buffer;
    return buffer;
  }
}
