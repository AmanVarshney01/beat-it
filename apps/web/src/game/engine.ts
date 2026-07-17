import Matter from "matter-js";

import { SoundPlayer } from "./audio";
import { DamagePainter } from "./damage";
import { renderWeaponIcon, Scene3D } from "./face3d/scene3d";
import { drawStar, ParticleSystem, type ShapeKind } from "./particles";
import type { AttackKind, Landmark3 } from "./types";
import { FaceWarp } from "./warp";

export type { AttackKind, Landmark3 } from "./types";

export interface GameStats {
  hits: number;
  combo: number;
  damageStage: number;
}

/** arcing thrown projectiles that vanish into a mark on impact */
const FOOD_ATTACKS: ReadonlySet<AttackKind> = new Set(["tomato", "egg", "pie", "chili", "noodles"]);
/** horizontal side sweeps */
const SWEEP_ATTACKS: ReadonlySet<AttackKind> = new Set(["slap", "fish"]);

export interface GameSettings {
  shake: boolean;
  particles: boolean;
  damage: boolean;
  dizzyStars: boolean;
  sway: boolean;
}

interface Fist {
  id: number;
  attack: AttackKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  angle: number;
  t: number; // 0..1 through the whole attack
  duration: number; // seconds, impact at IMPACT_T
  strength: number;
  hasHit: boolean;
}

const IMPACT_T = 0.5;
const ATTACK_DURATION: Record<AttackKind, number> = {
  punch: 0.24,
  slap: 0.3,
  tomato: 0.45,
  egg: 0.45,
  mallet: 0.32,
  fish: 0.34,
  pie: 0.45,
  chili: 0.45,
  noodles: 0.5,
};

const ATTACK_SHAPES: Partial<Record<AttackKind, readonly ShapeKind[]>> = {
  chili: ["flame", "smoke"],
  fish: ["droplet", "star"],
  mallet: ["spark", "star"],
  noodles: ["sauce", "smoke"],
};
const COMBO_WINDOW = 1.0; // seconds between hits to keep a combo alive
export const DAMAGE_THRESHOLDS = [5, 15, 30, 50];

export interface PunchGameOptions {
  /** background scene layer: spotlight, torso, spring, shadow (+ head in 2D mode) */
  bg: HTMLCanvasElement;
  /** foreground effects layer: fists, particles, damage overlay */
  fg: HTMLCanvasElement;
  /** WebGL layer between them for the 3D head (unused in 2D fallback mode) */
  gl: HTMLCanvasElement;
  face: HTMLCanvasElement;
  /** face landmarks with depth; null → 2D warp fallback mode */
  landmarks: Landmark3[] | null;
  onStats: (stats: GameStats) => void;
}

/**
 * The whole game scene: a matter.js head on a damped spring (punching-dummy
 * style), fists, squash-and-stretch, screen shake, particles, sounds and
 * cartoon damage stickers. When landmarks are available the head renders as a
 * real 3D mesh (Head3D) sandwiched between the two 2D canvas layers; without
 * them it falls back to the 2D warp pipeline. React only sees `punch()`,
 * `reset()` and the `onStats` callback — all per-frame state lives here.
 */
export class PunchGame {
  readonly sounds = new SoundPlayer();

  private bg: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private fgCtx: CanvasRenderingContext2D;
  private face: HTMLCanvasElement;
  private damage: DamagePainter;
  private neckColor: string;
  private scene3d: Scene3D | null = null;
  private onStats: (stats: GameStats) => void;
  private nextFistId = 1;

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

  private settings: GameSettings = {
    shake: true,
    particles: true,
    damage: true,
    dizzyStars: true,
    sway: true,
  };

  private shakeMag = 0;
  private shakeX = 0;
  private shakeY = 0;
  private hits = 0;
  private combo = 0;
  private lastHitAt = -Infinity;
  private elapsed = 0;

  private rafId = 0;
  private lastFrame = 0;
  private resizeObserver: ResizeObserver;
  private destroyed = false;

