/**
 * Elastic warp-grid over the face bitmap — the 2.5D dent effect.
 *
 * Vertices live in normalized face space ([-1,1] across the face oval) and act
 * as independent damped springs. A punch kicks vertices near the impact point
 * along the punch direction with Gaussian falloff; they spring back over
 * ~0.5s. While any vertex is displaced the face renders as textured triangles;
 * at rest it falls back to a single drawImage (zero overhead).
 */

const NX = 10;
const NY = 12;
const VW = NX + 1;
const VH = NY + 1;
const SPRING_K = 160;
const SPRING_C = 13;
const SETTLE_EPS = 0.0025;

export class FaceWarp {
  private ox = new Float32Array(VW * VH);
  private oy = new Float32Array(VW * VH);
  private vx = new Float32Array(VW * VH);
  private vy = new Float32Array(VW * VH);
  private softness = defaultSoftness();
  active = false;

  /** Per-vertex flesh softness [0.2, 1] — cheeks squishy, forehead stiff. */
  setSoftness(map: Float32Array) {
    this.softness = map;
  }

  /** Impact at (lx, ly) in [-1,1] face space, pushing along (dirX, dirY). */
  punch(lx: number, ly: number, dirX: number, dirY: number, strength: number) {
    const amp = Math.min(0.5, 0.3 * strength) * 19;
    for (let iy = 0; iy < VH; iy++) {
      for (let ix = 0; ix < VW; ix++) {
        const i = iy * VW + ix;
        const px = (ix / NX) * 2 - 1;
        const py = (iy / NY) * 2 - 1;
        const dx = px - lx;
        const dy = py - ly;
        const d = Math.hypot(dx, dy);
        const soft = this.softness[i] ?? 1;
        // dent: push along the punch direction near the impact
        const dent = Math.exp(-((d / 0.55) ** 2));
        // volume conservation: a ring of flesh around the dent bulges outward
        const ring = Math.exp(-(((d - 0.85) / 0.32) ** 2));
        const bx = d > 1e-4 ? dx / d : 0;
        const by = d > 1e-4 ? dy / d : 0;
        this.vx[i] += (dirX * dent + bx * 0.4 * ring) * amp * soft;
        this.vy[i] += (dirY * dent + by * 0.4 * ring) * amp * soft;
      }
    }
    this.active = true;
  }

  update(dt: number) {
    if (!this.active) return;
    let maxDisp = 0;
    for (let i = 0; i < VW * VH; i++) {
      this.vx[i] += (-SPRING_K * this.ox[i] - SPRING_C * this.vx[i]) * dt;
      this.vy[i] += (-SPRING_K * this.oy[i] - SPRING_C * this.vy[i]) * dt;
      this.ox[i] += this.vx[i] * dt;
      this.oy[i] += this.vy[i] * dt;
      const disp = Math.abs(this.ox[i]) + Math.abs(this.oy[i]) + (Math.abs(this.vx[i]) + Math.abs(this.vy[i])) * 0.05;
      if (disp > maxDisp) maxDisp = disp;
    }
    if (maxDisp < SETTLE_EPS) {
      this.ox.fill(0);
      this.oy.fill(0);
      this.vx.fill(0);
      this.vy.fill(0);
      this.active = false;
    }
  }

  reset() {
    this.ox.fill(0);
    this.oy.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.active = false;
  }

  /** Draw the face centered at the current transform, spanning ±rx / ±ry. */
  draw(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, rx: number, ry: number) {
    if (!this.active) {
      ctx.drawImage(img, -rx, -ry, rx * 2, ry * 2);
      return;
    }
    const iw = img.width / NX;
    const ih = img.height / NY;
    const dst = (ix: number, iy: number): [number, number] => {
      const i = iy * VW + ix;
      return [((ix / NX) * 2 - 1 + this.ox[i]!) * rx, ((iy / NY) * 2 - 1 + this.oy[i]!) * ry];
    };
    for (let cy = 0; cy < NY; cy++) {
      for (let cx = 0; cx < NX; cx++) {
        const sx = cx * iw;
        const sy = cy * ih;
        const p00 = dst(cx, cy);
        const p10 = dst(cx + 1, cy);
        const p11 = dst(cx + 1, cy + 1);
        const p01 = dst(cx, cy + 1);
        drawTexturedTriangle(ctx, img, sx, sy, sx + iw, sy, sx + iw, sy + ih, p00, p10, p11);
        drawTexturedTriangle(ctx, img, sx, sy, sx + iw, sy + ih, sx, sy + ih, p00, p11, p01);
      }
    }
  }
}

