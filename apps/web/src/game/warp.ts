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
  active = false;

  /** Impact at (lx, ly) in [-1,1] face space, pushing along (dirX, dirY). */
  punch(lx: number, ly: number, dirX: number, dirY: number, strength: number) {
    const amp = Math.min(0.5, 0.3 * strength) * 15;
    for (let iy = 0; iy < VH; iy++) {
      for (let ix = 0; ix < VW; ix++) {
        const i = iy * VW + ix;
        const px = (ix / NX) * 2 - 1;
        const py = (iy / NY) * 2 - 1;
        const d = Math.hypot(px - lx, py - ly);
        const falloff = Math.exp(-((d / 0.55) ** 2));
        this.vx[i] += dirX * amp * falloff;
        this.vy[i] += dirY * amp * falloff;
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
