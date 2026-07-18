import Matter from "matter-js";

import { SoundPlayer } from "./audio";
import { DamagePainter } from "./damage";
import { getWeaponImage } from "./face3d/assets";
import { Scene3D } from "./face3d/scene3d";
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
const FOOD_ATTACKS: ReadonlySet<AttackKind> = new Set(["tomato", "egg"]);
/** horizontal side sweeps */
const SWEEP_ATTACKS: ReadonlySet<AttackKind> = new Set(["slap"]);

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
  localTarget: { x: number; y: number };
  contactUV: { u: number; v: number } | null;
  angle: number;
  t: number; // 0..1 through the whole attack
  duration: number;
  strength: number;
  hasHit: boolean;
}

type AttackPath = "jab" | "sweep" | "drop" | "throw";

interface AttackDefinition {
  duration: number;
  contactAt: number;
  path: AttackPath;
  impulse: number;
  spin: number;
  squash: number;
  dent: number;
  shake: number;
}

const ATTACKS: Record<AttackKind, AttackDefinition> = {
  punch: {
    duration: 0.46,
    contactAt: 0.43,
    path: "jab",
    impulse: 16,
    spin: 0.12,
    squash: 1,
    dent: 1,
    shake: 1,
  },
  slap: {
    duration: 0.56,
    contactAt: 0.48,
    path: "sweep",
    impulse: 20,
    spin: 0.3,
    squash: 0.72,
    dent: 1.2,
    shake: 0.9,
  },
  tomato: {
    duration: 0.72,
    contactAt: 0.66,
    path: "throw",
    impulse: 6,
    spin: 0.06,
    squash: 0.38,
    dent: 0.34,
    shake: 0.35,
  },
  egg: {
    duration: 0.72,
    contactAt: 0.66,
    path: "throw",
    impulse: 5,
    spin: 0.05,
    squash: 0.32,
    dent: 0.28,
    shake: 0.3,
  },
  mallet: {
    duration: 0.66,
    contactAt: 0.58,
    path: "drop",
    impulse: 26,
    spin: 0.05,
    squash: 1.2,
    dent: 1.4,
    shake: 1.4,
  },
};

