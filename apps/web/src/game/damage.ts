/**
 * Paints damage directly into a working copy of the face bitmap so marks live
 * ON the skin: they wrap, deform, and light with the 3D face mesh, which draws
 * the same canvas. Marks are located at the exact impact point; repaints
 * happen per hit (bounded by mark caps), never per frame.
 *
 * Tone line: bruising, bounded surface blood, and food splats only — no cuts,
 * open wounds, burns, or gore.
 */

interface BruiseMark {
  x: number; // px in face-canvas space
  y: number;
  r: number;
  intensity: number;
  seed: number;
}

export type SplatKind = "tomato" | "egg";

interface SplatMark {
  x: number;
  y: number;
  kind: SplatKind;
  seed: number;
  scale: number;
}

interface BloodMark {
  x: number;
  y: number;
  r: number;
  angle: number;
  seed: number;
  intensity: number;
}

const MAX_BRUISES = 20;
const MAX_SPLATS = 12;
const MAX_BLOOD_MARKS = 18;

export class DamagePainter {
  /** The canvas the game should render/texture from. Same size as the base. */
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private bruises: BruiseMark[] = [];
  private splats: SplatMark[] = [];
  private bloodMarks: BloodMark[] = [];
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
  hit(u: number, v: number, strength: number): boolean {
    const x = u * this.canvas.width;
    const y = v * this.canvas.height;
    const r = this.canvas.width * (0.1 + 0.05 * Math.min(strength, 2));
    const near = this.bruises.find((b) => Math.hypot(b.x - x, b.y - y) < b.r * 0.7);
    if (near) {
      near.intensity = Math.min(2, near.intensity + 0.3 * strength);
      near.r = Math.min(this.canvas.width * 0.22, near.r * 1.06);
      // Paint only the added intensity. Rebuilding every existing blurred
      // bruise on every hit made rapid attacks progressively more expensive.
      this.paintBruise({
        ...near,
        intensity: Math.min(0.5, 0.18 + 0.18 * strength),
      });
    } else {
      if (this.bruises.length >= MAX_BRUISES) return false;
      const bruise = {
        x,
        y,
        r,
        intensity: 0.55 + 0.35 * strength,
        seed: this.seedCounter++,
      };
      this.bruises.push(bruise);
      this.paintBruise(bruise);
    }
    return true;
  }

  /** Food/gag attack at (u, v): paint a splat/flush mark. */
  splat(u: number, v: number, kind: SplatKind): boolean {
    if (this.splats.length >= MAX_SPLATS) return false;
    const x = u * this.canvas.width;
    const y = v * this.canvas.height;
    const overlapsOtherFood = this.splats.some(
      (mark) =>
        mark.kind !== kind &&
        Math.hypot(mark.x - x, mark.y - y) < this.canvas.width * 0.16,
    );
    const splat = {
      x,
      y,
      kind,
      seed: this.seedCounter++,
      // Keep the newest food centered on the exact UV, but tighten its
      // footprint when it overlaps the other food. The older splat remains
      // readable around it instead of being completely painted over.
      scale: overlapsOtherFood ? 0.72 : 1,
    };
    this.splats.push(splat);
    this.paintSplat(splat);
    return true;
  }

  /** Small directional surface spatter registered to the resolved face UV. */
  blood(u: number, v: number, strength: number, angle: number): boolean {
    if (this.bloodMarks.length >= MAX_BLOOD_MARKS) return false;
    const mark = {
      x: u * this.canvas.width,
      y: v * this.canvas.height,
      r: this.canvas.width * (0.032 + 0.012 * Math.min(1.6, strength)),
      angle,
      seed: this.seedCounter++,
      intensity: Math.min(1.25, 0.68 + strength * 0.24),
    };
    this.bloodMarks.push(mark);
    this.paintBlood(mark);
    return true;
  }