  constructor(opts: PunchGameOptions) {
    this.bg = opts.bg;
    const bgCtx = opts.bg.getContext("2d");
    const fgCtx = opts.fg.getContext("2d");
    if (!bgCtx || !fgCtx) throw new Error("Canvas 2D not supported");
    this.bgCtx = bgCtx;
    this.fgCtx = fgCtx;
    this.face = opts.face;
    this.onStats = opts.onStats;

    // all rendering (2D warp and 3D texture) reads the damage-painted canvas
    this.damage = new DamagePainter(opts.face);
    this.face = this.damage.canvas;
    this.neckColor = sampleSkin(opts.face);

    if (opts.landmarks) {
      try {
        this.scene3d = new Scene3D(opts.gl, this.face, opts.landmarks, this.neckColor);
      } catch (error) {
        console.warn("WebGL unavailable, falling back to 2D scene", error);
        this.scene3d = null;
      }
    }

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(opts.bg);
    this.layout();

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.scene3d?.dispose();
    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  /** Size all canvas layers to the CSS box and (re)build the physics world. */
  private layout() {
    const dpr = window.devicePixelRatio || 1;
    const w = this.bg.clientWidth || 1;
    const h = this.bg.clientHeight || 1;
    for (const [canvas, ctx] of [
      [this.bg, this.bgCtx],
      [this.fgCtx.canvas, this.fgCtx],
    ] as const) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.scene3d?.resize(w, h, dpr);

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

    const torsoTop = this.mount.y + r * 1.25;
    this.scene3d?.setLayout(this.mount, r, torsoTop, torsoTop + r * 2.2 + 8);
  }

  updateSettings(partial: Partial<GameSettings>) {
    Object.assign(this.settings, partial);
    if (this.scene3d) this.scene3d.swayEnabled = this.settings.sway;
  }

  /** True when the point (canvas coords) is on the head — used for tap-to-punch. */
  hitTestHead(point: { x: number; y: number }): boolean {
    const dx = point.x - this.head.position.x;
    const dy = point.y - this.head.position.y;
    return Math.hypot(dx, dy) <= this.headRadius * 1.2;
  }

  /** Launch the selected attack. Without a target, aims at a random head spot. */
  punch(target?: { x: number; y: number }, attack: AttackKind = "punch") {
    const headPos = this.head.position;
    const r = this.headRadius;
    const w = this.bg.clientWidth;
    const h = this.bg.clientHeight;
    const to = target ?? {
      x: headPos.x + (Math.random() - 0.5) * r,
      y: headPos.y + (Math.random() - 0.5) * r * 0.8,
    };
    const critical = Math.random() < 0.08;
    const strength = critical ? 1.9 : 0.8 + Math.random() * 0.5;

    let from: { x: number; y: number };
    let angle: number;
    if (SWEEP_ATTACKS.has(attack)) {
      // hand/fish sweeps in horizontally from the target's side of the screen
      const fromLeft = to.x <= headPos.x;
      from = { x: fromLeft ? -r * 1.6 : w + r * 1.6, y: to.y };
      angle = fromLeft ? 0 : Math.PI;
    } else if (attack === "mallet" || attack === "noodles") {
      // drops straight down from above the head
      from = { x: to.x + (attack === "noodles" ? (Math.random() - 0.5) * r * 0.4 : 0), y: Math.min(to.y - r * 3.6, -r * 0.5) };
      angle = Math.PI / 2;
    } else if (FOOD_ATTACKS.has(attack)) {
      // hurled from the viewer: arcs up from the bottom edge
      from = { x: to.x + (Math.random() - 0.5) * w * 0.25, y: h + r * 0.6 };
      angle = Math.atan2(to.y - from.y, to.x - from.x);
    } else {
      // fist flies in along the impact direction, from ~4 head-radii out
      const fromAngle = Math.atan2(to.y - headPos.y, to.x - headPos.x);
      const dist = r * 4.2;
      from = { x: to.x + Math.cos(fromAngle) * dist, y: to.y + Math.sin(fromAngle) * dist };
      angle = Math.atan2(headPos.y - to.y, headPos.x - to.x);
    }

    // concurrent attacks so button-mashing never drops an input
    const id = this.nextFistId++;
    this.fists.push({
      id,
      attack,
      from,
      to,
      angle,
      t: 0,
      duration: ATTACK_DURATION[attack],
      strength,
      hasHit: false,
    });
    this.scene3d?.spawnProjectile(id, attack);
    if (this.fists.length > 6) {
      const dropped = this.fists.shift();
      if (dropped) this.scene3d?.removeProjectile(dropped.id);
    }
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
    this.damage.clear();
    this.scene3d?.reset();
    this.scene3d?.refreshTexture();
    for (const f of this.fists) this.scene3d?.removeProjectile(f.id);
    this.fists = [];
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
    const isFood = FOOD_ATTACKS.has(fist.attack);
    const isSweep = SWEEP_ATTACKS.has(fist.attack);
    const isMallet = fist.attack === "mallet";
    // food knocks are soft; sweeps hit harder sideways; the mallet hits hardest
    const impulse = isFood ? 6 : isMallet ? 26 : isSweep ? 20 : 16;

    Matter.Body.setVelocity(this.head, {
      x: this.head.velocity.x + Math.cos(dir) * impulse * fist.strength,
      y: this.head.velocity.y + Math.sin(dir) * impulse * fist.strength - (isFood ? 1 : 3),
    });
    const spin = (impact.y < this.head.position.y ? 1 : -1) * Math.sign(Math.cos(dir) || 1);
    const spinScale = isSweep ? 0.3 : isFood ? 0.06 : isMallet ? 0.04 : 0.12;
    Matter.Body.setAngularVelocity(this.head, spin * (spinScale + 0.1 * fist.strength));

    this.squash = isFood ? 0.4 : isMallet ? 1.4 : 1;
    this.squashVel = 0;
    this.squashAngle = dir;

    // convert the impact into head-local face space for dent + located damage
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
    const dentStrength = isFood
      ? fist.strength * 0.35
      : isSweep
        ? fist.strength * 1.2
        : isMallet
          ? fist.strength * 1.4
          : fist.strength;
    if (this.scene3d) {
      this.scene3d.punchDent(lx, ly, dirLx, dirLy, dentStrength);
    } else {
      this.warp.punch(lx, ly, dirLx, dirLy, dentStrength);
    }

    // damage lands exactly where the attack hit (the fish is mark-free)
    if (this.settings.damage && fist.attack !== "fish") {
      const u = Math.max(0.03, Math.min(0.97, (lx + 1) / 2));
      const v = Math.max(0.03, Math.min(0.97, (ly + 1) / 2));
      if (isFood) {
        this.damage.splat(u, v, fist.attack as "tomato" | "egg" | "pie" | "chili" | "noodles");
      } else {
        this.damage.hit(u, v, fist.strength);
      }
      if (fist.attack === "noodles") this.scene3d?.addNoodleStrands(lx, ly);
      this.scene3d?.refreshTexture();
    }

    if (this.settings.shake) {
      const shakeScale = isFood ? 0.4 : isMallet ? 1.4 : 1;
      this.shakeMag = Math.min(34, this.shakeMag + (isFood ? 3 : 5) + 9 * fist.strength * shakeScale);
    }
    if (this.settings.particles) {
      this.particles.burst(
        impact.x,
        impact.y,
        fist.strength,
        this.headRadius / 90,
        ATTACK_SHAPES[fist.attack],
      );
    }
    if (fist.attack === "chili") this.sounds.sizzle();
    else if (fist.attack === "fish") this.sounds.fish(fist.strength);
    else if (isFood) this.sounds.splat();
    else if (isMallet) this.sounds.bonk(fist.strength);
    else if (isSweep) this.sounds.slap(fist.strength);
    else this.sounds.punch(fist.strength);

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
      fist.t += dt / fist.duration;
      if (!fist.hasHit && before < IMPACT_T && fist.t >= IMPACT_T) {
        fist.hasHit = true;
        this.landPunch(fist);
        // thrown things vanish into their splat
        if (FOOD_ATTACKS.has(fist.attack)) fist.t = 1;
      }
    }
    for (const f of this.fists) {
      if (f.t >= 1) this.scene3d?.removeProjectile(f.id);
    }
    this.fists = this.fists.filter((f) => f.t < 1);

    // damped oscillator → squash springs past zero into a stretch overshoot
    const acc = -260 * this.squash - 14 * this.squashVel;
    this.squashVel += acc * dt;
    this.squash += this.squashVel * dt;

    this.shakeMag *= Math.exp(-dt * 9);
    if (this.shakeMag < 0.05) this.shakeMag = 0;
    this.shakeX = (Math.random() - 0.5) * 2 * this.shakeMag;
    this.shakeY = (Math.random() - 0.5) * 2 * this.shakeMag;

    if (this.combo > 0 && this.elapsed - this.lastHitAt > COMBO_WINDOW) {
      this.combo = 0;
      this.emitStats();
    }

    this.warp.update(dt);
    this.scene3d?.update(dt);
    this.particles.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.frame);
  };

  private headBob(): number {
    const settled = Math.hypot(this.head.velocity.x, this.head.velocity.y) < 0.5;
    return settled ? Math.sin(this.elapsed * 2.2) * 3 : 0;
  }

  /** Where a projectile is along its flight right now (2D path + eased travel). */
  private projectilePoint(fist: Fist) {
    const t = fist.t;
    const isFood = FOOD_ATTACKS.has(fist.attack);
    const travel = t < IMPACT_T
      ? easeInCubic(t / IMPACT_T)
      : isFood
        ? 1
        : 1 - easeOutCubic((t - IMPACT_T) / (1 - IMPACT_T)) * 0.9;
    return {
      x: fist.from.x + (fist.to.x - fist.from.x) * travel,
      y: fist.from.y + (fist.to.y - fist.from.y) * travel,
      travel,
    };
  }

  private chinPoint() {
    const r = this.headRadius;
    return {
      x: this.head.position.x + Math.sin(this.head.angle) * r * 0.6,
      y: this.head.position.y + Math.cos(this.head.angle) * r * 0.55,
    };
  }

  private draw() {
    const w = this.bg.clientWidth;
    const h = this.bg.clientHeight;

    const bg = this.bgCtx;
    bg.clearRect(0, 0, w, h);

    if (this.scene3d) {
      // full 3D scene: room, dummy, head, projectiles
      this.scene3d.setHead(
        this.head.position.x,
        this.head.position.y + this.headBob(),
        this.head.angle * 0.6,
        this.headRadius * 0.88,
        this.headRadius * 1.08,
        this.squash,
        this.squashAngle,
      );
      const chin = this.chinPoint();
      this.scene3d.setNeck(
        chin.x,
        chin.y,
        this.mount.x,
        this.mount.y + this.headRadius * 1.31,
        this.headRadius * 0.3,
      );
      this.scene3d.setShake(this.shakeX, this.shakeY);
      for (const fist of this.fists) {
        const p = this.projectilePoint(fist);
        this.scene3d.moveProjectile(fist.id, fist.attack, p.x, p.y, fist.angle, p.travel, fist.t);
      }
      this.scene3d.render();
    } else {
      // 2D fallback: canvas dummy + warped head
      bg.save();
      bg.translate(this.shakeX, this.shakeY);
      this.drawDummy(bg, w, h);
      this.drawHead(bg);
      bg.restore();
    }

    // foreground layer: 2D-mode projectiles, particles, dizzy stars
    const fg = this.fgCtx;
    fg.clearRect(0, 0, w, h);
    fg.save();
    fg.translate(this.shakeX, this.shakeY);
    this.drawDamageOverlay(fg);
    if (!this.scene3d) {
      for (const fist of this.fists) this.drawFist(fg, fist);
    }
    this.particles.draw(fg);
    fg.restore();
  }

  /** Dizzy stars at max damage — bruises themselves live in the face texture. */
  private drawDamageOverlay(ctx: CanvasRenderingContext2D) {
    const r = this.headRadius;
    const pos = this.head.position;
    const ry = r * 1.08;
    if (this.settings.dizzyStars && this.damageStage >= 4) {
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const a = this.elapsed * 4 + (i * Math.PI * 2) / 3;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(
          pos.x + Math.cos(a) * r * 0.9,
          pos.y - ry - r * 0.25 + Math.sin(a) * r * 0.22,
        );
        ctx.rotate(a * 0.5);
        drawStar(ctx, r * 0.14, "#ffd94d", "#c98800");
        ctx.restore();
      }
      ctx.restore();
    }
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
    ctx.save();
    ctx.translate(this.mount.x, torsoTop + torsoH * 0.45);
    drawStar(ctx, r * 0.3, "#ffd94d", "#c98800");
    ctx.restore();
    ctx.restore();

    // neck: a shaded skin quad from the shoulders up under the chin,
    // stretching and tilting with the head (the physics spring is invisible)
    const baseHalf = r * 0.34;
    const topHalf = r * 0.26;
    const baseY = torsoTop + 8;
    const chin = {
      x: this.head.position.x + Math.sin(this.head.angle) * r * 0.6,
      y: this.head.position.y + Math.cos(this.head.angle) * r * 0.55,
    };
    const tiltX = Math.sin(this.head.angle) * topHalf * 0.4;
    ctx.save();
    const grad = ctx.createLinearGradient(0, chin.y, 0, baseY);
    grad.addColorStop(0, this.neckColor);
    grad.addColorStop(1, shade(this.neckColor, 0.78));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(this.mount.x - baseHalf, baseY);
    ctx.quadraticCurveTo(
      this.mount.x - baseHalf,
      (baseY + chin.y) / 2,
      chin.x - topHalf + tiltX,
      chin.y,
    );
    ctx.lineTo(chin.x + topHalf + tiltX, chin.y);
    ctx.quadraticCurveTo(
      this.mount.x + baseHalf,
      (baseY + chin.y) / 2,
      this.mount.x + baseHalf,
      baseY,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawHead(ctx: CanvasRenderingContext2D) {
    const r = this.headRadius;
    const pos = this.head.position;

    ctx.save();
    ctx.translate(pos.x, pos.y + this.headBob());
    ctx.rotate(this.head.angle * 0.6);

    // fake yaw: fast sideways motion narrows the head, reading as a turn in depth
    const tilt = Math.max(-0.14, Math.min(0.14, this.head.velocity.x * 0.006));
    ctx.scale(1 - Math.abs(tilt), 1);

    // render-only squash along the impact axis (mallet overshoots past 1)
    const s = Math.max(-0.5, Math.min(1.4, this.squash));
    ctx.rotate(this.squashAngle);
    ctx.scale(1 - 0.32 * s, 1 + 0.26 * s);
    ctx.rotate(-this.squashAngle);

    const rx = r * 0.88;
    const ry = r * 1.08;
    this.warp.draw(ctx, this.face, rx, ry);
    this.drawShading(ctx, rx, ry);
    ctx.restore();
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

  /** 2D fallback rendering: rendered weapon-model sprites, no emoji. */
  private drawFist(ctx: CanvasRenderingContext2D, fist: Fist) {
    const t = fist.t;
    const isFood = FOOD_ATTACKS.has(fist.attack);
    if (isFood && t >= IMPACT_T) return; // food vanishes into the splat
    const p = this.projectilePoint(fist);
    let { y } = p;

    let size = this.headRadius * 1.15;
    let rotation = fist.angle;
    if (fist.attack === "fish") {
      rotation = t * 10; // a spinning airborne fish is objectively funnier
    } else if (fist.attack === "mallet") {
      size = this.headRadius * 1.35;
      rotation = -Math.PI * 0.2 + p.travel * 0.9; // wind-up into the swing
    } else if (isFood) {
      size = this.headRadius * (fist.attack === "pie" ? 0.65 : 0.55);
      rotation = t * 14; // tumbling through the air
      y -= Math.sin(p.travel * Math.PI) * this.headRadius * 1.2; // arc
    }

    const icon = renderWeaponIcon(fist.attack, 128);
    ctx.save();
    ctx.translate(p.x, y);
    ctx.rotate(rotation);
    ctx.drawImage(icon, -size / 2, -size / 2, size, size);
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

/** Skin tone for the neck: brightest of several lower-face samples (dodges hair/shadow). */
function sampleSkin(face: HTMLCanvasElement): string {
  const ctx = face.getContext("2d");
  if (!ctx) return "#c9977b";
  let best: [number, number, number] = [201, 151, 123];
  let bestLum = -1;
  for (const [u, v] of [[0.5, 0.72], [0.42, 0.68], [0.58, 0.68], [0.5, 0.6]] as const) {
    const d = ctx.getImageData(Math.floor(face.width * u), Math.floor(face.height * v), 1, 1).data;
    const lum = d[0]! * 0.5 + d[1]! * 0.35 + d[2]! * 0.15;
    if (lum > bestLum) {
      bestLum = lum;
      best = [d[0]!, d[1]!, d[2]!];
    }
  }
  return `rgb(${best[0]},${best[1]},${best[2]})`;
}

/** Darken an rgb()/hex color by a factor (0..1). */
function shade(color: string, factor: number): string {
  const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return color;
  return `rgb(${Math.round(Number(m[1]) * factor)},${Math.round(Number(m[2]) * factor)},${Math.round(Number(m[3]) * factor)})`;
}

function easeInCubic(t: number) {
  return t * t * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