const ATTACK_SHAPES: Partial<Record<AttackKind, readonly ShapeKind[]>> = {
  mallet: ["spark", "smoke"],
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
    this.sounds.dispose();
    this.scene3d?.dispose();
    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  /** Size all canvas layers to the CSS box and (re)build the physics world. */
  private layout() {
    const w = this.bg.clientWidth || 1;
    const h = this.bg.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, w < 600 ? 1.5 : 2);
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
    const portrait = h > w * 1.15;
    this.mount = { x: w / 2, y: h * (portrait ? 0.44 : 0.4) };
    this.headRadius = Math.max(
      90,
      Math.min(360, Math.min(w, h) * (portrait ? 0.34 : 0.26)),
    );

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
    if (this.scene3d) {
      return this.scene3d.resolveFaceContact(point.x, point.y) !== null;
    }
    const dx = point.x - this.head.position.x;
    const dy = point.y - this.head.position.y;
    return Math.hypot(dx, dy) <= this.headRadius * 1.2;
  }

  private pointToHeadLocal(point: { x: number; y: number }) {
    const renderAngle = this.head.angle * 0.6;
    const cosA = Math.cos(-renderAngle);
    const sinA = Math.sin(-renderAngle);
    const dx = point.x - this.head.position.x;
    const dy = point.y - this.head.position.y;
    return {
      x: Math.max(-1.05, Math.min(1.05, (dx * cosA - dy * sinA) / (this.headRadius * 0.88))),
      y: Math.max(-1.05, Math.min(1.05, (dx * sinA + dy * cosA) / (this.headRadius * 1.08))),
    };
  }

  private updateAttackTarget(fist: Fist) {
    const renderAngle = this.head.angle * 0.6;
    const cosA = Math.cos(renderAngle);
    const sinA = Math.sin(renderAngle);
    const dx = fist.localTarget.x * this.headRadius * 0.88;
    const dy = fist.localTarget.y * this.headRadius * 1.08;
    fist.to.x = this.head.position.x + dx * cosA - dy * sinA;
    fist.to.y = this.head.position.y + dx * sinA + dy * cosA;
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
    const definition = ATTACKS[attack];
    const surfaceContact = this.scene3d?.resolveFaceContact(to.x, to.y) ?? null;

    let from: { x: number; y: number };
    let angle: number;
    if (attack === "punch" || attack === "slap" || attack === "mallet") {
      // Direct hits enter from the same half of the face the player chose.
      // Left-side click → left-side hand/weapon; right-side click → right side.
      const side = to.x <= headPos.x ? -1 : 1;
      const distance = r * (attack === "mallet" ? 3.7 : 4.2);
      from = {
        x: to.x + side * distance,
        y: attack === "mallet" ? to.y - r * 2.15 : to.y,
      };
      angle = Math.atan2(to.y - from.y, to.x - from.x);
    } else {
      // hurled from the viewer: arcs up from the bottom edge
      from = { x: to.x + (Math.random() - 0.5) * w * 0.25, y: h + r * 0.6 };
      angle = Math.atan2(to.y - from.y, to.x - from.x);
    }

    // concurrent attacks so button-mashing never drops an input
    const id = this.nextFistId++;
    this.fists.push({
      id,
      attack,
      from,
      to,
      localTarget: surfaceContact
        ? { x: surfaceContact.localX, y: surfaceContact.localY }
        : this.pointToHeadLocal(to),
      contactUV: surfaceContact ? { u: surfaceContact.u, v: surfaceContact.v } : null,
      angle,
      t: 0,
      duration: definition.duration,
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
    for (const fist of this.fists) this.scene3d?.removeProjectile(fist.id);
    this.fists = [];
    this.squash = 0;
    this.squashVel = 0;
    this.shakeMag = 0;
    this.sounds.stopVoice();
    this.warp.reset();
    this.damage.clear();
    this.scene3d?.reset();
    this.scene3d?.refreshTexture();
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
    const definition = ATTACKS[fist.attack];
    const dir = Math.atan2(impact.y - fist.from.y, impact.x - fist.from.x);
    fist.angle = dir;
    const isFood = FOOD_ATTACKS.has(fist.attack);
    const isSweep = SWEEP_ATTACKS.has(fist.attack);
    const isMallet = fist.attack === "mallet";
    const impulse = definition.impulse;

    Matter.Body.setVelocity(this.head, {
      x: this.head.velocity.x + Math.cos(dir) * impulse * fist.strength,
      y: this.head.velocity.y + Math.sin(dir) * impulse * fist.strength - (isFood ? 1 : 3),
    });
    const spin = (impact.y < this.head.position.y ? 1 : -1) * Math.sign(Math.cos(dir) || 1);
    Matter.Body.setAngularVelocity(this.head, spin * (definition.spin + 0.08 * fist.strength));

    this.squash = definition.squash;
    this.squashVel = 0;
    this.squashAngle = dir;

    // convert the impact into head-local face space for dent + located damage
    const renderAngle = this.head.angle * 0.6;
    const cosA = Math.cos(-renderAngle);
    const sinA = Math.sin(-renderAngle);
    const r = this.headRadius;
    // The target was captured in head-local space at pointer-down. Reusing it
    // keeps deformation and residue registered even after the head moves.
    const lx = fist.localTarget.x;
    const ly = fist.localTarget.y;
    const dirLx = Math.cos(dir) * cosA - Math.sin(dir) * sinA;
    const dirLy = Math.cos(dir) * sinA + Math.sin(dir) * cosA;
    const dentStrength = fist.strength * definition.dent;
    if (this.scene3d) {
      this.scene3d.punchDent(lx, ly, dirLx, dirLy, dentStrength);
    } else {
      this.warp.punch(lx, ly, dirLx, dirLy, dentStrength);
    }

    // Damage lands exactly where the attack hit.
    if (this.settings.damage) {
      const u = fist.contactUV?.u ?? Math.max(0.03, Math.min(0.97, (lx + 1) / 2));
      const v = fist.contactUV?.v ?? Math.max(0.03, Math.min(0.97, (ly + 1) / 2));
      let textureChanged: boolean;
      if (isFood) {
        textureChanged = this.damage.splat(u, v, fist.attack as "tomato" | "egg");
      } else {
        textureChanged = this.damage.hit(u, v, fist.strength);
      }
      if (textureChanged) this.scene3d?.refreshTexture();
    }

    if (this.settings.shake) {
      this.shakeMag = Math.min(
        34,
        this.shakeMag + 2 + 9 * fist.strength * definition.shake,
      );
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
    if (isFood) this.sounds.splat();
    else if (isMallet) this.sounds.bonk(fist.strength);
    else if (isSweep) this.sounds.slap(fist.strength);
    else this.sounds.punch(fist.strength);
    this.sounds.reaction(fist.attack, fist.strength);

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

    const physicsSteps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const physicsDelta = (dt * 1000) / physicsSteps;
    for (let step = 0; step < physicsSteps; step++) {
      Matter.Engine.update(this.engine, physicsDelta);
    }

    for (const fist of this.fists) {
      this.updateAttackTarget(fist);
      const contactAt = ATTACKS[fist.attack].contactAt;
      const before = fist.t;
      fist.t += dt / fist.duration;
      if (!fist.hasHit && before < contactAt && fist.t >= contactAt) {
        fist.hasHit = true;
        this.landPunch(fist);
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
    this.shakeX =
      (Math.sin(this.elapsed * 71) * 0.72 + Math.sin(this.elapsed * 43 + 1.7) * 0.28) *
      this.shakeMag;
    this.shakeY =
      (Math.sin(this.elapsed * 83 + 0.8) * 0.68 + Math.sin(this.elapsed * 37) * 0.32) *
      this.shakeMag *
      0.72;

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
    const definition = ATTACKS[fist.attack];
    let travel: number;
    if (t < definition.contactAt) {
      const approach = t / definition.contactAt;
      if (definition.path === "drop") travel = approach * approach;
      else if (definition.path === "sweep") travel = easeInOutCubic(approach);
      else if (definition.path === "jab") travel = 1 - (1 - approach) ** 4;
      else travel = easeOutCubic(approach);
    } else {
      const recovery = (t - definition.contactAt) / (1 - definition.contactAt);
      if (definition.path === "sweep") travel = 1 + easeInCubic(recovery) * 1.35;
      else if (definition.path === "throw") travel = 1 + easeOutCubic(recovery) * 0.36;
      else {
        const release = Math.max(0, (recovery - 0.24) / 0.76);
        travel = 1 - easeInOutCubic(release) * 0.82;
      }
    }
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
        this.mount.y + this.headRadius * 1.63,
        this.headRadius * 0.105,
      );
      this.scene3d.setShake(this.shakeX, this.shakeY);
      for (const fist of this.fists) {
        const p = this.projectilePoint(fist);
        this.scene3d.moveProjectile(
          fist.id,
          fist.attack,
          p.x,
          p.y,
          fist.angle,
          p.travel,
          fist.t,
          ATTACKS[fist.attack].contactAt,
        );
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

    // neutral training stand — kept dark so it does not read as a red UI blob
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#111318";
    ctx.fillStyle = "#2d3139";
    roundRect(ctx, this.mount.x - torsoW / 2, torsoTop, torsoW, torsoH, r * 0.5);
    ctx.fill();
    ctx.stroke();
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
    ctx.scale(1 - 0.18 * s, 1 + 0.11 * s);
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
    if (isFood && t >= 0.88) return;
    const p = this.projectilePoint(fist);
    let { y } = p;

    let size = this.headRadius * 1.15;
    let rotation = 0;
    let mirrorX = 1;
    if (fist.attack === "mallet") {
      const direction = Math.cos(fist.angle) >= 0 ? 1 : -1;
      size = this.headRadius * 1.35;
      rotation =
        fist.angle +
        Math.PI / 2 -
        direction * (1 - Math.min(1, p.travel)) * 0.35;
    } else if (fist.attack === "punch" || fist.attack === "slap") {
      const direction = Math.cos(fist.angle) >= 0 ? 1 : -1;
      mirrorX = direction;
      rotation = direction * (-0.06 + Math.min(1, p.travel) * 0.1);
    } else if (isFood) {
      size = this.headRadius * 0.55;
      rotation = t * 14; // tumbling through the air
      y -= Math.sin(Math.min(1, p.travel) * Math.PI) * this.headRadius * 1.2;
    }

    const icon = getWeaponImage(fist.attack);
    if (!icon) return;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.rotate(rotation);
    ctx.scale(mirrorX, 1);
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

/** Skin tone for the neck: average cheek/jaw samples while avoiding lips and hair. */
function sampleSkin(face: HTMLCanvasElement): string {
  const ctx = face.getContext("2d");
  if (!ctx) return "#c9977b";
  const samples: Array<[number, number, number]> = [];
  for (const [u, v] of [
    [0.3, 0.54],
    [0.7, 0.54],
    [0.34, 0.62],
    [0.66, 0.62],
    [0.4, 0.68],
    [0.6, 0.68],
  ] as const) {
    const x = Math.floor(face.width * u);
    const y = Math.floor(face.height * v);
    const d = ctx.getImageData(
      Math.max(0, x - 2),
      Math.max(0, y - 2),
      Math.min(5, face.width),
      Math.min(5, face.height),
    ).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    const pixels = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      red += d[i]!;
      green += d[i + 1]!;
      blue += d[i + 2]!;
    }
    samples.push([red / pixels, green / pixels, blue / pixels]);
  }
  samples.sort((a, b) => luminance(a) - luminance(b));
  const middle = samples.slice(1, -1);
  const average = middle.reduce(
    (sum, sample) => [sum[0] + sample[0], sum[1] + sample[1], sum[2] + sample[2]],
    [0, 0, 0],
  );
  return `rgb(${Math.round(average[0] / middle.length)},${Math.round(average[1] / middle.length)},${Math.round(average[2] / middle.length)})`;
}

function luminance([red, green, blue]: [number, number, number]) {
  return red * 0.5 + green * 0.35 + blue * 0.15;
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

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;
}
