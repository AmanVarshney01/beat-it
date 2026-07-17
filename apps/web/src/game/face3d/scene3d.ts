import * as THREE from "three";

import type { AttackKind, Landmark3 } from "../types";
import { TRIANGULATION } from "./triangulation";

// canonical FaceMesh anchor indices for the softness field
const LM_RIGHT_CHEEK = 50;
const LM_LEFT_CHEEK = 280;
const LM_CHIN = 152;
const LM_FOREHEAD = 10;

const DEPTH_SCALE = 2.4; // exaggerates landmark z — comic, not scan
const SPRING_K = 160;
const SPRING_C = 13;
const SETTLE_EPS = 0.0008;
const MAX_STRANDS = 24;

const lam = (color: THREE.ColorRepresentation) => new THREE.MeshLambertMaterial({ color });

/**
 * The full 3D scene: a lit room, the dummy (torso + neck), the landmark face
 * mesh, 3D weapon projectiles, and noodle mess. The engine keeps physics,
 * timing and input, and drives this scene every frame. World units are CSS
 * pixels at the z = 0 plane, so physics coordinates map 1:1.
 */
export class Scene3D {
  /** Idle sway toggle (settings-controlled). */
  swayEnabled = true;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private cameraDist = 1000;

  private headGroup = new THREE.Group();
  private faceMesh: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private torso: THREE.Mesh;
  private neck: THREE.Mesh;
  private floor: THREE.Mesh;
  private wall: THREE.Mesh;
  private spot: THREE.SpotLight;

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
  private headRadius = 100;

