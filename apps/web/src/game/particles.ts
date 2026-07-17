interface StarParticle {
  kind: "star";
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  glyph: string;
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

type Particle = StarParticle | WordParticle;

const STAR_GLYPHS = ["⭐", "💫", "✨", "💥"];
const WORDS = ["POW!", "BAM!", "WHACK!", "THWACK!", "BOOM!", "OOF!", "SMACK!", "KAPOW!"];
const WORD_COLORS = ["#ff3d3d", "#ffb020", "#ffe14d", "#4dc3ff", "#ff6bd6"];

const GRAVITY = 900; // px/s²

export class ParticleSystem {
  private particles: Particle[] = [];

  burst(x: number, y: number, strength = 1, scale = 1, glyphs: readonly string[] = STAR_GLYPHS) {
    const starCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (180 + Math.random() * 260) * strength * Math.sqrt(scale);
      const life = 0.5 + Math.random() * 0.4;
      this.particles.push({
        kind: "star",
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 150 * scale,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 12,
        size: (16 + Math.random() * 14 * strength) * scale,
        glyph: glyphs[Math.floor(Math.random() * glyphs.length)] ?? "⭐",
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
      if (p.kind === "star") {
        p.vy += GRAVITY * dt;
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
      if (p.kind === "star") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.glyph, 0, 0);
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
