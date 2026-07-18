import type { GameBackground } from "../types";

export interface BackgroundOption {
  kind: GameBackground;
  label: string;
}

export const GAME_BACKGROUNDS: readonly BackgroundOption[] = [
  { kind: "studio", label: "Studio" },
  { kind: "gym", label: "Boxing gym" },
  { kind: "midway", label: "Midway" },
  { kind: "rooftop", label: "Rooftop" },
] as const;

interface BackgroundPalette {
  clear: string;
  floor: string;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  fill: string;
  fillIntensity: number;
  rim: string;
  rimIntensity: number;
  spot: string;
  spotIntensity: number;
}

export const BACKGROUND_PALETTES: Record<GameBackground, BackgroundPalette> = {
  studio: {
    clear: "#101116",
    floor: "#24262d",
    hemisphereSky: "#b7c8dc",
    hemisphereGround: "#17131a",
    hemisphereIntensity: 0.42,
    fill: "#d5e2f0",
    fillIntensity: 0.62,
    rim: "#ff6558",
    rimIntensity: 0.72,
    spot: "#ffe4c8",
    spotIntensity: 3.1,
  },
  gym: {
    clear: "#24100e",
    floor: "#2a211d",
    hemisphereSky: "#d5b08d",
    hemisphereGround: "#1b0e0c",
    hemisphereIntensity: 0.38,
    fill: "#e8c3a2",
    fillIntensity: 0.58,
    rim: "#d84532",
    rimIntensity: 0.76,
    spot: "#ffd7ab",
    spotIntensity: 3.35,
  },
  midway: {
    clear: "#111d38",
    floor: "#3a1c22",
    hemisphereSky: "#a7c5eb",
    hemisphereGround: "#1a1020",
    hemisphereIntensity: 0.42,
    fill: "#d3e3ff",
    fillIntensity: 0.64,
    rim: "#ffcf32",
    rimIntensity: 0.82,
    spot: "#ffe2ae",
    spotIntensity: 3.4,
  },
  rooftop: {
    clear: "#0b1224",
    floor: "#202630",
    hemisphereSky: "#8ca8d3",
    hemisphereGround: "#0d111a",
    hemisphereIntensity: 0.34,
    fill: "#a9c5ef",
    fillIntensity: 0.56,
    rim: "#ef9f60",
    rimIntensity: 0.68,
    spot: "#d7e5ff",
    spotIntensity: 3.15,
  },
};

/**
 * Paint one complete, flat-color environment. Scene3D uploads this canvas only
 * when the stage changes, so the detail has no recurring geometry or draw-call
 * cost in the game loop.
 */
export function paintStageBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: GameBackground,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  if (background === "studio") paintStudio(ctx, width, height);
  if (background === "gym") paintGym(ctx, width, height);
  if (background === "midway") paintMidway(ctx, width, height);
  if (background === "rooftop") paintRooftop(ctx, width, height);
  ctx.restore();
}

function paintStudio(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fill(ctx, "#111218", 0, 0, w, h);

  const panelW = w / 12;
  for (let i = 0; i < 12; i++) {
    fill(ctx, i % 2 === 0 ? "#17191f" : "#1b1d24", i * panelW, 0, panelW + 1, h);
    fill(ctx, "#0c0d11", i * panelW, 0, Math.max(2, w * 0.002), h);
  }

  fill(ctx, "#22252d", w * 0.27, h * 0.08, w * 0.46, h * 0.78);
  strokeRect(ctx, "#343946", w * 0.27, h * 0.08, w * 0.46, h * 0.78, w * 0.006);
  fill(ctx, "#16181e", w * 0.31, h * 0.13, w * 0.38, h * 0.68);

  fill(ctx, "#08090c", 0, h * 0.12, w, h * 0.018);
  for (const x of [0.18, 0.82]) {
    fill(ctx, "#3a3f49", w * (x - 0.045), h * 0.18, w * 0.09, h * 0.018);
    fill(ctx, "#08090c", w * (x - 0.004), h * 0.12, w * 0.008, h * 0.06);
    circle(ctx, "#e8dfc9", w * x, h * 0.205, h * 0.028);
    circle(ctx, "#5a554d", w * x, h * 0.205, h * 0.013);
  }

  for (const x of [0.08, 0.79]) {
    fill(ctx, "#242833", w * x, h * 0.34, w * 0.13, h * 0.26);
    strokeRect(ctx, "#3b414e", w * x, h * 0.34, w * 0.13, h * 0.26, w * 0.004);
    for (let i = 1; i < 4; i++) {
      fill(ctx, "#13151b", w * (x + 0.012), h * (0.34 + i * 0.052), w * 0.106, h * 0.008);
    }
  }

  label(ctx, "STUDIO 03", w * 0.5, h * 0.275, Math.round(h * 0.052), "#777d89");
  fill(ctx, "#31343c", 0, h * 0.78, w, h * 0.22);
  fill(ctx, "#0b0c10", 0, h * 0.78, w, h * 0.012);
}