  private projectiles = new Map<number, THREE.Group>();
  private strands: THREE.Mesh[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    face: HTMLCanvasElement,
    landmarks: Landmark3[],
    neckColor: string,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setClearColor(0x141217, 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(35, 1, 10, 8000);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const fill = new THREE.DirectionalLight(0xfff4e8, 0.9);
    fill.position.set(0.5, 0.6, 1);
    this.scene.add(fill);
    this.spot = new THREE.SpotLight(0xfff2df, 3.4, 0, 0.9, 0.6, 0.25);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.far = 6000;
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    // the room
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), lam(0x37303c));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(12000, 8000), lam(0x272230));
    this.wall.position.z = -1100;
    this.wall.receiveShadow = true;
    this.scene.add(this.wall);

    // the dummy
    this.torso = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.18, 2, 28), lam(0xc23434));
    this.torso.castShadow = true;
    this.scene.add(this.torso);
    this.neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 1, 1, 18),
      lam(new THREE.Color(neckColor).multiplyScalar(0.96)),
    );
    this.neck.castShadow = true;
    this.scene.add(this.neck);

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
    const material = new THREE.MeshLambertMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
    });
    this.faceMesh = new THREE.Mesh(geometry, material);
    this.faceMesh.castShadow = true;
    this.headGroup.add(this.faceMesh);
    this.scene.add(this.headGroup);

    this.softness = buildVertexSoftness(landmarks);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);
    this.camera.aspect = cssW / cssH;
    // camera distance such that 1 world unit == 1 css pixel at z = 0
    this.cameraDist = cssH / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(0, 0, this.cameraDist);
    this.camera.updateProjectionMatrix();
  }

  private wx(x: number) {
    return x - this.cssW / 2;
  }

  private wy(y: number) {
    return -(y - this.cssH / 2);
  }

  /** Position the static scene around the dummy's mount point. */
  setLayout(mount: { x: number; y: number }, headRadius: number, torsoTop: number, floorY: number) {
    this.headRadius = headRadius;
    const r = headRadius;
    this.torso.scale.set(r * 1.08, r * 1.15, r * 0.8);
    this.torso.position.set(this.wx(mount.x), this.wy(torsoTop) - r * 1.15, -r * 0.1);
    this.floor.position.y = this.wy(floorY);
    this.wall.position.y = this.wy(floorY) + 1200;
    this.spot.position.set(this.wx(mount.x) - r * 3.2, this.wy(mount.y) + r * 4.2, r * 5);
    this.spot.target.position.set(this.wx(mount.x), this.wy(mount.y), 0);
  }

  /** Map the head to canvas pixels: position, physics angle, squash state. */
  setHead(
    px: number,
    py: number,
    angle: number,
    headRx: number,
    headRy: number,
    squash: number,
    squashAngle: number,
  ) {
    this.headGroup.position.set(this.wx(px), this.wy(py), 0);
    this.headGroup.rotation.z = -angle;
    this.headGroup.rotation.y = this.yaw + (this.swayEnabled ? Math.sin(this.elapsed * 0.7) * 0.09 : 0);
    this.headGroup.rotation.x = this.pitch;

    const s = Math.max(-0.5, Math.min(1.4, squash));
    const c2 = Math.cos(squashAngle) ** 2;
    const sx = 1 - 0.32 * s * c2 + 0.26 * s * (1 - c2);
    const sy = 1 - 0.32 * s * (1 - c2) + 0.26 * s * c2;
    this.headGroup.scale.set(3 * headRx * sx, 3 * headRy * sy, 3 * headRx);
  }

  /** Skin-tinted neck cylinder between the shoulders and the chin. */
  setNeck(topX: number, topY: number, botX: number, botY: number, radius: number) {
    const top = new THREE.Vector3(this.wx(topX), this.wy(topY), -radius * 0.5);
    const bot = new THREE.Vector3(this.wx(botX), this.wy(botY), -radius * 0.5);
    const dir = top.clone().sub(bot);
    const len = Math.max(dir.length(), 1);
    this.neck.position.copy(bot).add(top).multiplyScalar(0.5);
    this.neck.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    this.neck.scale.set(radius, len, radius);
  }

  /** Screen shake as camera jitter. */
  setShake(sx: number, sy: number) {
    this.camera.position.set(sx, -sy, this.cameraDist);
  }

  /** Impact at (lx, ly) in [-1,1] face space pushing along (dirX, dirY). */
  punchDent(lx: number, ly: number, dirX: number, dirY: number, strength: number) {
    // rotation swing away from the blow — the money shot for depth
    this.yawVel += dirX * (0.9 + 0.5 * strength);
    this.pitchVel += dirY * (0.5 + 0.3 * strength);

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

  // ── projectiles ────────────────────────────────────────────────────────────

  spawnProjectile(id: number, kind: AttackKind) {
    const group = buildWeaponMesh(kind);
    group.scale.setScalar(this.headRadius * WEAPON_SCALE[kind]);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.scene.add(group);
    this.projectiles.set(id, group);
  }

  /**
   * Position a projectile along its flight. (x, y) is the engine's 2D path
   * point; depth, arc and tumble are added here per kind.
   */
  moveProjectile(id: number, kind: AttackKind, x: number, y: number, angle: number, travel: number, t: number) {
    const group = this.projectiles.get(id);
    if (!group) return;
    const r = this.headRadius;
    let z = 0;
    let py = y;
    if (kind === "tomato" || kind === "egg" || kind === "pie" || kind === "chili") {
      z = (1 - travel) * 750; // thrown from the viewer, closing into the scene
      py = y - Math.sin(travel * Math.PI) * r * 0.5;
      group.rotation.x = t * 9;
      group.rotation.z = t * 7;
    } else if (kind === "noodles") {
      z = (1 - travel) * 260;
      group.rotation.y = t * 5;
    } else if (kind === "mallet") {
      z = Math.sin(travel * Math.PI) * r * 0.4;
      group.rotation.z = -0.35 + travel * 0.7;
    } else if (kind === "fish") {
      z = Math.sin(travel * Math.PI) * r * 0.8;
      group.rotation.z = t * 10;
    } else {
      // punch / slap sweep in with a slight outward bow
      z = Math.sin(travel * Math.PI) * r * 0.9;
      group.rotation.z = Math.abs(angle) > Math.PI / 2 ? Math.PI : 0;
    }
    group.position.set(this.wx(x), this.wy(py), z);
  }

  removeProjectile(id: number) {
    const group = this.projectiles.get(id);
    if (!group) return;
    this.scene.remove(group);
    disposeGroup(group);
    this.projectiles.delete(id);
  }

  // ── noodle mess ────────────────────────────────────────────────────────────

  /** Drape noodle strands on the head at a face-space impact point. */
  addNoodleStrands(lx: number, ly: number) {
    const anchorX = lx * 0.5;
    const anchorY = -ly * 0.5;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const sway = (Math.random() - 0.5) * 0.3;
      const len = 0.25 + Math.random() * 0.35;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(anchorX, anchorY, 0.12),
        new THREE.Vector3(anchorX + sway * 0.4, anchorY - len * 0.35, 0.16 + Math.random() * 0.06),
        new THREE.Vector3(anchorX + sway, anchorY - len * 0.7, 0.1),
        new THREE.Vector3(anchorX + sway * 1.4, anchorY - len, 0.05),
      ]);
      const strand = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, 0.014, 6),
        lam(0xe9d38f),
      );
      this.headGroup.add(strand);
      this.strands.push(strand);
    }
    while (this.strands.length > MAX_STRANDS) {
      const old = this.strands.shift()!;
      this.headGroup.remove(old);
      old.geometry.dispose();
      (old.material as THREE.Material).dispose();
    }
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
    for (const s of this.strands) {
      this.headGroup.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    }
    this.strands = [];
  }

  dispose() {
    for (const id of [...this.projectiles.keys()]) this.removeProjectile(id);
    this.reset();
    this.faceMesh.geometry.dispose();
    (this.faceMesh.material as THREE.Material).dispose();
    this.texture.dispose();
    this.renderer.dispose();
  }
}

