/**
 * Paints damage directly into a working copy of the face bitmap so marks live
 * ON the skin: they wrap and light with the 3D mesh, and the 2D warp draws
 * the same canvas. Marks are located at the exact impact point; repaints
 * happen per hit (bounded by mark caps), never per frame.
 *
 * Tone line: bruising and food splats only — no blood, cuts, burns or gore.
 */

interface BruiseMark {
  x: number; // px in face-canvas space
  y: number;
  r: number;
  intensity: number;
  seed: number;
}

interface SplatMark {
  x: number;
  y: number;
  kind: "tomato" | "egg";
  seed: number;
}

const MAX_BRUISES = 20;
const MAX_SPLATS = 12;

export class DamagePainter {
  /** The canvas the game should render/texture from. Same size as the base. */
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private bruises: BruiseMark[] = [];
  private splats: SplatMark[] = [];
  private seedCounter = 1;

  constructor(base: HTMLCanvasElement) {
    this.base = base;
    this.canvas = document.createElement("canvas");
    this.canvas.width = base.width;
    this.canvas.height = base.height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.repaint();
  }

  /** Impact attack at (u, v) in [0,1] texture coords: bruise there, or deepen a nearby one. */
  hit(u: number, v: number, strength: number) {
    const x = u * this.canvas.width;
    const y = v * this.canvas.height;
    const r = this.canvas.width * (0.1 + 0.05 * Math.min(strength, 2));
    const near = this.bruises.find((b) => Math.hypot(b.x - x, b.y - y) < b.r * 0.7);
    if (near) {
      near.intensity = Math.min(2, near.intensity + 0.3 * strength);
      near.r = Math.min(this.canvas.width * 0.22, near.r * 1.06);
    } else {
      this.bruises.push({ x, y, r, intensity: 0.55 + 0.35 * strength, seed: this.seedCounter++ });
      if (this.bruises.length > MAX_BRUISES) this.bruises.shift();
    }
    this.repaint();
  }

  /** Food attack at (u, v): paint a splat. */
  splat(u: number, v: number, kind: "tomato" | "egg") {
    this.splats.push({
      x: u * this.canvas.width,
      y: v * this.canvas.height,
      kind,
      seed: this.seedCounter++,
    });
    if (this.splats.length > MAX_SPLATS) this.splats.shift();
    this.repaint();
  }

  clear() {
    this.bruises = [];
    this.splats = [];
    this.repaint();
  }

  private repaint() {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();
    for (const b of this.bruises) this.paintBruise(b);
    for (const s of this.splats) this.paintSplat(s);
  }

  /**
   * One bruise: yellow-green aged halo → red-violet body → dark core →
   * blurred mottling, multiplied over the skin so tone shows through.
   */
  private paintBruise({ x, y, r, intensity, seed }: BruiseMark) {
    const { ctx } = this;
    const rand = mulberry32(seed * 7919);
    const tilt = (rand() - 0.5) * 0.9;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = `blur(${Math.max(2, r * 0.09)}px)`;

    ctx.globalAlpha = Math.min(1, 0.5 * intensity);
    let g = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.35);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(196,190,120,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    fillEllipse(ctx, 0, 0, r * 1.4, r * 1.15);

    ctx.globalAlpha = Math.min(1, 0.85 * intensity);
    g = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r);
    g.addColorStop(0, "rgba(120,38,64,0.72)");
    g.addColorStop(0.55, "rgba(96,60,132,0.5)");
    g.addColorStop(1, "rgba(120,80,140,0)");
    ctx.fillStyle = g;
    fillEllipse(ctx, 0, 0, r * 1.05, r * 0.85);

    ctx.globalAlpha = Math.min(1, 0.7 * intensity);
    g = ctx.createRadialGradient(-r * 0.1, -r * 0.05, 1, -r * 0.1, -r * 0.05, r * 0.42);
    g.addColorStop(0, "rgba(58,16,44,0.6)");
    g.addColorStop(1, "rgba(58,16,44,0)");
    ctx.fillStyle = g;
    fillEllipse(ctx, -r * 0.1, -r * 0.05, r * 0.5, r * 0.4);

    const HUES = ["rgba(104,44,110,", "rgba(128,40,60,", "rgba(70,60,130,", "rgba(150,110,70,"];
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const dist = rand() * r * 0.75;
      const mr = r * (0.08 + rand() * 0.16);
      ctx.globalAlpha = (0.08 + rand() * 0.1) * intensity;
      ctx.fillStyle = `${HUES[Math.floor(rand() * HUES.length)]}1)`;
      fillEllipse(ctx, Math.cos(a) * dist, Math.sin(a) * dist * 0.8, mr * (0.8 + rand() * 0.6), mr);
    }
    ctx.restore();
  }

  /** Food splat: unmistakably tomato pulp or broken egg, never blood-like. */
  private paintSplat({ x, y, kind, seed }: SplatMark) {
    const { ctx } = this;
    const rand = mulberry32(seed * 104729);
    const r = this.canvas.width * 0.11;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rand() * Math.PI * 2);
    ctx.filter = `blur(${Math.max(1, r * 0.03)}px)`;

    if (kind === "tomato") {
      // pulpy orange-red star with radiating streaks and seeds
      ctx.globalAlpha = 0.82;
      ctx.fillStyle = "rgb(214,72,38)";
      fillEllipse(ctx, 0, 0, r * 0.75, r * 0.65);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + rand() * 0.5;
        const len = r * (0.7 + rand() * 0.8);
        ctx.save();
        ctx.rotate(a);
        ctx.globalAlpha = 0.7;
        fillEllipse(ctx, len * 0.55, 0, len * 0.45, r * (0.1 + rand() * 0.1));
        ctx.restore();
      }
      ctx.fillStyle = "rgb(238,120,60)";
      ctx.globalAlpha = 0.65;
      fillEllipse(ctx, 0, 0, r * 0.45, r * 0.4);
      ctx.fillStyle = "rgb(240,214,130)"; // seeds
      for (let i = 0; i < 8; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.6;
        ctx.globalAlpha = 0.9;
        fillEllipse(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.05, r * 0.03);
      }
    } else {
      // broken egg: translucent white splat, yolk disc, shell chips
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgb(245,242,230)";
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + rand() * 0.6;
        const len = r * (0.5 + rand() * 0.7);
        ctx.save();
        ctx.rotate(a);
        fillEllipse(ctx, len * 0.5, 0, len * 0.5, r * (0.14 + rand() * 0.12));
        ctx.restore();
      }
      fillEllipse(ctx, 0, 0, r * 0.7, r * 0.6);
      ctx.globalAlpha = 0.92;
      const yolk = ctx.createRadialGradient(-r * 0.05, -r * 0.05, 1, 0, 0, r * 0.34);
      yolk.addColorStop(0, "rgb(252,204,80)");
      yolk.addColorStop(1, "rgb(238,160,40)");
      ctx.fillStyle = yolk;
      fillEllipse(ctx, 0, 0, r * 0.34, r * 0.3);
      ctx.fillStyle = "rgb(250,248,240)"; // shell chips
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * (0.4 + rand() * 0.5);
        ctx.globalAlpha = 0.85;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(rand() * Math.PI);
        ctx.fillRect(-r * 0.06, -r * 0.04, r * 0.12, r * 0.08);
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

function fillEllipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