function paintGym(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fill(ctx, "#351513", 0, 0, w, h);

  const rows = 15;
  const brickH = h * 0.055;
  const brickW = w * 0.085;
  for (let row = 0; row < rows; row++) {
    const y = row * brickH;
    const offset = row % 2 === 0 ? -brickW * 0.5 : 0;
    for (let x = offset; x < w; x += brickW) {
      fill(ctx, row % 3 === 0 ? "#5b2520" : "#662a24", x + 2, y + 2, brickW - 4, brickH - 4);
    }
  }

  // A darker central training bay keeps the photographic face readable.
  fill(ctx, "#2e1514", w * 0.25, h * 0.08, w * 0.5, h * 0.72);
  strokeRect(ctx, "#18100f", w * 0.25, h * 0.08, w * 0.5, h * 0.72, w * 0.008);

  fill(ctx, "#e5c48f", w * 0.31, h * 0.12, w * 0.38, h * 0.17);
  strokeRect(ctx, "#17110f", w * 0.31, h * 0.12, w * 0.38, h * 0.17, w * 0.008);
  label(ctx, "BACKSTREET", w * 0.5, h * 0.205, Math.round(h * 0.065), "#251612");
  label(ctx, "BOXING CLUB", w * 0.5, h * 0.26, Math.round(h * 0.032), "#9e2f25");

  paintGymPoster(ctx, w * 0.07, h * 0.34, w * 0.15, h * 0.28, "TRAIN", "#d9b97f");
  paintGymPoster(ctx, w * 0.78, h * 0.34, w * 0.15, h * 0.28, "FIGHT", "#b64032");

  fill(ctx, "#171311", 0, h * 0.74, w, h * 0.26);
  for (const y of [0.7, 0.77, 0.84]) {
    fill(ctx, "#e6d3ad", 0, h * y, w, Math.max(4, h * 0.01));
    fill(ctx, "#7e261f", 0, h * y + h * 0.01, w, Math.max(2, h * 0.004));
  }
  for (const x of [0.055, 0.945]) {
    fill(ctx, "#1b1714", w * x - w * 0.012, h * 0.63, w * 0.024, h * 0.37);
  }
}

function paintGymPoster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  color: string,
) {
  fill(ctx, color, x, y, w, h);
  strokeRect(ctx, "#1b1110", x, y, w, h, Math.max(3, w * 0.04));
  circle(ctx, "#2b1815", x + w * 0.5, y + h * 0.43, Math.min(w, h) * 0.2);
  label(ctx, text, x + w * 0.5, y + h * 0.82, Math.round(h * 0.13), "#211411");
}