// canonical MediaPipe FaceMesh anchor indices
const LM_RIGHT_CHEEK = 50;
const LM_LEFT_CHEEK = 280;
const LM_CHIN = 152;
const LM_FOREHEAD = 10;

/**
 * Per-vertex softness from face landmarks (normalized [0,1] crop coords):
 * Gaussian soft fields around the cheeks and chin, a stiff field around the
 * forehead, everything clamped to [0.2, 1].
 */
export function buildSoftnessFromLandmarks(
  landmarks: Array<{ x: number; y: number }>,
): Float32Array | null {
  const cheekR = landmarks[LM_RIGHT_CHEEK];
  const cheekL = landmarks[LM_LEFT_CHEEK];
  const chin = landmarks[LM_CHIN];
  const forehead = landmarks[LM_FOREHEAD];
  if (!cheekR || !cheekL || !chin || !forehead) return null;

  const toFace = (p: { x: number; y: number }) => ({ x: p.x * 2 - 1, y: p.y * 2 - 1 });
  const soften = [toFace(cheekR), toFace(cheekL), toFace(chin)];
  const stiff = toFace(forehead);

  const map = new Float32Array(VW * VH);
  for (let iy = 0; iy < VH; iy++) {
    for (let ix = 0; ix < VW; ix++) {
      const px = (ix / NX) * 2 - 1;
      const py = (iy / NY) * 2 - 1;
      let s = 0.5;
      for (const a of soften) {
        s += 0.5 * Math.exp(-((Math.hypot(px - a.x, py - a.y) / 0.5) ** 2));
      }
      s -= 0.45 * Math.exp(-((Math.hypot(px - stiff.x, py - stiff.y) / 0.6) ** 2));
      map[iy * VW + ix] = Math.max(0.2, Math.min(1, s));
    }
  }
  return map;
}

/** Fallback when no landmarks: lower face progressively softer than the brow. */
export function defaultSoftness(): Float32Array {
  const map = new Float32Array(VW * VH);
  for (let iy = 0; iy < VH; iy++) {
    for (let ix = 0; ix < VW; ix++) {
      const py = (iy / NY) * 2 - 1;
      const t = Math.max(0, Math.min(1, (py + 0.4) / 1.1));
      map[iy * VW + ix] = 0.45 + 0.5 * t;
    }
  }
  return map;
}

/** Affine-map a source triangle of img onto a destination triangle. */
function drawTexturedTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  u2: number,
  v2: number,
  [x0, y0]: [number, number],
  [x1, y1]: [number, number],
  [x2, y2]: [number, number],
) {
  const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (den === 0) return;

  // inflate the clip triangle ~0.5px around its centroid to hide seams
  const gx = (x0 + x1 + x2) / 3;
  const gy = (y0 + y1 + y2) / 3;
  const inflate = (x: number, y: number): [number, number] => {
    const dx = x - gx;
    const dy = y - gy;
    const len = Math.hypot(dx, dy) || 1;
    return [x + (dx / len) * 0.5, y + (dy / len) * 0.5];
  };
  const [cx0, cy0] = inflate(x0, y0);
  const [cx1, cy1] = inflate(x1, y1);
  const [cx2, cy2] = inflate(x2, y2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx0, cy0);
  ctx.lineTo(cx1, cy1);
  ctx.lineTo(cx2, cy2);
  ctx.closePath();
  ctx.clip();

  const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
  const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
  const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
  const d = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
  const e = x0 - a * u0 - c * v0;
  const f = y0 - b * u0 - d * v0;
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}