  clear() {
    this.bruises = [];
    this.splats = [];
    this.bloodMarks = [];
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
    for (const blood of this.bloodMarks) this.paintBlood(blood);
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

  private paintBlood({ x, y, r, angle, seed, intensity }: BloodMark) {
    const { ctx } = this;
    const rand = mulberry32(seed * 65537);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "multiply";
    ctx.filter = `blur(${Math.max(0.35, r * 0.018)}px)`;

    ctx.globalAlpha = Math.min(0.88, 0.62 * intensity);
    ctx.fillStyle = "rgb(142, 8, 24)";
    fillOrganicBlob(ctx, 0, 0, r * 0.56, r * 0.46, rand);

    ctx.globalAlpha = Math.min(0.78, 0.52 * intensity);
    ctx.fillStyle = "rgb(91, 3, 18)";
    fillEllipse(ctx, -r * 0.06, r * 0.03, r * 0.24, r * 0.2);

    // Satellite droplets stay tight to the exact contact instead of covering
    // the whole face. Larger ones sit nearer the core, tiny ones travel out.
    const droplets = 6 + Math.floor(rand() * 4);
    for (let i = 0; i < droplets; i++) {
      const spread = (rand() - 0.5) * 1.5;
      const distance = r * (0.65 + rand() * 1.65);
      const size = r * (0.055 + (1 - distance / (r * 2.4)) * 0.13 + rand() * 0.045);
      ctx.globalAlpha = (0.45 + rand() * 0.35) * intensity;
      ctx.fillStyle = rand() > 0.72 ? "rgb(96, 3, 17)" : "rgb(153, 8, 27)";
      fillEllipse(
        ctx,
        Math.cos(spread) * distance,
        Math.sin(spread) * distance,
        Math.max(r * 0.035, size * (0.9 + rand() * 0.5)),
        Math.max(r * 0.03, size),
      );
    }
    ctx.restore();
  }

  /** Food splat: unmistakably tomato pulp or broken egg, never blood-like. */
  private paintSplat({ x, y, kind, seed, scale }: SplatMark) {
    const { ctx } = this;
    const rand = mulberry32(seed * 104729);
    const r = this.canvas.width * 0.11 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(kind === "egg" ? (rand() - 0.5) * 0.44 : rand() * Math.PI * 2);
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
      paintBrokenEgg(ctx, r, rand);
    }
    ctx.restore();
  }
}

function paintBrokenEgg(ctx: CanvasRenderingContext2D, r: number, rand: () => number) {
  // A raw broken egg: irregular translucent albumen, a dimensional yolk,
  // a short gravity drip, and angular shell fragments.
  ctx.filter = `blur(${Math.max(0.6, r * 0.012)}px)`;
  ctx.globalCompositeOperation = "source-over";

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "rgb(76,58,34)";
  fillOrganicBlob(ctx, r * 0.04, r * 0.08, r * 1.08, r * 0.76, rand);

  ctx.globalAlpha = 0.76;
  ctx.fillStyle = "rgb(255,252,232)";
  fillOrganicBlob(ctx, 0, 0, r, r * 0.7, rand);
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "rgb(255,255,248)";
  fillOrganicBlob(ctx, -r * 0.05, -r * 0.02, r * 0.68, r * 0.48, rand);

  const dripX = (rand() - 0.5) * r * 0.34;
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "rgb(255,252,232)";
  ctx.beginPath();
  ctx.moveTo(dripX - r * 0.12, r * 0.4);
  ctx.bezierCurveTo(
    dripX - r * 0.08,
    r * 0.72,
    dripX - r * 0.04,
    r * 0.92,
    dripX,
    r * 1.08,
  );
  ctx.bezierCurveTo(
    dripX + r * 0.12,
    r * 0.92,
    dripX + r * 0.14,
    r * 0.65,
    dripX + r * 0.12,
    r * 0.4,
  );
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.98;
  const yolk = ctx.createRadialGradient(-r * 0.12, -r * 0.14, 1, 0, 0, r * 0.38);
  yolk.addColorStop(0, "rgb(255,224,102)");
  yolk.addColorStop(0.58, "rgb(247,178,43)");
  yolk.addColorStop(1, "rgb(203,111,18)");
  ctx.fillStyle = yolk;
  fillEllipse(ctx, 0, 0, r * 0.38, r * 0.33);

  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "rgb(255,250,205)";
  fillEllipse(ctx, -r * 0.11, -r * 0.1, r * 0.1, r * 0.065);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.6;
    const d = r * (0.62 + rand() * 0.4);
    const size = r * (0.12 + rand() * 0.05);
    ctx.save();
    ctx.translate(Math.cos(a) * d, Math.sin(a) * d * 0.72);
    ctx.rotate(a + rand() * 0.9);
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = "rgb(235,224,199)";
    ctx.beginPath();
    ctx.moveTo(-size, size * 0.55);
    ctx.lineTo(-size * 0.3, -size * 0.72);
    ctx.lineTo(size * 0.22, -size * 0.25);
    ctx.lineTo(size, -size * 0.62);
    ctx.lineTo(size * 0.72, size * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "rgb(151,126,91)";
    ctx.lineWidth = Math.max(1, r * 0.018);
    ctx.stroke();
    ctx.restore();
  }
}

function fillOrganicBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rand: () => number,
) {
  const points = 18;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const wobble = 0.78 + rand() * 0.35;
    const px = x + Math.cos(a) * rx * wobble;
    const py = y + Math.sin(a) * ry * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
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
