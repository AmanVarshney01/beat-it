import Matter from "matter-js";

import { SoundPlayer } from "./audio";
import { DamagePainter } from "./damage";
import { Scene3D } from "./face3d/scene3d";
import { drawStar, ParticleSystem, type ShapeKind } from "./particles";
import {
  type PerformanceSnapshot,
  RenderQualityManager,
  type RenderQualityTier,
} from "./quality";
import type { AttackKind, GameBackground, Landmark3 } from "./types";

export type { AttackKind, GameBackground, Landmark3 } from "./types";

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
  background: GameBackground;
  capEnabled: boolean;
  capColor: string;
  capText: string;
  shake: boolean;
  particles: boolean;
  damage: boolean;
  blood: boolean;
  dizzyStars: boolean;
  sway: boolean;
}

interface Fist {
  id: number;
  attack: AttackKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  localTarget: { x: number; y: number };
  contactUV: { u: number; v: number };
  angle: number;
  elapsed: number;
  strength: number;
  hasHit: boolean;
}

type AttackPath = "jab" | "sweep" | "drop" | "throw";
type AttackPhase =
  | "anticipation"
  | "approach"
  | "contact"
  | "followThrough"
  | "recovery"
  | "done";

interface AttackTiming {
  anticipation: number;
  approach: number;
  contact: number;
  followThrough: number;
  recovery: number;
}

interface AttackDefinition {
  timing: AttackTiming;
  path: AttackPath;
  impulse: number;
  spin: number;
  squash: number;
  dent: number;
  shake: number;
  hitStop: number;
}

interface AttackTimeline {
  phase: AttackPhase;
  phaseProgress: number;
  overall: number;
  contactStart: number;
  contactEnd: number;
}

const ATTACKS: Record<AttackKind, AttackDefinition> = {
  punch: {
    timing: {
      anticipation: 0.04,
      approach: 0.14,
      contact: 0.055,
      followThrough: 0.08,
      recovery: 0.15,
    },
    path: "jab",
    impulse: 16,
    spin: 0.12,
    squash: 1,
    dent: 1,
    shake: 1,
    hitStop: 0.03,
  },
  slap: {
    timing: {
      anticipation: 0.05,
      approach: 0.2,
      contact: 0.075,
      followThrough: 0.12,
      recovery: 0.16,
    },
    path: "sweep",
    impulse: 20,
    spin: 0.3,
    squash: 0.72,
    dent: 1.2,
    shake: 0.9,
    hitStop: 0.04,
  },
  tomato: {
    timing: {
      anticipation: 0.03,
      approach: 0.4,
      contact: 0.035,
      followThrough: 0.16,
      recovery: 0.12,
    },
    path: "throw",
    impulse: 6,
    spin: 0.06,
    squash: 0.38,
    dent: 0.34,
    shake: 0.35,
    hitStop: 0.018,
  },
  egg: {
    timing: {
      anticipation: 0.03,
      approach: 0.42,
      contact: 0.035,
      followThrough: 0.17,
      recovery: 0.12,
    },
    path: "throw",
    impulse: 5,
    spin: 0.05,
    squash: 0.32,
    dent: 0.28,
    shake: 0.3,
    hitStop: 0.016,
  },
  mallet: {
    timing: {
      anticipation: 0.08,
      approach: 0.25,
      contact: 0.09,
      followThrough: 0.14,
      recovery: 0.17,
    },
    path: "drop",
    impulse: 26,
    spin: 0.05,
    squash: 1.2,
    dent: 1.4,
    shake: 1.4,
    hitStop: 0.06,
  },
};

const ATTACK_SHAPES: Partial<Record<AttackKind, readonly ShapeKind[]>> = {
  mallet: ["spark", "smoke"],
};
const COMBO_WINDOW = 1.0; // seconds between hits to keep a combo alive
export const DAMAGE_THRESHOLDS = [5, 15, 30, 50];

export interface PunchGameOptions {
  /** Lightweight 2D overlay for particles and dizzy stars. */
  fg: HTMLCanvasElement;
  /** The single authored WebGL game renderer. */
  gl: HTMLCanvasElement;
  face: HTMLCanvasElement;
  landmarks: Landmark3[];
  onStats: (stats: GameStats) => void;
}

/**
 * The whole 3D game scene: Matter.js head physics, explicit attack phases,
 * pooled projectiles/particles, squash, camera response, sound and UV damage.
 * React only sees `punch()`, `reset()` and stats; frame state stays here.
 */
export class PunchGame {
  readonly sounds = new SoundPlayer();

  private viewport: HTMLCanvasElement;
  private fgCtx: CanvasRenderingContext2D;
  private damage: DamagePainter;
  private scene3d: Scene3D;
  private quality: RenderQualityManager;
  private onStats: (stats: GameStats) => void;
  private nextFistId = 1;