function paintMidway(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fill(ctx, "#13264d", 0, 0, w, h);

  const stripeW = w / 14;
  for (let i = 0; i < 14; i++) {
    fill(ctx, i % 2 === 0 ? "#9f2c2c" : "#ead19b", i * stripeW, 0, stripeW + 1, h);
  }
  fill(ctx, "#15284f", w * 0.23, h * 0.08, w * 0.54, h * 0.76);
  strokeRect(ctx, "#e7b932", w * 0.23, h * 0.08, w * 0.54, h * 0.76, w * 0.008);

  fill(ctx, "#e5b62d", w * 0.29, h * 0.13, w * 0.42, h * 0.17);
  strokeRect(ctx, "#351d18", w * 0.29, h * 0.13, w * 0.42, h * 0.17, w * 0.008);
  label(ctx, "TAKE YOUR SHOT", w * 0.5, h * 0.235, Math.round(h * 0.054), "#331b17");

  const bulbs = 11;
  for (let i = 0; i < bulbs; i++) {
    const x = w * (0.305 + (i / (bulbs - 1)) * 0.39);
    circle(ctx, "#fff0af", x, h * 0.145, h * 0.012);
    circle(ctx, "#fff0af", x, h * 0.285, h * 0.012);
  }
  for (let i = 0; i < 7; i++) {
    circle(ctx, "#fff0af", w * 0.3, h * (0.16 + i * 0.019), h * 0.011);
    circle(ctx, "#fff0af", w * 0.7, h * (0.16 + i * 0.019), h * 0.011);
  }

  for (const x of [0.13, 0.87]) {
    fill(ctx, "#e5b62d", w * x - w * 0.045, h * 0.39, w * 0.09, h * 0.22);
    strokeRect(ctx, "#351d18", w * x - w * 0.045, h * 0.39, w * 0.09, h * 0.22, w * 0.005);
    circle(ctx, "#9f2c2c", w * x, h * 0.47, h * 0.035);
    circle(ctx, "#15284f", w * x, h * 0.54, h * 0.022);
  }

  fill(ctx, "#321b22", 0, h * 0.75, w, h * 0.25);
  fill(ctx, "#e5b62d", 0, h * 0.75, w, h * 0.015);
  fill(ctx, "#9f2c2c", 0, h * 0.83, w, h * 0.05);
}

function paintRooftop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  fill(ctx, "#0d172d", 0, 0, w, h);
  fill(ctx, "#14203a", 0, h * 0.38, w, h * 0.4);

  circle(ctx, "#e9dfbd", w * 0.82, h * 0.2, h * 0.09);
  circle(ctx, "#c8bea0", w * 0.8, h * 0.18, h * 0.015);
  circle(ctx, "#c8bea0", w * 0.85, h * 0.225, h * 0.01);

  const stars = [
    [0.08, 0.13], [0.18, 0.22], [0.29, 0.15], [0.42, 0.23],
    [0.56, 0.12], [0.68, 0.27], [0.93, 0.12], [0.9, 0.32],
  ] as const;
  for (const [x, y] of stars) circle(ctx, "#a8bad8", w * x, h * y, Math.max(2, h * 0.004));

  const buildings = [
    [0, 0.55, 0.12, 0.25],
    [0.1, 0.48, 0.13, 0.32],
    [0.21, 0.6, 0.11, 0.2],
    [0.31, 0.51, 0.14, 0.29],
    [0.44, 0.62, 0.1, 0.18],
    [0.53, 0.54, 0.14, 0.26],
    [0.66, 0.59, 0.12, 0.21],
    [0.77, 0.46, 0.12, 0.34],
    [0.88, 0.56, 0.12, 0.24],
  ] as const;
  for (let i = 0; i < buildings.length; i++) {
    const [x, y, bw, bh] = buildings[i]!;
    fill(ctx, i % 2 === 0 ? "#111722" : "#171d28", w * x, h * y, w * bw, h * bh);
    paintWindows(ctx, w * x, h * y, w * bw, h * bh);
  }

  // Water tower and roof rail make the setting read even behind a large head.
  fill(ctx, "#090e17", w * 0.13, h * 0.38, w * 0.1, h * 0.075);
  fill(ctx, "#090e17", w * 0.145, h * 0.455, w * 0.008, h * 0.11);
  fill(ctx, "#090e17", w * 0.21, h * 0.455, w * 0.008, h * 0.11);
  fill(ctx, "#222935", 0, h * 0.78, w, h * 0.22);
  fill(ctx, "#090e17", 0, h * 0.77, w, h * 0.018);
  fill(ctx, "#111722", 0, h * 0.69, w, h * 0.012);
  for (let x = 0; x <= 1; x += 0.1) {
    fill(ctx, "#111722", w * x, h * 0.68, w * 0.008, h * 0.11);
  }
}

function paintWindows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const cols = Math.max(2, Math.floor(w / 34));
  const rows = Math.max(2, Math.floor(h / 34));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if ((row * 3 + col * 5 + Math.round(x)) % 4 !== 0) continue;
      fill(
        ctx,
        "#d19b4f",
        x + ((col + 0.5) / cols) * w,
        y + ((row + 0.6) / rows) * h,
        Math.max(3, w * 0.055),
        Math.max(4, h * 0.045),
      );
    }
  }
}

function fill(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function strokeRect(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
  lineWidth: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(x, y, w, h);
}

function circle(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radius: number,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.font = `900 ${size}px "Arial Black", "Archivo", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}