// ── weapon models (primitives only, no assets) ───────────────────────────────

const WEAPON_SCALE: Record<AttackKind, number> = {
  punch: 1.05,
  slap: 1.0,
  mallet: 1.2,
  fish: 0.95,
  tomato: 0.42,
  egg: 0.36,
  pie: 0.55,
  chili: 0.45,
  noodles: 0.55,
};

export function buildWeaponMesh(kind: AttackKind): THREE.Group {
  const g = new THREE.Group();
  switch (kind) {
    case "tomato": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), lam(0xd4321f));
      body.scale.y = 0.88;
      g.add(body);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), lam(0x3f7d2a));
        const a = (i / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 0.12, 0.45, Math.sin(a) * 0.12);
        leaf.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * -0.9);
        g.add(leaf);
      }
      break;
    }
    case "egg": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 16), lam(0xf6f0e0));
      body.scale.y = 1.3;
      g.add(body);
      break;
    }
    case "pie": {
      const tin = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.2, 24), lam(0xb9bcc4));
      g.add(tin);
      const cream = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), lam(0xf8f3e6));
      cream.scale.y = 0.55;
      cream.position.y = 0.16;
      g.add(cream);
      for (let i = 0; i < 6; i++) {
        const blob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), lam(0xfdfaf2));
        const a = (i / 6) * Math.PI * 2;
        blob.position.set(Math.cos(a) * 0.32, 0.22, Math.sin(a) * 0.32);
        g.add(blob);
      }
      const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lam(0xc0272d));
      cherry.position.y = 0.42;
      g.add(cherry);
      break;
    }
    case "chili": {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.35, 0.18, 0),
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(0.3, -0.08, 0),
        new THREE.Vector3(0.52, -0.3, 0),
      ]);
      const body = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.11, 10), lam(0xc8271a));
      g.add(body);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 10), lam(0xc8271a));
      tip.position.set(0.58, -0.38, 0);
      tip.rotation.z = -2.3;
      g.add(tip);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 0.22, 8), lam(0x40802c));
      stem.position.set(-0.44, 0.28, 0);
      stem.rotation.z = 0.5;
      g.add(stem);
      break;
    }
    case "punch": {
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), lam(0xc22525));
      main.scale.set(1.1, 0.92, 0.9);
      g.add(main);
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), lam(0xc22525));
      thumb.position.set(0.08, -0.36, 0.22);
      g.add(thumb);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.34, 16), lam(0x8c1a1a));
      cuff.rotation.z = Math.PI / 2;
      cuff.position.x = -0.62;
      g.add(cuff);
      break;
    }
    case "slap": {
      const skin = 0xe6b28c;
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.6, 0.14), lam(skin));
      g.add(palm);
      for (let i = 0; i < 4; i++) {
        const lenY = [0.42, 0.5, 0.46, 0.36][i]!;
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, lenY, 3, 8), lam(skin));
        finger.rotation.z = Math.PI / 2;
        finger.position.set(0.3 + lenY / 2, -0.21 + i * 0.14, 0);
        g.add(finger);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 3, 8), lam(skin));
      thumb.rotation.z = 0.9;
      thumb.position.set(0.05, -0.42, 0.02);
      g.add(thumb);
      break;
    }
    case "mallet": {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.05, 20), lam(0x7c4e27));
      head.rotation.z = Math.PI / 2;
      head.position.y = -0.28;
      g.add(head);
      for (const side of [-0.48, 0.48]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.08, 20), lam(0x5b3a1d));
        band.rotation.z = Math.PI / 2;
        band.position.set(side, -0.28, 0);
        g.add(band);
      }
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 12), lam(0xa8763e));
      handle.position.y = 0.35;
      g.add(handle);
      break;
    }
    case "fish": {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), lam(0x6f9ec4));
      body.scale.set(1.5, 0.55, 0.6);
      g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.45, 4), lam(0x5b87ad));
      tail.rotation.z = Math.PI / 2;
      tail.scale.z = 0.35;
      tail.position.x = -0.85;
      g.add(tail);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), lam(0x5b87ad));
      fin.scale.z = 0.3;
      fin.position.set(0.05, 0.32, 0);
      g.add(fin);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lam(0x101418));
      eye.position.set(0.5, 0.1, 0.28);
      g.add(eye);
      break;
    }
    case "noodles": {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * 0.18, 0.25, Math.sin(a) * 0.18),
          new THREE.Vector3(Math.cos(a + 1) * 0.32, 0.02, Math.sin(a + 1) * 0.32),
          new THREE.Vector3(Math.cos(a + 2) * 0.2, -0.22, Math.sin(a + 2) * 0.2),
          new THREE.Vector3(Math.cos(a + 2.6) * 0.3, -0.45, Math.sin(a + 2.6) * 0.3),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.045, 6), lam(0xe9d38f)));
      }
      break;
    }
  }
  return g;
}