  private engine!: Matter.Engine;
  private head!: Matter.Body;
  private mount = { x: 0, y: 0 };
  private headRadius = 80;

  private particles = new ParticleSystem();
  private fists: Fist[] = [];
  private fistPool: Fist[] = [];

  // damped-oscillator squash: positive = squashed, negative = overshoot stretch
  private squash = 0;
  private squashVel = 0;
  private squashAngle = 0;

  private settings: GameSettings = {
    background: "gym",
    capEnabled: false,
    capColor: "#c92f35",
    capText: "BEAT IT",
    shake: true,
    particles: true,
    damage: true,
    blood: true,
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
  private hitStopRemaining = 0;

  private rafId = 0;
  private lastFrame = 0;
  private resizeObserver: ResizeObserver;
  private destroyed = false;

  constructor(opts: PunchGameOptions) {
    this.viewport = opts.gl;
    const fgCtx = opts.fg.getContext("2d");
    if (!fgCtx) throw new Error("Canvas 2D not supported");
    this.fgCtx = fgCtx;
    this.onStats = opts.onStats;

    // The damage-painted canvas is the one face texture used by the 3D rig.
    this.damage = new DamagePainter(opts.face);
    const neckColor = sampleSkin(opts.face);
    this.scene3d = new Scene3D(
      opts.gl,
      this.damage.canvas,
      opts.landmarks,
      neckColor,
    );
    this.quality = new RenderQualityManager(opts.gl.clientWidth || window.innerWidth);
    this.applyQuality(this.quality.tier);

    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(opts.gl);
    this.layout();

    this.lastFrame = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.sounds.dispose();
    this.scene3d.dispose();
    if (this.engine) {
      Matter.World.clear(this.engine.world, false);
      Matter.Engine.clear(this.engine);
    }
  }

  /** Size all canvas layers to the CSS box and (re)build the physics world. */
  private layout() {
    const w = this.viewport.clientWidth || 1;
    const h = this.viewport.clientHeight || 1;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      this.quality.profile.dprCap,
    );
    this.fgCtx.canvas.width = Math.round(w * dpr);
    this.fgCtx.canvas.height = Math.round(h * dpr);
    this.fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scene3d.resize(w, h, window.devicePixelRatio || 1);

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
    this.scene3d.setLayout(this.mount, r, torsoTop, torsoTop + r * 2.2 + 8);
  }

  updateSettings(partial: Partial<GameSettings>) {
    Object.assign(this.settings, partial);
    this.scene3d.swayEnabled = this.settings.sway;
    this.scene3d.setBackground(this.settings.background);
    this.scene3d.setCap(
      this.settings.capEnabled,
      this.settings.capColor,
      this.settings.capText,
    );
  }

  /** True when the point (canvas coords) is on the head — used for tap-to-punch. */
  hitTestHead(point: { x: number; y: number }): boolean {
    return this.scene3d.resolveFaceContact(point.x, point.y) !== null;
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
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;
    let to = target ?? {
      x: headPos.x + (Math.random() - 0.5) * r,
      y: headPos.y + (Math.random() - 0.5) * r * 0.8,
    };
    let surfaceContact = this.scene3d.resolveFaceContact(to.x, to.y);
    if (!surfaceContact && !target) {
      to = { x: headPos.x, y: headPos.y };
      surfaceContact = this.scene3d.resolveFaceContact(to.x, to.y);
    }
    if (!surfaceContact) return;

    const critical = Math.random() < 0.08;
    const strength = critical ? 1.9 : 0.8 + Math.random() * 0.5;

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
    const fist = this.fistPool.pop() ?? createFist();
    fist.id = id;
    fist.attack = attack;
    fist.from.x = from.x;
    fist.from.y = from.y;
    fist.to.x = to.x;
    fist.to.y = to.y;
    fist.localTarget.x = surfaceContact.localX;
    fist.localTarget.y = surfaceContact.localY;
    fist.contactUV.u = surfaceContact.u;
    fist.contactUV.v = surfaceContact.v;
    fist.angle = angle;
    fist.elapsed = 0;
    fist.strength = strength;
    fist.hasHit = false;
    this.fists.push(fist);
    this.scene3d.spawnProjectile(id, attack);
    if (this.fists.length > 6) {
      const dropped = this.fists.shift();
      if (dropped) this.releaseFist(dropped);
    }
    this.sounds.whoosh();
  }

