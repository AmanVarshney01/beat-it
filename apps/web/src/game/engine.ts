import Matter from "matter-js";

import { SoundPlayer } from "./audio";
import { ParticleSystem } from "./particles";
import { FaceWarp } from "./warp";

export interface GameStats {
  hits: number;
  combo: number;
  damageStage: number;
}

interface Fist {
  from: { x: number; y: number };
  to: { x: number; y: number };
  angle: number;
  t: number; // 0..1 through the whole punch
  strength: number;
  hasHit: boolean;
}

const FIST_DURATION = 0.24; // seconds, impact at IMPACT_T
const IMPACT_T = 0.5;
const COMBO_WINDOW = 1.0; // seconds between hits to keep a combo alive
export const DAMAGE_THRESHOLDS = [5, 15, 30, 50];

/**
 * The whole game scene: a matter.js head on a damped spring (punching-dummy
 * style), fists, squash-and-stretch, screen shake, particles, sounds and
 * cartoon damage stickers. React only sees `punch()`, `reset()` and the
 * `onStats` callback — all per-frame state lives here, outside React.
 */
export class PunchGame {
  readonly sounds = new SoundPlayer();

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private face: HTMLCanvasElement;
  private onStats: (stats: GameStats) => void;

  private engine!: Matter.Engine;
  private head!: Matter.Body;
  private mount = { x: 0, y: 0 };
  private headRadius = 80;

  private particles = new ParticleSystem();
  private fists: Fist[] = [];
  private warp = new FaceWarp();

  // damped-oscillator squash: positive = squashed, negative = overshoot stretch
  private squash = 0;
  private squashVel = 0;
  private squashAngle = 0;

  private shakeMag = 0;
  private hits = 0;
  private combo = 0;
  private lastHitAt = -Infinity;
  private elapsed = 0;

  private rafId = 0;
  private lastFrame = 0;
  private resizeObserver: ResizeObserver;
  private destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    face: HTMLCanvasElement,
    onStats: (stats: GameStats) => void,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D not supported");
    this.ctx = ctx;
    this.face = face;
    this.onStats = onStats;

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(canvas);
    this.layout();

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  /** Size the canvas to its CSS box and (re)build the physics world around it. */
  private layout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // the face IS the app — let it dominate the viewport
    this.mount = { x: w / 2, y: h * 0.44 };
    this.headRadius = Math.max(90, Math.min(400, Math.min(w, h) * 0.34));

    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
    this.engine = Matter.Engine.create();
    this.engine.gravity.y = 0.5;

