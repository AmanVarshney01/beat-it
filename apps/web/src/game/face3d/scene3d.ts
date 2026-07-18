import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import type { AttackKind, Landmark3 } from "../types";
import { instantiateDummy, instantiateWeapon } from "./assets";
import { TRIANGULATION } from "./triangulation";

// canonical FaceMesh anchor indices for the softness field
const LM_RIGHT_CHEEK = 50;
const LM_LEFT_CHEEK = 280;
const LM_CHIN = 152;
const LM_FOREHEAD = 10;

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109,
] as const;
const DEPTH_SCALE = 1.45;
const SPRING_K = 160;
const SPRING_C = 13;
const SETTLE_EPS = 0.0008;

const pbr = (
  color: THREE.ColorRepresentation,
  roughness = 0.56,
  metalness = 0,
) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const lam = pbr;

export interface FaceSurfaceContact {
  /** Face-texture coordinates, top-origin like the source canvas. */
  u: number;
  v: number;
  /** Normalized face-local coordinates used by the deformation field. */
  localX: number;
  localY: number;
}

/**
 * The full 3D scene: a lit room, the dummy (torso + neck), the landmark face
 * mesh and 3D weapon projectiles. The engine keeps physics,
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
  private environment: THREE.Texture;

  private headGroup = new THREE.Group();
  private faceMesh: THREE.Mesh;
  private faceUnderlay: THREE.Mesh;
  private headShell: THREE.Mesh;
  private edgeSkirt: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private torso: THREE.Object3D;
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
  private projectileRaycaster = new THREE.Raycaster();
  private projectilePointer = new THREE.Vector2();
  private projectileWorldPoint = new THREE.Vector3();
  constructor(
    canvas: HTMLCanvasElement,
    face: HTMLCanvasElement,
    landmarks: Landmark3[],
    neckColor: string,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x141217, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.88;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.52;

    this.camera = new THREE.PerspectiveCamera(35, 1, 10, 8000);

    this.scene.add(new THREE.HemisphereLight(0x9fb8d8, 0x170d14, 0.4));
    const fill = new THREE.DirectionalLight(0xbfd8ff, 0.68);
    fill.position.set(1.5, 1.2, 2.5);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xff6558, 0.9);
    rim.position.set(2, 1.5, -2);
    this.scene.add(rim);
    this.spot = new THREE.SpotLight(0xffe2c5, 3.2, 0, 0.72, 0.72, 0.42);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.00015;
    this.spot.shadow.normalBias = 0.025;
    this.spot.shadow.camera.far = 6000;
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    // the room
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), pbr(0x302b35, 0.72));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(12000, 8000), pbr(0x09080e, 0.96));
    this.wall.position.z = -1100;
    this.wall.receiveShadow = true;
    this.scene.add(this.wall);

    // the dummy
    this.torso = instantiateDummy() ?? new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.18, 2, 28),
      pbr(0xa81f2c, 0.38),
    );
    this.torso.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.scene.add(this.torso);
    const sampledSkinColor = sampleCanvasColor(face, 0.3, 0.55, neckColor);
    this.neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.95, 1, 24, 1, true),
      new THREE.MeshPhysicalMaterial({
        color: 0x303744,
        roughness: 0.58,
        metalness: 0.08,
        clearcoat: 0.06,
      }),
    );
    this.neck.castShadow = true;
    this.scene.add(this.neck);

    // face surface: positions from landmarks, UVs into the crop bitmap
    const count = landmarks.length;
    this.rest = new Float32Array(count * 3);
    this.offsets = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    const sortedZ = landmarks.map((landmark) => landmark.z).sort((a, b) => a - b);
    for (const landmark of landmarks) {
      minX = Math.min(minX, landmark.x);
      maxX = Math.max(maxX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxY = Math.max(maxY, landmark.y);
    }
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const medianZ = sortedZ[Math.floor(sortedZ.length / 2)] ?? 0;
    for (let i = 0; i < count; i++) {
      const lm = landmarks[i]!;
      this.rest[i * 3] = lm.x - centerX;
      this.rest[i * 3 + 1] = -(lm.y - centerY);
      this.rest[i * 3 + 2] = THREE.MathUtils.clamp(
        -(lm.z - medianZ) * DEPTH_SCALE,
        -0.1,
        0.19,
      );
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
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      roughness: 0.72,
      metalness: 0,
      envMapIntensity: 0.32,
    });
    this.faceMesh = new THREE.Mesh(geometry, material);
    this.faceMesh.position.z = 0.12;
    this.faceMesh.castShadow = true;
    this.faceMesh.receiveShadow = true;

    const skinColor = sampledSkinColor.clone().multiplyScalar(0.96);
    const headBackColor = sampleCanvasColor(face, 0.5, 0.1, neckColor).multiplyScalar(0.8);
    this.headShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 42, 30, 0, Math.PI * 2, 0, Math.PI * 0.82),
      new THREE.MeshPhysicalMaterial({
        color: headBackColor,
        roughness: 0.76,
        sheen: 0.05,
        envMapIntensity: 0.28,
      }),
    );
    this.headShell.scale.set(0.86, 0.88, 0.72);
    this.headShell.position.set(0, 0.035, -0.26);
    this.headShell.castShadow = true;
    this.headShell.receiveShadow = true;

    this.faceUnderlay = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 36, 24),
      new THREE.MeshStandardMaterial({
        color: skinColor,
        roughness: 0.74,
        envMapIntensity: 0.25,
      }),
    );
    this.faceUnderlay.scale.set(0.78, 0.88, 0.55);
    this.faceUnderlay.position.z = -0.18;
    this.faceUnderlay.castShadow = true;

    this.edgeSkirt = new THREE.Mesh(
      buildEdgeSkirtGeometry(this.rest),
      new THREE.MeshStandardMaterial({
        color: skinColor,
        roughness: 0.72,
        side: THREE.DoubleSide,
        envMapIntensity: 0.3,
      }),
    );
    this.edgeSkirt.castShadow = true;
    // Kept as a prepared transition mesh for future side-profile tuning; the
    // front landmark surface and inset shell currently produce the cleaner read.
    this.edgeSkirt.visible = false;
    this.headGroup.add(this.headShell, this.faceUnderlay, this.edgeSkirt, this.faceMesh);
    this.scene.add(this.headGroup);
    this.softness = buildVertexSoftness(landmarks);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.renderer.setPixelRatio(Math.min(dpr, cssW < 600 ? 1.25 : 1.75));
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

  /**
   * Build the camera ray through a CSS-pixel point so a projectile placed in
   * front of the head still projects onto the requested contact coordinate.
   */
  private rayAtScreenPoint(x: number, y: number) {
    this.projectilePointer.set(
      (x / Math.max(this.cssW, 1)) * 2 - 1,
      1 - (y / Math.max(this.cssH, 1)) * 2,
    );
    this.camera.updateMatrixWorld(true);
    this.projectileRaycaster.setFromCamera(this.projectilePointer, this.camera);
    return this.projectileRaycaster.ray;
  }

  /**
   * Resolve the visible face triangle under a CSS-pixel point. The interpolated
   * mesh UV is the single source of truth for persistent bruises and food.
   */
  resolveFaceContact(x: number, y: number): FaceSurfaceContact | null {
    this.rayAtScreenPoint(x, y);
    this.scene.updateMatrixWorld(true);
    const contact = this.projectileRaycaster.intersectObject(this.faceMesh, false)[0];
    if (!contact?.uv) return null;

    const local = this.faceMesh.worldToLocal(contact.point.clone());
    return {
      u: THREE.MathUtils.clamp(contact.uv.x, 0.003, 0.997),
      v: THREE.MathUtils.clamp(contact.uv.y, 0.003, 0.997),
      localX: THREE.MathUtils.clamp(local.x / 0.5, -1.05, 1.05),
      localY: THREE.MathUtils.clamp(-local.y / 0.5, -1.05, 1.05),
    };
  }

  /** Position the static scene around the dummy's mount point. */
  setLayout(mount: { x: number; y: number }, headRadius: number, torsoTop: number, floorY: number) {
    this.headRadius = headRadius;
    const r = headRadius;
    if (this.torso.userData.sharedAsset) {
      this.torso.scale.setScalar(r * 0.92);
      this.torso.position.set(this.wx(mount.x), this.wy(torsoTop) - r * 1.4, -r * 0.18);
    } else {
      this.torso.scale.set(r * 1.08, r * 1.15, r * 0.8);
      this.torso.position.set(this.wx(mount.x), this.wy(torsoTop) - r * 1.15, -r * 0.1);
    }
    this.floor.position.y = this.wy(floorY);
    this.wall.position.y = this.wy(floorY) + 1200;
    this.spot.position.set(this.wx(mount.x) - r * 3.2, this.wy(mount.y) + r * 4.6, r * 5.5);
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
    const sx = 1 - 0.18 * s * c2 + 0.11 * s * (1 - c2);
    const sy = 1 - 0.18 * s * (1 - c2) + 0.11 * s * c2;
    this.headGroup.scale.set(3 * headRx * sx, 3 * headRy * sy, 3 * headRx);
  }

  /** Narrow graphite mounting post between the training stand and the head. */
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
    this.camera.rotation.z = THREE.MathUtils.clamp(sx / Math.max(this.cssW, 1), -0.012, 0.012);
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
    const authored = instantiateWeapon(kind);
    const group = authored ?? buildWeaponMesh(kind);
    const baseScale = this.headRadius * WEAPON_SCALE[kind];
    group.scale.setScalar(baseScale);
    group.traverse((o) => {
      // Fast projectiles are made of several authored submeshes. Casting each
      // one into the spotlight shadow map doubles their draw work and stalls
      // badly when rapid input overlaps six attacks. PBR scene lighting still
      // gives them shape; static face/dummy shadows remain enabled.
      if (o instanceof THREE.Mesh) o.castShadow = false;
    });
    this.scene.add(group);
    group.userData.disposeOnRemove = !authored;
    group.userData.baseScale = baseScale;
    this.projectiles.set(id, group);
  }

  /**
   * Position a projectile along its flight. (x, y) is the engine's 2D path
   * point; depth, arc and tumble are added here per kind.
   */
  moveProjectile(
    id: number,
    kind: AttackKind,
    x: number,
    y: number,
    angle: number,
    travel: number,
    t: number,
    contactAt: number,
  ) {
    const group = this.projectiles.get(id);
    if (!group) return;
    const r = this.headRadius;
    const approach = Math.min(1, Math.max(0, travel));
    const followThrough = Math.max(0, travel - 1);
    let z = 0;
    let py = y;
    let meleeRay: THREE.Ray | null = null;
    let meleeSurfaceZ: number | null = null;
    if (kind === "punch" || kind === "slap" || kind === "mallet") {
      meleeRay = this.rayAtScreenPoint(x, py);
      const dx = (this.wx(x) - this.headGroup.position.x) / Math.max(r * 0.88, 1);
      const dy = (this.wy(py) - this.headGroup.position.y) / Math.max(r * 1.08, 1);
      const radial = THREE.MathUtils.clamp(dx * dx + dy * dy, 0, 1);
      meleeSurfaceZ = r * (0.8 - radial * 0.34);
    }
    if (kind === "tomato" || kind === "egg") {
      z = r * 0.2 + (1 - approach) * 750 - followThrough * r * 0.7;
      py = y - Math.sin(approach * Math.PI) * r * 0.5;
      group.rotation.x = t * 9;
      group.rotation.z = t * 7;
      const splat = THREE.MathUtils.clamp((t - contactAt) / (1 - contactAt), 0, 1);
      const baseScale = Number(group.userData.baseScale) || 1;
      group.scale.setScalar(baseScale * (1 - splat * 0.62));
      group.visible = splat < 0.88;
    } else if (kind === "mallet") {
      // Keep the striking head in front of the landmark surface at contact;
      // otherwise the handle disappears behind the textured face.
      z = r * (0.26 + Math.sin(approach * Math.PI) * 0.28);
      const direction = Math.cos(angle) >= 0 ? 1 : -1;
      group.rotation.z =
        -angle -
        Math.PI / 2 +
        direction * (1 - approach) * 0.35 -
        direction * followThrough * 0.15;
    } else if (kind === "slap") {
      z = (meleeSurfaceZ ?? r * 0.34) + r * (0.13 + Math.sin(approach * Math.PI) * 0.3);
      const baseScale = Number(group.userData.baseScale) || 1;
      const direction = Math.cos(angle) >= 0 ? 1 : -1;
      const contactProgress = THREE.MathUtils.clamp(
        (t - contactAt) / Math.max(1 - contactAt, 0.001),
        0,
        1,
      );
      const palmCompression =
        approach > 0.96 ? 0.06 * (1 - THREE.MathUtils.smoothstep(contactProgress, 0.28, 0.62)) : 0;
      // Mirror a right-to-left slap instead of rotating the palm upside down.
      // The shallow tilt keeps the broad palm facing the camera through contact.
      group.scale.set(
        baseScale * direction * (1 + palmCompression),
        baseScale * (1 - palmCompression),
        baseScale,
      );
      group.rotation.x = -0.04;
      group.rotation.y = direction * 0.035;
      group.rotation.z = direction * (-0.16 + approach * 0.28);
    } else {
      z = (meleeSurfaceZ ?? r * 0.34) + r * (0.17 + Math.sin(approach * Math.PI) * 0.34);
      const baseScale = Number(group.userData.baseScale) || 1;
      const direction = Math.cos(angle) >= 0 ? 1 : -1;
      const contactProgress = THREE.MathUtils.clamp(
        (t - contactAt) / Math.max(1 - contactAt, 0.001),
        0,
        1,
      );
      const compression =
        approach > 0.96 ? 0.08 * (1 - THREE.MathUtils.smoothstep(contactProgress, 0.3, 0.64)) : 0;
      group.scale.set(
        baseScale * direction * (1 + compression * 0.45),
        baseScale * (1 - compression),
        baseScale,
      );
      group.rotation.x = -0.035;
      // Keep the camera-facing glove upright; direction comes from its path,
      // not from turning the glove edge-on.
      group.rotation.z = direction * (-0.06 + approach * 0.1);
      group.rotation.y = 0.035 * Math.sin(approach * Math.PI);
    }
    if (meleeRay) {
      const distance = (z - meleeRay.origin.z) / meleeRay.direction.z;
      this.projectileWorldPoint
        .copy(meleeRay.direction)
        .multiplyScalar(distance)
        .add(meleeRay.origin);
      group.position.copy(this.projectileWorldPoint);
    } else {
      group.position.set(this.wx(x), this.wy(py), z);
    }
  }

  removeProjectile(id: number) {
    const group = this.projectiles.get(id);
    if (!group) return;
    this.scene.remove(group);
    if (group.userData.disposeOnRemove) disposeGroup(group);
    this.projectiles.delete(id);
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
    for (const id of [...this.projectiles.keys()]) this.removeProjectile(id);
    this.reset();
    this.faceMesh.geometry.dispose();
    (this.faceMesh.material as THREE.Material).dispose();
    disposeObject(this.faceUnderlay);
    disposeObject(this.headShell);
    disposeObject(this.edgeSkirt);
    this.texture.dispose();
    disposeObject(this.neck);
    disposeObject(this.floor);
    disposeObject(this.wall);
    if (!this.torso.userData.sharedAsset) disposeObject(this.torso);
    this.environment.dispose();
    this.renderer.dispose();
  }
}