  reset() {
    this.hits = 0;
    this.combo = 0;
    this.lastHitAt = -Infinity;
    this.particles.clear();
    for (const fist of this.fists) this.releaseFist(fist);
    this.fists.length = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.shakeMag = 0;
    this.hitStopRemaining = 0;
    this.sounds.stopVoice();
    this.damage.clear();
    this.scene3d.reset();
    this.scene3d.refreshTexture();
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
    // The target was captured in head-local space at pointer-down. Reusing it
    // keeps deformation and residue registered even after the head moves.
    const lx = fist.localTarget.x;
    const ly = fist.localTarget.y;
    const dirLx = Math.cos(dir) * cosA - Math.sin(dir) * sinA;
    const dirLy = Math.cos(dir) * sinA + Math.sin(dir) * cosA;
    const dentStrength = fist.strength * definition.dent;
    this.scene3d.punchDent(lx, ly, dirLx, dirLy, dentStrength);

    // Damage lands exactly where the attack hit.
    if (this.settings.damage) {
      const u = fist.contactUV.u;
      const v = fist.contactUV.v;
      let textureChanged: boolean;
      if (isFood) {
        textureChanged = this.damage.splat(u, v, fist.attack as "tomato" | "egg");
      } else {
        textureChanged = this.damage.hit(u, v, fist.strength);
        if (this.settings.blood) {
          textureChanged =
            this.damage.blood(
              u,
              v,
              fist.strength,
              Math.atan2(-dirLy, dirLx),
            ) || textureChanged;
        }
      }
      if (textureChanged) this.scene3d.refreshTexture();
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
      if (this.settings.blood && !isFood) {
        this.particles.bloodBurst(
          impact.x,
          impact.y,
          Math.cos(dir),
          Math.sin(dir),
          fist.strength,
          this.headRadius / 90,
        );
      }
    }
    if (isFood) this.sounds.splat();
    else if (isMallet) this.sounds.bonk(fist.strength);
    else if (isSweep) this.sounds.slap(fist.strength);
    else this.sounds.punch(fist.strength);
    this.sounds.reaction(fist.attack, fist.strength);
    this.hitStopRemaining = Math.max(
      this.hitStopRemaining,
      definition.hitStop * Math.min(1.35, fist.strength),
    );

    const now = this.elapsed;
    this.combo = now - this.lastHitAt <= COMBO_WINDOW ? this.combo + 1 : 1;
    this.lastHitAt = now;
    this.hits += 1;
    if (this.combo > 0 && this.combo % 5 === 0) this.sounds.comboDing(this.combo / 5);
    this.emitStats();
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    const frameMs = Math.min(250, now - this.lastFrame);
    const dt = Math.min(1 / 30, frameMs / 1000);
    this.lastFrame = now;
    const nextTier = this.quality.recordFrame(frameMs);
    if (nextTier) this.applyQuality(nextTier);

    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - dt);
      this.draw();
      this.rafId = requestAnimationFrame(this.frame);
      return;
    }

    this.elapsed += dt;

    const physicsSteps = Math.max(1, Math.ceil(dt / (1 / 60)));
    const physicsDelta = (dt * 1000) / physicsSteps;
    for (let step = 0; step < physicsSteps; step++) {
      Matter.Engine.update(this.engine, physicsDelta);
    }

    for (const fist of this.fists) {
      this.updateAttackTarget(fist);
      const definition = ATTACKS[fist.attack];
      const before = attackTimeline(fist.elapsed, definition);
      fist.elapsed += dt;
      const after = attackTimeline(fist.elapsed, definition);
      if (
        !fist.hasHit &&
        before.overall < after.contactStart &&
        after.overall >= after.contactStart
      ) {
        fist.hasHit = true;
        this.landPunch(fist);
      }
    }
    for (let i = this.fists.length - 1; i >= 0; i--) {
      const fist = this.fists[i]!;
      if (attackTimeline(fist.elapsed, ATTACKS[fist.attack]).phase === "done") {
        this.fists.splice(i, 1);
        this.releaseFist(fist);
      }
    }

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

    this.scene3d.update(dt);
    this.particles.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.frame);
  };

  private headBob(): number {
    const settled = Math.hypot(this.head.velocity.x, this.head.velocity.y) < 0.5;
    return settled ? Math.sin(this.elapsed * 2.2) * 3 : 0;
  }

  /** Where a projectile is along its explicit phase timeline. */
  private projectilePoint(fist: Fist) {
    const definition = ATTACKS[fist.attack];
    const timeline = attackTimeline(fist.elapsed, definition);
    let travel: number;
    if (timeline.phase === "anticipation") {
      travel = -0.055 * easeOutCubic(timeline.phaseProgress);
    } else if (timeline.phase === "approach") {
      const approach = timeline.phaseProgress;
      if (definition.path === "drop") travel = approach * approach;
      else if (definition.path === "sweep") travel = easeInOutCubic(approach);
      else if (definition.path === "jab") travel = 1 - (1 - approach) ** 4;
      else travel = easeOutCubic(approach);
    } else if (timeline.phase === "contact") {
      travel =
        definition.path === "throw"
          ? 1
          : 1 + 0.035 * easeInOutCubic(timeline.phaseProgress);
    } else if (timeline.phase === "followThrough") {
      const follow = timeline.phaseProgress;
      if (definition.path === "sweep") travel = 1.035 + easeInCubic(follow) * 1.35;
      else if (definition.path === "throw") travel = 1;
      else if (definition.path === "drop") travel = 1.035 + easeInCubic(follow) * 0.16;
      else travel = 1.035 + easeOutCubic(follow) * 0.12;
    } else if (timeline.phase === "recovery") {
      const recovery = easeInOutCubic(timeline.phaseProgress);
      if (definition.path === "sweep") travel = 2.385 + recovery * 0.28;
      else if (definition.path === "throw") travel = 1;
      else {
        const followEnd = definition.path === "drop" ? 1.195 : 1.155;
        travel = followEnd + (0.18 - followEnd) * recovery;
      }
    } else {
      travel = definition.path === "sweep" ? 2.665 : 0.18;
    }
    return {
      x: fist.from.x + (fist.to.x - fist.from.x) * travel,
      y: fist.from.y + (fist.to.y - fist.from.y) * travel,
      travel,
      timeline,
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
    const w = this.viewport.clientWidth;
    const h = this.viewport.clientHeight;

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
        p.timeline.overall,
        p.timeline.contactStart,
        p.timeline.contactEnd,
      );
    }
    this.scene3d.render();

    // Foreground is deliberately light: pooled impact particles and dizzy stars.
    const fg = this.fgCtx;
    fg.clearRect(0, 0, w, h);
    fg.save();
    fg.translate(this.shakeX, this.shakeY);
    this.drawDamageOverlay(fg);
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
        const orbitX = this.settings.capEnabled
          ? Math.cos(a) * r * 1.22
          : Math.cos(a) * r * 0.9;
        const orbitY = this.settings.capEnabled
          ? pos.y -
            r * (1.2 + 0.5 * (1 - Math.abs(Math.cos(a)))) +
            Math.sin(a) * r * 0.08
          : pos.y - ry - r * 0.25 + Math.sin(a) * r * 0.22;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.translate(pos.x + orbitX, orbitY);
        ctx.rotate(a * 0.5);
        drawStar(
          ctx,
          r * (this.settings.capEnabled ? 0.12 : 0.14),
          "#ffd94d",
          "#c98800",
        );
        ctx.restore();
      }
      ctx.restore();
    }
  }

  getPerformanceSnapshot(): PerformanceSnapshot {
    return this.quality.snapshot(
      this.scene3d.getPerformanceStats(),
      this.particles.getStats(),
    );
  }

  private applyQuality(_tier: RenderQualityTier) {
    const profile = this.quality.profile;
    this.scene3d.setQuality(profile);
    this.particles.setQuality(profile.particleMultiplier);
  }

  private releaseFist(fist: Fist) {
    this.scene3d.removeProjectile(fist.id);
    if (this.fistPool.length < 8) this.fistPool.push(fist);
  }
}