    const r = this.headRadius;
    this.head = Matter.Bodies.circle(this.mount.x, this.mount.y, r * 0.9, {
      frictionAir: 0.035,
      restitution: 0.6,
    });
    // stiff damped neck spring from the dummy's shoulders to the chin…
    const neck = Matter.Constraint.create({
      pointA: { x: this.mount.x, y: this.mount.y + r * 1.25 },
      bodyB: this.head,
      pointB: { x: 0, y: r * 0.8 },
      stiffness: 0.07,
      damping: 0.08,
      length: 0,
    });
    // …plus a soft centering spring so the head always settles back upright.
    const center = Matter.Constraint.create({
      pointA: { ...this.mount },
      bodyB: this.head,
      pointB: { x: 0, y: 0 },
      stiffness: 0.02,
      damping: 0.05,
      length: 0,
    });
    Matter.World.add(this.engine.world, [this.head, neck, center]);
  }

  /** True when the point (canvas coords) is on the head — used for tap-to-punch. */
  hitTestHead(point: { x: number; y: number }): boolean {
    const dx = point.x - this.head.position.x;
    const dy = point.y - this.head.position.y;
    return Math.hypot(dx, dy) <= this.headRadius * 1.2;
  }

  /** Throw a punch. Without a target, aims at a random spot on the head. */
  punch(target?: { x: number; y: number }) {
    const headPos = this.head.position;
    const to = target ?? {
      x: headPos.x + (Math.random() - 0.5) * this.headRadius,
      y: headPos.y + (Math.random() - 0.5) * this.headRadius * 0.8,
    };
    const fromAngle = Math.atan2(to.y - headPos.y, to.x - headPos.x);
    // fist flies in along the impact direction, from ~4 head-radii out
    const dist = this.headRadius * 4.2;
    const from = {
      x: to.x + Math.cos(fromAngle) * dist,
      y: to.y + Math.sin(fromAngle) * dist,
    };
    const critical = Math.random() < 0.08;
    const strength = critical ? 1.9 : 0.8 + Math.random() * 0.5;

    // concurrent fists so button-mashing never drops an input
    this.fists.push({
      from,
      to,
      angle: Math.atan2(headPos.y - to.y, headPos.x - to.x),
      t: 0,
      strength,
      hasHit: false,
    });
    if (this.fists.length > 6) this.fists.shift();
    this.sounds.whoosh();
  }

  reset() {
    this.hits = 0;
    this.combo = 0;
    this.lastHitAt = -Infinity;
    this.particles.clear();
    this.fists = [];
    this.squash = 0;
    this.squashVel = 0;
    this.shakeMag = 0;
    this.warp.reset();
    Matter.Body.setPosition(this.head, { ...this.mount });
    Matter.Body.setVelocity(this.head, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(this.head, 0);
    Matter.Body.setAngle(this.head, 0);
    this.emitStats();
  }

  get damageStage(): number {
    return DAMAGE_THRESHOLDS.filter((t) => this.hits >= t).length;
  }

  private emitStats() {
    this.onStats({ hits: this.hits, combo: this.combo, damageStage: this.damageStage });
  }

  private landPunch(fist: Fist) {
    const impact = fist.to;
    const dir = fist.angle;

    Matter.Body.setVelocity(this.head, {
      x: this.head.velocity.x + Math.cos(dir) * 16 * fist.strength,
      y: this.head.velocity.y + Math.sin(dir) * 16 * fist.strength - 3,
    });
    const spin = (impact.y < this.head.position.y ? 1 : -1) * Math.sign(Math.cos(dir) || 1);
    Matter.Body.setAngularVelocity(this.head, spin * (0.12 + 0.1 * fist.strength));

    this.squash = 1;
    this.squashVel = 0;
    this.squashAngle = dir;

    // 2.5D dent: convert the impact into head-local face space and deform the mesh
    const renderAngle = this.head.angle * 0.6;
    const cosA = Math.cos(-renderAngle);
    const sinA = Math.sin(-renderAngle);
    const dx = impact.x - this.head.position.x;
    const dy = impact.y - this.head.position.y;
    const r = this.headRadius;
    const lx = Math.max(-1.1, Math.min(1.1, (dx * cosA - dy * sinA) / (r * 0.88)));
    const ly = Math.max(-1.1, Math.min(1.1, (dx * sinA + dy * cosA) / (r * 1.08)));
    const dirLx = Math.cos(dir) * cosA - Math.sin(dir) * sinA;
    const dirLy = Math.cos(dir) * sinA + Math.sin(dir) * cosA;
    this.warp.punch(lx, ly, dirLx, dirLy, fist.strength);
    this.shakeMag = Math.min(30, this.shakeMag + 5 + 9 * fist.strength);
    this.particles.burst(impact.x, impact.y, fist.strength, this.headRadius / 90);
    this.sounds.punch(fist.strength);

    const now = this.elapsed;
    this.combo = now - this.lastHitAt <= COMBO_WINDOW ? this.combo + 1 : 1;
    this.lastHitAt = now;
    this.hits += 1;
    if (this.combo > 0 && this.combo % 5 === 0) this.sounds.comboDing(this.combo / 5);
    this.emitStats();
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(1 / 30, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.elapsed += dt;

    Matter.Engine.update(this.engine, dt * 1000);

    for (const fist of this.fists) {
      const before = fist.t;
      fist.t += dt / FIST_DURATION;
      if (!fist.hasHit && before < IMPACT_T && fist.t >= IMPACT_T) {
        fist.hasHit = true;
        this.landPunch(fist);
      }
    }
    this.fists = this.fists.filter((f) => f.t < 1);

    // damped oscillator → squash springs past zero into a stretch overshoot
    const acc = -260 * this.squash - 14 * this.squashVel;
    this.squashVel += acc * dt;
    this.squash += this.squashVel * dt;

    this.shakeMag *= Math.exp(-dt * 9);
    if (this.shakeMag < 0.05) this.shakeMag = 0;

    if (this.combo > 0 && this.elapsed - this.lastHitAt > COMBO_WINDOW) {
      this.combo = 0;
      this.emitStats();
    }

    this.warp.update(dt);
    this.particles.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.frame);
  };

  private draw() {
    const { ctx } = this;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    if (this.shakeMag > 0) {
      ctx.translate((Math.random() - 0.5) * 2 * this.shakeMag, (Math.random() - 0.5) * 2 * this.shakeMag);
    }

    this.drawDummy(ctx, w, h);
    this.drawHead(ctx);
    for (const fist of this.fists) this.drawFist(ctx, fist);
    this.particles.draw(ctx);

    ctx.restore();
  }

  private drawDummy(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const r = this.headRadius;
    const torsoTop = this.mount.y + r * 1.25;
    const torsoW = r * 2.3;
    // the torso may run off the bottom edge on short viewports — that's fine
    const torsoH = r * 2.2;

    // soft spotlight anchoring the dummy in the frame
    ctx.save();
    const spot = ctx.createRadialGradient(
      this.mount.x,
      this.mount.y,
      r * 0.3,
      this.mount.x,
      this.mount.y,
      Math.max(w, h) * 0.7,
    );
    spot.addColorStop(0, "rgba(255,255,255,0.09)");
    spot.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(-40, -40, w + 80, h + 80);
    ctx.restore();

    // floor shadow tracks the head so the wobble reads
    const shadowY = Math.min(torsoTop + torsoH + 8, h - 24);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(this.head.position.x, shadowY, torsoW * 0.62, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // torso
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1f1f1f";
    ctx.fillStyle = "#e23c3c";
    roundRect(ctx, this.mount.x - torsoW / 2, torsoTop, torsoW, torsoH, r * 0.5);
    ctx.fill();
    ctx.stroke();
    // chest star, because every dummy deserves flair
    ctx.font = `${r * 0.6}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⭐", this.mount.x, torsoTop + torsoH * 0.45);
    ctx.restore();

    // spring coil from shoulders to the head's chin
    const neckStart = { x: this.mount.x, y: torsoTop + 4 };
    const chin = {
      x: this.head.position.x + Math.sin(this.head.angle) * r * 0.8,
      y: this.head.position.y + Math.cos(this.head.angle) * r * 0.8,
    };
    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#6b7280";
    ctx.lineCap = "round";
    ctx.beginPath();
    const coils = 5;
    const dx = chin.x - neckStart.x;
    const dy = chin.y - neckStart.y;
    const nx = -dy;
    const ny = dx;
    const nLen = Math.hypot(nx, ny) || 1;
    ctx.moveTo(neckStart.x, neckStart.y);
    for (let i = 1; i <= coils; i++) {
      const t = i / (coils + 1);
      const side = i % 2 === 0 ? 1 : -1;
      ctx.lineTo(
        neckStart.x + dx * t + (nx / nLen) * side * r * 0.22,
        neckStart.y + dy * t + (ny / nLen) * side * r * 0.22,
      );
    }
    ctx.lineTo(chin.x, chin.y);
    ctx.stroke();
    ctx.restore();
  }

  private drawHead(ctx: CanvasRenderingContext2D) {
    const r = this.headRadius;
    const pos = this.head.position;
    // subtle idle bob when the physics has settled
    const settled = Math.hypot(this.head.velocity.x, this.head.velocity.y) < 0.5;
    const bob = settled ? Math.sin(this.elapsed * 2.2) * 3 : 0;

    ctx.save();
    ctx.translate(pos.x, pos.y + bob);
    ctx.rotate(this.head.angle * 0.6);

    // fake yaw: fast sideways motion narrows the head, reading as a turn in depth
    const tilt = Math.max(-0.14, Math.min(0.14, this.head.velocity.x * 0.006));
    ctx.scale(1 - Math.abs(tilt), 1);

    // render-only squash along the impact axis
    const s = Math.max(-0.5, Math.min(1, this.squash));
    ctx.rotate(this.squashAngle);
    ctx.scale(1 - 0.32 * s, 1 + 0.26 * s);
    ctx.rotate(-this.squashAngle);

    const rx = r * 0.88;
    const ry = r * 1.08;
    this.warp.draw(ctx, this.face, rx, ry);
    this.drawDamage(ctx, rx, ry);
    this.drawShading(ctx, rx, ry);
    ctx.restore();

    // dizzy stars orbit outside the squashed transform so they stay crisp
    if (this.damageStage >= 4) {
      ctx.save();
      ctx.font = `${r * 0.34}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 3; i++) {
        const a = this.elapsed * 4 + (i * Math.PI * 2) / 3;
        ctx.globalAlpha = 0.9;
        ctx.fillText("💫", pos.x + Math.cos(a) * r * 0.9, pos.y - ry - r * 0.25 + Math.sin(a) * r * 0.22);
      }
      ctx.restore();
    }
  }

  /** Dome shading: top-left highlight + rim shadow so the face reads as 3D. */
  private drawShading(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    const highlight = ctx.createRadialGradient(-rx * 0.32, -ry * 0.38, rx * 0.05, -rx * 0.32, -ry * 0.38, rx * 1.15);
    highlight.addColorStop(0, "rgba(255,255,255,0.16)");
    highlight.addColorStop(0.55, "rgba(255,255,255,0.04)");
    highlight.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = highlight;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

    const rim = ctx.createRadialGradient(0, 0, ry * 0.5, 0, 0, ry * 1.02);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(0.78, "rgba(0,0,0,0.05)");
    rim.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = rim;
    ctx.fillRect(-rx, -ry, rx * 2, ry * 2);
    ctx.restore();
  }

  /** Cartoon damage stickers, anchored to the face oval, keyed to hit thresholds. */
  private drawDamage(ctx: CanvasRenderingContext2D, rx: number, ry: number) {
    const stage = this.damageStage;
    if (stage >= 1) {
      // black eye — dark radial blotch over the left eye
      const g = ctx.createRadialGradient(-rx * 0.34, -ry * 0.18, 2, -rx * 0.34, -ry * 0.18, rx * 0.3);
      g.addColorStop(0, "rgba(70,40,110,0.85)");
      g.addColorStop(0.7, "rgba(90,60,130,0.5)");
      g.addColorStop(1, "rgba(90,60,130,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-rx * 0.34, -ry * 0.18, rx * 0.3, rx * 0.24, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (stage >= 2) {
      // bruise on the right cheek
      const g = ctx.createRadialGradient(rx * 0.4, ry * 0.25, 2, rx * 0.4, ry * 0.25, rx * 0.26);
      g.addColorStop(0, "rgba(110,60,140,0.7)");
      g.addColorStop(0.6, "rgba(60,110,80,0.4)");
      g.addColorStop(1, "rgba(60,110,80,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(rx * 0.4, ry * 0.25, rx * 0.26, rx * 0.2, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    if (stage >= 3) {
      // band-aid across the forehead
      ctx.save();
      ctx.translate(rx * 0.1, -ry * 0.55);
      ctx.rotate(-0.45);
      ctx.font = `${rx * 0.55}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🩹", 0, 0);
      ctx.restore();
    }
  }

  private drawFist(ctx: CanvasRenderingContext2D, fist: Fist) {
    // in fast (0 → IMPACT_T), retract slower (IMPACT_T → 1)
    const t = fist.t;
    const travel = t < IMPACT_T ? easeInCubic(t / IMPACT_T) : 1 - easeOutCubic((t - IMPACT_T) / (1 - IMPACT_T)) * 0.9;
    const x = fist.from.x + (fist.to.x - fist.from.x) * travel;
    const y = fist.from.y + (fist.to.y - fist.from.y) * travel;
    const size = this.headRadius * 1.15;

    ctx.save();
    ctx.translate(x, y);
    // glove emoji points up-left by default; rotate it to face the head
    ctx.rotate(fist.angle + Math.PI * 0.75);
    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🥊", 0, 0);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeInCubic(t: number) {
  return t * t * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
