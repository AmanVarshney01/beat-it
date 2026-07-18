export type RenderQualityTier = "high" | "medium" | "low";

export interface RenderQualityProfile {
  dprCap: number;
  shadowSize: 1024 | 512 | 256;
  particleMultiplier: number;
  foodFragmentCount: number;
}

export interface PerformanceSnapshot {
  tier: RenderQualityTier;
  medianFrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  sampledFrames: number;
  activeProjectiles: number;
  pooledProjectiles: number;
  activeParticles: number;
  pooledParticles: number;
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
}

export const QUALITY_PROFILES: Record<RenderQualityTier, RenderQualityProfile> = {
  high: {
    dprCap: 1.75,
    shadowSize: 1024,
    particleMultiplier: 1,
    foodFragmentCount: 9,
  },
  medium: {
    dprCap: 1.25,
    shadowSize: 512,
    particleMultiplier: 0.72,
    foodFragmentCount: 6,
  },
  low: {
    dprCap: 1,
    shadowSize: 256,
    particleMultiplier: 0.48,
    foodFragmentCount: 4,
  },
};

const TIER_ORDER: readonly RenderQualityTier[] = ["high", "medium", "low"];
const MAX_SAMPLES = 300;

/**
 * A deliberately slow-moving quality controller. It reacts to sustained frame
 * pressure, never to a single impact spike, so visual quality does not flutter.
 */
export class RenderQualityManager {
  private tierValue: RenderQualityTier;
  private samples: number[] = [];
  private movingFrameMs = 16.7;
  private slowFrames = 0;
  private fastFrames = 0;

  constructor(width = window.innerWidth) {
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const limitedCpu = (navigator.hardwareConcurrency || 8) <= 4;
    this.tierValue = width < 700 || coarsePointer || limitedCpu ? "medium" : "high";
  }

  get tier() {
    return this.tierValue;
  }

  get profile() {
    return QUALITY_PROFILES[this.tierValue];
  }

  recordFrame(frameMs: number): RenderQualityTier | null {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return null;
    this.samples.push(frameMs);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    this.movingFrameMs += (frameMs - this.movingFrameMs) * 0.045;

    const budget = this.tierValue === "low" ? 25 : 18.5;
    if (this.movingFrameMs > budget) {
      this.slowFrames++;
      this.fastFrames = 0;
    } else if (this.movingFrameMs < 14.5) {
      this.fastFrames++;
      this.slowFrames = Math.max(0, this.slowFrames - 2);
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 1);
      this.fastFrames = Math.max(0, this.fastFrames - 1);
    }

    if (this.slowFrames >= 45) {
      this.slowFrames = 0;
      this.fastFrames = 0;
      return this.moveTier(1);
    }
    if (this.fastFrames >= 240) {
      this.slowFrames = 0;
      this.fastFrames = 0;
      return this.moveTier(-1);
    }
    return null;
  }

  snapshot(
    scene: PerformanceSnapshot["renderer"] & {
      activeProjectiles: number;
      pooledProjectiles: number;
    },
    particles: { activeParticles: number; pooledParticles: number },
  ): PerformanceSnapshot {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return {
      tier: this.tierValue,
      medianFrameMs: percentile(sorted, 0.5),
      p95FrameMs: percentile(sorted, 0.95),
      maxFrameMs: sorted.at(-1) ?? 0,
      sampledFrames: sorted.length,
      activeProjectiles: scene.activeProjectiles,
      pooledProjectiles: scene.pooledProjectiles,
      activeParticles: particles.activeParticles,
      pooledParticles: particles.pooledParticles,
      renderer: {
        calls: scene.calls,
        triangles: scene.triangles,
        geometries: scene.geometries,
        textures: scene.textures,
      },
    };
  }

  private moveTier(direction: -1 | 1): RenderQualityTier | null {
    const current = TIER_ORDER.indexOf(this.tierValue);
    const next = Math.max(0, Math.min(TIER_ORDER.length - 1, current + direction));
    const nextTier = TIER_ORDER[next]!;
    if (nextTier === this.tierValue) return null;
    this.tierValue = nextTier;
    return nextTier;
  }
}

function percentile(sorted: number[], position: number) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * position));
  return Number((sorted[index] ?? 0).toFixed(2));
}