function createFist(): Fist {
  return {
    id: 0,
    attack: "punch",
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    localTarget: { x: 0, y: 0 },
    contactUV: { u: 0.5, v: 0.5 },
    angle: 0,
    elapsed: 0,
    strength: 1,
    hasHit: false,
  };
}

function attackDuration(definition: AttackDefinition) {
  const timing = definition.timing;
  return (
    timing.anticipation +
    timing.approach +
    timing.contact +
    timing.followThrough +
    timing.recovery
  );
}

function attackTimeline(
  elapsed: number,
  definition: AttackDefinition,
): AttackTimeline {
  const timing = definition.timing;
  const duration = attackDuration(definition);
  const overall = Math.max(0, Math.min(1, elapsed / duration));
  const contactStart = (timing.anticipation + timing.approach) / duration;
  const contactEnd = (timing.anticipation + timing.approach + timing.contact) / duration;

  let cursor = 0;
  for (const [phase, phaseDuration] of [
    ["anticipation", timing.anticipation],
    ["approach", timing.approach],
    ["contact", timing.contact],
    ["followThrough", timing.followThrough],
    ["recovery", timing.recovery],
  ] as const) {
    const end = cursor + phaseDuration;
    if (elapsed < end) {
      return {
        phase,
        phaseProgress: Math.max(0, Math.min(1, (elapsed - cursor) / phaseDuration)),
        overall,
        contactStart,
        contactEnd,
      };
    }
    cursor = end;
  }

  return {
    phase: "done",
    phaseProgress: 1,
    overall: 1,
    contactStart,
    contactEnd,
  };
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

function easeInCubic(t: number) {
  return t * t * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;
}
