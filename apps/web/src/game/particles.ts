export type ShapeKind = "star" | "spark" | "flame" | "smoke" | "droplet" | "sauce";

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

interface WordParticle {
  kind: "word";
  x: number;
  y: number;
  text: string;
  tilt: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

type Particle = ShapeParticle | WordParticle;

const DEFAULT_SHAPES: readonly ShapeKind[] = ["star", "spark"];
const WORDS = ["POW!", "BAM!", "WHACK!", "THWACK!", "BOOM!", "OOF!", "SMACK!", "KAPOW!"];
const WORD_COLORS = ["#ff3d3d", "#ffb020", "#ffe14d", "#4dc3ff", "#ff6bd6"];

const GRAVITY = 900; // px/s²

export class ParticleSystem {
  private particles: Particle[] = [];

  burst(x: number, y: number, strength = 1, scale = 1, shapes: readonly ShapeKind[] = DEFAULT_SHAPES) {
    const count = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (180 + Math.random() * 260) * strength * Math.sqrt(scale);
      const life = 0.5 + Math.random() * 0.4;
      this.particles.push({
        kind: "shape",
        shape: shapes[Math.floor(Math.random() * shapes.length)] ?? "star",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150 * scale,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        size: (14 + Math.random() * 12 * strength) * scale,
        life,
        maxLife: life,
      });
    }
    this.particles.push({
      kind: "word",
      x: x + (Math.random() - 0.5) * 40 * scale,
      y: y - 30 * scale,
      text: WORDS[Math.floor(Math.random() * WORDS.length)] ?? "POW!",
      tilt: (Math.random() - 0.5) * 0.5,
      color: WORD_COLORS[Math.floor(Math.random() * WORD_COLORS.length)] ?? "#ff3d3d",
      size: Math.min(110, 44 * scale),
      life: 0.6,
      maxLife: 0.6,
    });
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      if (p.kind === "shape") {
        // smoke and flames float, everything else falls
        p.vy += (p.shape === "smoke" || p.shape === "flame" ? -260 : GRAVITY) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
      } else {
        p.y -= 40 * dt;
      }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const progress = 1 - p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
      if (p.kind === "shape") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        drawShape(ctx, p.shape, p.size);
      } else {
        // pop in fast, then linger
        const scale = progress < 0.2 ? 0.5 + (progress / 0.2) * 0.7 : 1.2;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tilt);
        ctx.scale(scale, scale);
        ctx.font = `900 ${p.size}px 'Comic Sans MS', 'Chalkboard SE', cursive`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 8;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1f1f1f";
        ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, 0, 0);
      }
      ctx.restore();
    }
  }

  clear() {
    this.particles = [];
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeKind, size: number) {
  switch (shape) {
    case "star":
      drawStar(ctx, size / 2, "#ffd94d", "#d98800");
      break;
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
    case "flame": {
      // teardrop pointing up
      const r = size / 2;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.bezierCurveTo(r * 0.9, -r * 0.1, r * 0.65, r * 0.75, 0, r * 0.85);
      ctx.bezierCurveTo(-r * 0.65, r * 0.75, -r * 0.9, -r * 0.1, 0, -r);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, "#ffe14d");
      g.addColorStop(1, "#ff6a1a");
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
    case "droplet": {
      ctx.fillStyle = "#5db4ec";
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.22, size * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(-size * 0.06, -size * 0.08, size * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sauce": {
      ctx.fillStyle = "#c98d4a";
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.26, size * 0.2, 0, 0, Math.PI * 2);
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
