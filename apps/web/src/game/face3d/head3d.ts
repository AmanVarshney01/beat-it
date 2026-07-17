import * as THREE from "three";

import { TRIANGULATION } from "./triangulation";

export interface Landmark3 {
  x: number;
  y: number;
  z: number;
}

// canonical FaceMesh anchor indices for the softness field
const LM_RIGHT_CHEEK = 50;
const LM_LEFT_CHEEK = 280;
const LM_CHIN = 152;
const LM_FOREHEAD = 10;

const DEPTH_SCALE = 2.4; // exaggerates landmark z — comic, not scan
const SPRING_K = 160;
const SPRING_C = 13;
const SETTLE_EPS = 0.0008;

/**
 * A real 3D head built from the photo's own landmarks: the face surface uses
 * the 468 landmark positions (with depth) textured by the cropped bitmap, and
 * a skin-tinted ellipsoid provides the back of the skull. Rendered on its own
 * transparent WebGL canvas; the 2D engine drives its transform every frame.
 *
 * Geometry lives in normalized face space (x, y in roughly [-0.5, 0.5]); the
 * group scale maps it to screen pixels.
 */
export class Head3D {
  /** Idle sway toggle (settings-controlled). */
  swayEnabled = true;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private group = new THREE.Group();
  private faceMesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;

  private rest: Float32Array;
  private offsets: Float32Array;
  private velocities: Float32Array;
  private softness: Float32Array;
  private deformActive = false;

  // punch-driven rotation springs — the parallax that sells the 3D
  private yaw = 0;
  private yawVel = 0;
  private pitch = 0;
  private pitchVel = 0;
  private elapsed = 0;

  private cssW = 1;
  private cssH = 1;

