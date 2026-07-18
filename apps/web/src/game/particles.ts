export type ShapeKind = "spark" | "smoke";

interface ShapeParticle {
  kind: "shape";
  shape: ShapeKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  life: number; // seconds remaining
  maxLife: number;
}

const DEFAULT_SHAPES: readonly ShapeKind[] = ["spark"];

const GRAVITY = 900; // px/s²

export class ParticleSystem {
  private particles: ShapeParticle[] = [];
  private pool: ShapeParticle[] = [];
  private qualityMultiplier = 1;

  setQuality(multiplier: number) {
    this.qualityMultiplier = Math.max(0.35, Math.min(1, multiplier));
  }

  burst(
    x: number,
    y: number,
    strength = 1,
    scale = 1,
    shapes: readonly ShapeKind[] = DEFAULT_SHAPES,
  ) {
    const visualScale = Math.sqrt(scale);
    const count = Math.max(
      2,
      Math.round((4 + Math.floor(Math.random() * 3)) * this.qualityMultiplier),
    );
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (180 + Math.random() * 260) * strength * Math.sqrt(scale);
      const life = 0.5 + Math.random() * 0.4;
      const particle = this.pool.pop() ?? createParticle();
      particle.shape = shapes[Math.floor(Math.random() * shapes.length)] ?? "spark";
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed - 150 * scale;
      particle.rot = Math.random() * Math.PI * 2;
      particle.vrot = (Math.random() - 0.5) * 12;
      particle.size = (12 + Math.random() * 10 * strength) * visualScale;
      particle.life = life;
      particle.maxLife = life;
      this.particles.push(particle);
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      // smoke floats; sparks fall
      p.vy += (p.shape === "smoke" ? -260 : GRAVITY) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        this.pool.push(p);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      drawShape(ctx, p.shape, p.size);
      ctx.restore();
    }
  }

  clear() {
    this.pool.push(...this.particles);
    this.particles.length = 0;
  }

  getStats() {
    return {
      activeParticles: this.particles.length,
      pooledParticles: this.pool.length,
    };
  }
}

function createParticle(): ShapeParticle {
  return {
    kind: "shape",
    shape: "spark",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    vrot: 0,
    size: 0,
    life: 0,
    maxLife: 0,
  };
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeKind, size: number) {
  switch (shape) {
    case "spark": {
      // thin 8-spike burst
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const r = i % 2 === 0 ? size / 2 : size / 7;
        const a = (i / 16) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, size / 2);
      g.addColorStop(0, "#fff8e0");
      g.addColorStop(1, "#ffb020");
      ctx.fillStyle = g;
      ctx.fill();
      break;
    }
    case "smoke": {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, size / 2);
      g.addColorStop(0, "rgba(190,190,200,0.8)");
      g.addColorStop(1, "rgba(190,190,200,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}

/** Filled 5-point star, shared with dizzy stars and the dummy's chest. */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  radius: number,
  fill: string,
  stroke?: string,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = Math.max(1.5, radius * 0.12);
    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
