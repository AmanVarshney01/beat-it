import type { Landmark3 } from "./face3d/head3d";

/**
 * Paints damage directly into a working copy of the face bitmap so bruises
 * live ON the skin: they wrap and light with the 3D mesh, and the 2D warp
 * draws the same canvas. Repaints only on damage-stage changes, never per
 * frame. Tone line: bruising and discoloration only — no blood, cuts or gore.
 */

interface Anchor {
  x: number; // px in face-canvas space
  y: number;
  r: number; // bruise radius px
}

// canonical FaceMesh indices
const LM_RIGHT_EYE_LOWER = 145;
const LM_LEFT_CHEEK = 280;
const LM_LEFT_BROW = 334;
const LM_CHIN = 152;

export class DamagePainter {
  /** The canvas the game should render/texture from. Same size as the base. */
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private base: HTMLCanvasElement;
  private anchors: { eye: Anchor; cheek: Anchor; brow: Anchor; jaw: Anchor };

  constructor(base: HTMLCanvasElement, landmarks: Landmark3[] | null) {
    this.base = base;
    this.canvas = document.createElement("canvas");
    this.canvas.width = base.width;
    this.canvas.height = base.height;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;

    const w = base.width;
    const h = base.height;
    const at = (lm: Landmark3 | undefined, fx: number, fy: number, fr: number): Anchor => ({
      x: (lm ? lm.x : fx) * w,
      y: (lm ? lm.y : fy) * h,
      r: fr * w,
    });
    this.anchors = {
      eye: at(landmarks?.[LM_RIGHT_EYE_LOWER], 0.33, 0.42, 0.16),
      cheek: at(landmarks?.[LM_LEFT_CHEEK], 0.7, 0.58, 0.14),
      brow: at(landmarks?.[LM_LEFT_BROW], 0.68, 0.33, 0.12),
      jaw: at(landmarks?.[LM_CHIN], 0.5, 0.85, 0.13),
    };
    this.paint(0);
  }

  /** Repaint the working canvas for a damage stage (cumulative). */
  paint(stage: number) {
    const { ctx } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.restore();
    if (stage <= 0) return;

    const boost = stage >= 4 ? 1.45 : 1;
    const { eye, cheek, brow, jaw } = this.anchors;
    // fresh black eye first, older bruises join at later thresholds
    this.bruise(eye, 0.36, boost, 1); // socket: offset slightly below the eye
    if (stage >= 2) this.bruise(cheek, 0, 0.9 * boost, 2);
    if (stage >= 3) {
      this.bruise(brow, -0.2, 0.8 * boost, 3);
      this.bruise({ ...jaw, y: jaw.y - jaw.r * 0.4 }, 0.1, 0.75 * boost, 4);
    }
  }

  /**
   * One bruise: yellow-green aged halo → red-violet body → dark core →
   * seeded mottling, all multiplied over the skin so tone shows through.
   */
  private bruise(anchor: Anchor, yShift: number, intensity: number, seed: number) {
    const { ctx } = this;
    const x = anchor.x;
    const y = anchor.y + anchor.r * yShift;
    const r = anchor.r;
    const rand = mulberry32(seed * 7919 + Math.floor(x + y));
    const tilt = (rand() - 0.5) * 0.9;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.globalCompositeOperation = "multiply";
    // soften every layer so mottling reads as diffuse discoloration, not dots
    ctx.filter = `blur(${Math.max(2, r * 0.09)}px)`;

    // aged yellow-green halo
    ctx.globalAlpha = Math.min(1, 0.5 * intensity);
    let g = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.35);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.55, "rgba(196,190,120,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    fillEllipse(ctx, 0, 0, r * 1.4, r * 1.15);

    // main red-violet body
    ctx.globalAlpha = Math.min(1, 0.85 * intensity);
    g = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r);
    g.addColorStop(0, "rgba(120,38,64,0.72)");
    g.addColorStop(0.55, "rgba(96,60,132,0.5)");
    g.addColorStop(1, "rgba(120,80,140,0)");
    ctx.fillStyle = g;
    fillEllipse(ctx, 0, 0, r * 1.05, r * 0.85);

    // deep core
    ctx.globalAlpha = Math.min(1, 0.7 * intensity);
    g = ctx.createRadialGradient(-r * 0.1, -r * 0.05, 1, -r * 0.1, -r * 0.05, r * 0.42);
    g.addColorStop(0, "rgba(58,16,44,0.6)");
    g.addColorStop(1, "rgba(58,16,44,0)");
    ctx.fillStyle = g;
    fillEllipse(ctx, -r * 0.1, -r * 0.05, r * 0.5, r * 0.4);

    // mottling: small irregular pools of discoloration
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