  constructor(canvas: HTMLCanvasElement, face: HTMLCanvasElement, landmarks: Landmark3[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(35, 1, 10, 6000);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-0.6, 0.8, 1.2);
    this.scene.add(key);

    // face surface: positions from landmarks, UVs into the crop bitmap
    const count = landmarks.length;
    this.rest = new Float32Array(count * 3);
    this.offsets = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const lm = landmarks[i]!;
      this.rest[i * 3] = lm.x - 0.5;
      this.rest[i * 3 + 1] = -(lm.y - 0.5);
      this.rest[i * 3 + 2] = -lm.z * DEPTH_SCALE;
      uvs[i * 2] = lm.x;
      uvs[i * 2 + 1] = lm.y;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.rest.slice(), 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex([...TRIANGULATION]);
    geometry.computeVertexNormals();

    this.texture = new THREE.CanvasTexture(face);
    this.texture.flipY = false; // UVs use top-origin landmark coords directly
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // face only — no backing skull volume; DoubleSide keeps grazing angles
    // solid within the clamped yaw range
    const material = new THREE.MeshLambertMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
    });
    this.faceMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.faceMesh);

    this.scene.add(this.group);
    this.softness = buildVertexSoftness(landmarks);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);
    this.camera.aspect = cssW / cssH;
    // camera distance such that 1 world unit == 1 css pixel at z = 0
    this.camera.position.z = cssH / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.updateProjectionMatrix();
  }

  /** Map the head to canvas pixels: position, physics angle, squash state. */
  setTransform(
    px: number,
    py: number,
    angle: number,
    headRx: number,
    headRy: number,
    squash: number,
    squashAngle: number,
    shakeX: number,
    shakeY: number,
  ) {
    this.group.position.set(px - this.cssW / 2 + shakeX, -(py - this.cssH / 2 + shakeY), 0);
    this.group.rotation.z = -angle;
    this.group.rotation.y = this.yaw + (this.swayEnabled ? Math.sin(this.elapsed * 0.7) * 0.09 : 0);
    this.group.rotation.x = this.pitch;

    const s = Math.max(-0.5, Math.min(1.4, squash));
    const c2 = Math.cos(squashAngle) ** 2;
    const sx = 1 - 0.32 * s * c2 + 0.26 * s * (1 - c2);
    const sy = 1 - 0.32 * s * (1 - c2) + 0.26 * s * c2;
    this.group.scale.set(3 * headRx * sx, 3 * headRy * sy, 3 * headRx);
  }

  /** Impact at (lx, ly) in [-1,1] face space pushing along (dirX, dirY). */
  punch(lx: number, ly: number, dirX: number, dirY: number, strength: number) {
    // rotation swing away from the blow — the money shot for depth
    this.yawVel += dirX * (0.9 + 0.5 * strength);
    this.pitchVel += dirY * (0.5 + 0.3 * strength);

    // mesh dent, biased into the face (−z)
    const ix = lx * 0.5;
    const iy = -ly * 0.5;
    const len = Math.hypot(dirX, dirY, 1.1);
    const dx = dirX / len;
    const dy = -dirY / len;
    const dz = -1.1 / len;
    const amp = Math.min(0.16, 0.11 * strength);
    const count = this.rest.length / 3;
    for (let i = 0; i < count; i++) {
      const vx = this.rest[i * 3]! + this.offsets[i * 3]!;
      const vy = this.rest[i * 3 + 1]! + this.offsets[i * 3 + 1]!;
      const d = Math.hypot(vx - ix, vy - iy);
      const falloff = Math.exp(-((d / 0.24) ** 2)) * (this.softness[i] ?? 1);
      this.velocities[i * 3] += dx * amp * falloff * 14;
      this.velocities[i * 3 + 1] += dy * amp * falloff * 14;
      this.velocities[i * 3 + 2] += dz * amp * falloff * 14;
    }
    this.deformActive = true;
  }

  update(dt: number) {
    this.elapsed += dt;

    // rotation springs
    this.yawVel += (-30 * this.yaw - 6 * this.yawVel) * dt;
    this.yaw = Math.max(-0.55, Math.min(0.55, this.yaw + this.yawVel * dt));
    this.pitchVel += (-30 * this.pitch - 6 * this.pitchVel) * dt;
    this.pitch = Math.max(-0.35, Math.min(0.35, this.pitch + this.pitchVel * dt));

    if (!this.deformActive) return;
    let maxDisp = 0;
    const positions = this.faceMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;
    for (let i = 0; i < this.offsets.length; i++) {
      this.velocities[i]! += (-SPRING_K * this.offsets[i]! - SPRING_C * this.velocities[i]!) * dt;
      this.offsets[i]! += this.velocities[i]! * dt;
      arr[i] = this.rest[i]! + this.offsets[i]!;
      const disp = Math.abs(this.offsets[i]!) + Math.abs(this.velocities[i]!) * 0.05;
      if (disp > maxDisp) maxDisp = disp;
    }
    positions.needsUpdate = true;
    this.faceMesh.geometry.computeVertexNormals();
    if (maxDisp < SETTLE_EPS) {
      this.offsets.fill(0);
      this.velocities.fill(0);
      arr.set(this.rest);
      positions.needsUpdate = true;
      this.faceMesh.geometry.computeVertexNormals();
      this.deformActive = false;
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  /** Call after the face canvas has been repainted (e.g. new damage stage). */
  refreshTexture() {
    this.texture.needsUpdate = true;
  }

  reset() {
    this.offsets.fill(0);
    this.velocities.fill(0);
    const positions = this.faceMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    (positions.array as Float32Array).set(this.rest);
    positions.needsUpdate = true;
    this.faceMesh.geometry.computeVertexNormals();
    this.deformActive = false;
    this.yaw = this.yawVel = this.pitch = this.pitchVel = 0;
  }

  dispose() {
    this.faceMesh.geometry.dispose();
    (this.faceMesh.material as THREE.Material).dispose();
    this.texture.dispose();
    this.renderer.dispose();
  }
}

/** Per-vertex flesh softness: cheeks/chin squishy, forehead skull-stiff. */
function buildVertexSoftness(landmarks: Landmark3[]): Float32Array {
  const map = new Float32Array(landmarks.length).fill(0.7);
  const cheekR = landmarks[LM_RIGHT_CHEEK];
  const cheekL = landmarks[LM_LEFT_CHEEK];
  const chin = landmarks[LM_CHIN];
  const forehead = landmarks[LM_FOREHEAD];
  if (!cheekR || !cheekL || !chin || !forehead) return map;
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]!;
    let s = 0.5;
    for (const a of [cheekR, cheekL, chin]) {
      s += 0.5 * Math.exp(-((Math.hypot(lm.x - a.x, lm.y - a.y) / 0.25) ** 2));
    }
    s -= 0.45 * Math.exp(-((Math.hypot(lm.x - forehead.x, lm.y - forehead.y) / 0.3) ** 2));
    map[i] = Math.max(0.2, Math.min(1, s));
  }
  return map;
}