function buildEdgeSkirtGeometry(rest: Float32Array): THREE.BufferGeometry {
  const contour = FACE_OVAL.filter((index) => index * 3 + 2 < rest.length);
  const positions = new Float32Array(contour.length * 2 * 3);
  const indices: number[] = [];
  for (let i = 0; i < contour.length; i++) {
    const source = contour[i]!;
    const x = rest[source * 3] ?? 0;
    const y = rest[source * 3 + 1] ?? 0;
    const z = rest[source * 3 + 2] ?? 0;
    positions.set([x, y, z + 0.065], i * 3);
    positions.set([x * 0.88, y * 0.88, -0.08], (i + contour.length) * 3);
    const next = (i + 1) % contour.length;
    const back = i + contour.length;
    const nextBack = next + contour.length;
    indices.push(i, next, back, next, nextBack, back);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// ── weapon models (primitives only, no assets) ───────────────────────────────

const WEAPON_SCALE: Record<AttackKind, number> = {
  punch: 0.62,
  slap: 0.72,
  mallet: 0.64,
  tomato: 0.4,
  egg: 0.38,
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
      const geometry = new THREE.SphereGeometry(0.44, 24, 18);
      const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        const y = positions.getY(i);
        const taper = 1 - (y / 0.44) * 0.17;
        positions.setX(i, positions.getX(i) * taper);
        positions.setZ(i, positions.getZ(i) * taper);
        positions.setY(i, y * 1.35);
      }
      geometry.computeVertexNormals();
      const body = new THREE.Mesh(geometry, lam(0xeee5cf, 0.58));
      g.add(body);
      const speckleMaterial = lam(0x9b7752, 0.72);
      for (const [x, y, z, size] of [
        [-0.16, 0.16, 0.39, 0.018],
        [0.15, 0.27, 0.35, 0.014],
        [0.22, -0.12, 0.34, 0.017],
        [-0.1, -0.3, 0.38, 0.013],
      ] as const) {
        const speckle = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), speckleMaterial);
        speckle.position.set(x, y, z);
        speckle.scale.z = 0.25;
        g.add(speckle);
      }
      break;
    }
    case "punch": {
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), lam(0xb30f20));
      main.scale.set(0.86, 0.72, 0.48);
      main.position.y = -0.05;
      g.add(main);
      for (let i = 0; i < 4; i++) {
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), lam(0xc91527));
        knuckle.scale.z = 1.12;
        knuckle.position.set(-0.27 + i * 0.18, 0.36, 0.12);
        g.add(knuckle);
      }
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), lam(0xc22525));
      thumb.scale.y = 1.3;
      thumb.position.set(0.38, -0.1, 0.16);
      g.add(thumb);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.34, 16), lam(0x8c1a1a));
      cuff.position.y = -0.61;
      g.add(cuff);
      g.position.y = -0.38;
      break;
    }
    case "slap": {
      const skin = 0xe6b28c;
      const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.22, 5, 12), lam(skin));
      palm.scale.set(1.05, 1.2, 0.38);
      palm.position.y = -0.05;
      g.add(palm);
      for (let i = 0; i < 4; i++) {
        const lenY = [0.42, 0.54, 0.5, 0.38][i]!;
        const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, lenY, 4, 10), lam(skin));
        finger.position.set(-0.25 + i * 0.17, 0.34 + lenY / 2, 0);
        g.add(finger);
      }
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 3, 8), lam(skin));
      thumb.rotation.z = -0.8;
      thumb.position.set(0.42, -0.02, 0.02);
      g.add(thumb);
      const wrist = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.26, 4, 10), lam(skin));
      wrist.position.y = -0.55;
      g.add(wrist);
      g.position.y = 0.06;
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
  }
  return g;
}

function disposeObject(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}

const disposeGroup = disposeObject;

function sampleCanvasColor(
  canvas: HTMLCanvasElement,
  u: number,
  v: number,
  fallback: THREE.ColorRepresentation,
): THREE.Color {
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Color(fallback);
  const data = ctx.getImageData(
    Math.floor(THREE.MathUtils.clamp(u, 0, 1) * (canvas.width - 1)),
    Math.floor(THREE.MathUtils.clamp(v, 0, 1) * (canvas.height - 1)),
    1,
    1,
  ).data;
  if ((data[3] ?? 0) < 32) return new THREE.Color(fallback);
  return new THREE.Color(
    (data[0] ?? 128) / 255,
    (data[1] ?? 96) / 255,
    (data[2] ?? 80) / 255,
  );
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