function disposeGroup(group: THREE.Group) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}

// ── weapon icons: picker, cursor, and 2D-fallback sprites ────────────────────

let iconRenderer: THREE.WebGLRenderer | null = null;
const iconCache = new Map<string, HTMLCanvasElement>();

export function renderWeaponIcon(kind: AttackKind, size: number): HTMLCanvasElement {
  const key = `${kind}@${size}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  iconRenderer ??= new THREE.WebGLRenderer({
    canvas: document.createElement("canvas"),
    alpha: true,
    antialias: true,
  });
  iconRenderer.setClearColor(0x000000, 0);
  iconRenderer.setSize(128, 128, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key1 = new THREE.DirectionalLight(0xffffff, 1.6);
  key1.position.set(0.6, 0.8, 1);
  scene.add(key1);
  const mesh = buildWeaponMesh(kind);
  mesh.rotation.set(0.35, kind === "mallet" ? 0.4 : -0.5, 0);
  scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-0.85, 0.85, 0.85, -0.85, 0.1, 10);
  cam.position.z = 3;
  iconRenderer.render(scene, cam);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  out.getContext("2d")?.drawImage(iconRenderer.domElement, 0, 0, size, size);
  disposeGroup(mesh);
  iconCache.set(key, out);
  return out;
}

export function weaponCursorUrl(kind: AttackKind): string {
  return renderWeaponIcon(kind, 32).toDataURL();
}

// ── flesh softness (shared with 2D warp semantics) ───────────────────────────

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
