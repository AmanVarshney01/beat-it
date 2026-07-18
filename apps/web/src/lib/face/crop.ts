import type { DetectedFace } from "./detector";

export interface OvalRegion {
  /** center of the oval in source-image pixels */
  cx: number;
  cy: number;
  /** oval radii in source-image pixels */
  rx: number;
  ry: number;
  /** rotation of the oval in radians (positive = clockwise) */
  angle: number;
}

export const FACE_ASPECT = 1.3; // ry / rx of the cutout oval

const OUT_WIDTH = 420;
const OUT_HEIGHT = Math.round(OUT_WIDTH * FACE_ASPECT);

/** Derive the crop oval from a detection: sized off the box, leveled by the eye line. */
export function regionFromDetection(face: DetectedFace): OvalRegion {
  const { box, leftEye, rightEye } = face;
  const angle = Math.atan2(leftEye.y - rightEye.y, leftEye.x - rightEye.x);
  return {
    cx: box.x + box.width / 2,
    // detection boxes hug the eyes/nose; shift down a touch to include the chin
    cy: box.y + box.height * 0.58,
    rx: box.width * 0.62,
    ry: box.width * 0.62 * FACE_ASPECT,
    angle,
  };
}

/**
 * Crop `region` out of the image into a fixed-size oval cutout with a cartoon
 * outline. Runs once per upload; the game loop only ever draws the result.
 */
export function cropFaceOval(image: CanvasImageSource, region: OvalRegion): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = OUT_WIDTH;
  out.height = OUT_HEIGHT;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D not supported");

  const ellipse = new Path2D();
  ellipse.ellipse(OUT_WIDTH / 2, OUT_HEIGHT / 2, OUT_WIDTH / 2 - 4, OUT_HEIGHT / 2 - 4, 0, 0, Math.PI * 2);

  ctx.save();
  ctx.clip(ellipse);
  // Map the (possibly rotated) source oval onto the output canvas.
  ctx.translate(OUT_WIDTH / 2, OUT_HEIGHT / 2);
  ctx.scale((OUT_WIDTH / 2) / region.rx, (OUT_HEIGHT / 2) / region.ry);
  ctx.rotate(-region.angle);
  ctx.translate(-region.cx, -region.cy);
  ctx.drawImage(image, 0, 0);
  ctx.restore();

  ctx.lineWidth = 8;
  ctx.strokeStyle = "#1f1f1f";
  ctx.stroke(ellipse);

  return out;
}
