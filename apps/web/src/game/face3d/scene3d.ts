import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import type { RenderQualityProfile } from "../quality";
import type { AttackKind, GameBackground, Landmark3 } from "../types";
import { instantiateCap, instantiateDummy, instantiateWeapon } from "./assets";
import { BACKGROUND_PALETTES, paintStageBackdrop } from "./backgrounds";
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
  private backgroundCanvas: HTMLCanvasElement;
  private backgroundTexture: THREE.CanvasTexture;
  private backgroundKind: GameBackground | null = null;

  private headGroup = new THREE.Group();
  private faceMesh: THREE.Mesh;
  private faceUnderlay: THREE.Mesh;
  private headShell: THREE.Mesh;
  private hairCap: THREE.Mesh;
  private capAccessory: THREE.Group;
  private capOwnedMaterials = new Set<THREE.Material>();
  private capLabelCanvas: HTMLCanvasElement;
  private capLabelTexture: THREE.CanvasTexture;
  private capLabelMaterial: THREE.MeshStandardMaterial;
  private capColor = "#c92f35";
  private capText = "";
  private edgeSkirt: THREE.Mesh;
  private texture: THREE.CanvasTexture;
  private torso: THREE.Object3D;
  private neck: THREE.Mesh;
  private floor: THREE.Mesh;
  private wall: THREE.Mesh;
  private hemisphere: THREE.HemisphereLight;
  private fill: THREE.DirectionalLight;
  private rim: THREE.DirectionalLight;
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
  private sourceDpr = 1;
  private dprCap = 1.75;
  private foodFragmentCount = 9;

  private projectiles = new Map<number, THREE.Group>();
  private projectilePool = new Map<AttackKind, THREE.Group[]>();
  private projectileRaycaster = new THREE.Raycaster();
  private projectilePointer = new THREE.Vector2();
  private projectileWorldPoint = new THREE.Vector3();
  private foodFragmentGeometry = new THREE.TetrahedronGeometry(0.105, 0);
  private foodFragmentMaterials = {
    tomato: [
      pbr(0xd73824, 0.74),
      pbr(0xb7201b, 0.78),
      pbr(0x477b2e, 0.8),
    ],
    egg: [
      pbr(0xf1ead8, 0.8),
      pbr(0xd8cfbb, 0.84),
      pbr(0xf2b82f, 0.68),
    ],
  } as const;
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

    this.hemisphere = new THREE.HemisphereLight(0x9fb8d8, 0x170d14, 0.4);
    this.scene.add(this.hemisphere);
    this.fill = new THREE.DirectionalLight(0xbfd8ff, 0.68);
    this.fill.position.set(1.5, 1.2, 2.5);
    this.scene.add(this.fill);
    this.rim = new THREE.DirectionalLight(0xff6558, 0.9);
    this.rim.position.set(2, 1.5, -2);
    this.scene.add(this.rim);
    this.spot = new THREE.SpotLight(0xffe2c5, 3.2, 0, 0.72, 0.72, 0.42);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.00015;
    this.spot.shadow.normalBias = 0.025;
    this.spot.shadow.camera.far = 6000;
    this.scene.add(this.spot);
    this.scene.add(this.spot.target);

    // the room
    this.backgroundCanvas = document.createElement("canvas");
    this.backgroundCanvas.width = 1200;
    this.backgroundCanvas.height = 640;
    const backgroundContext = this.backgroundCanvas.getContext("2d");
    if (!backgroundContext) throw new Error("Canvas 2D not supported");
    paintStageBackdrop(
      backgroundContext,
      this.backgroundCanvas.width,
      this.backgroundCanvas.height,
      "gym",
    );
    this.backgroundTexture = new THREE.CanvasTexture(this.backgroundCanvas);
    this.backgroundTexture.colorSpace = THREE.SRGBColorSpace;
    this.backgroundTexture.anisotropy = Math.min(
      4,
      this.renderer.capabilities.getMaxAnisotropy(),
    );

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(9000, 6000), pbr(0x302b35, 0.72));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
    this.wall = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 3200),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.backgroundTexture,
        emissive: 0xffffff,
        emissiveMap: this.backgroundTexture,
        emissiveIntensity: 0.28,
        roughness: 0.94,
        metalness: 0,
      }),
    );
    this.wall.position.z = -1100;
    this.wall.receiveShadow = true;
    this.scene.add(this.wall);
    this.setBackground("gym");

    // the dummy
    this.torso = instantiateDummy();
    this.torso.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    this.scene.add(this.torso);
    const sampledSkinColor = sampleCanvasColor(face, 0.3, 0.55, neckColor);
    this.neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.96, 1, 28, 1, false),
      new THREE.MeshPhysicalMaterial({
        color: sampledSkinColor,
        roughness: 0.72,
        metalness: 0,
        sheen: 0.04,
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
      new THREE.SphereGeometry(0.35, 42, 32),
      new THREE.MeshPhysicalMaterial({
        color: skinColor,
        roughness: 0.78,
        sheen: 0.08,
        envMapIntensity: 0.24,
      }),
    );
    this.headShell.scale.set(0.92, 1.02, 0.76);
    // Keep every proxy surface behind the deepest landmark. The former shell
    // intersected recessed cheek/mouth triangles and showed up as hard patches
    // across the photographed face.
    this.headShell.position.set(0, 0.005, -0.27);
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
    this.faceUnderlay.scale.set(0.87, 1, 0.62);
    this.faceUnderlay.position.z = -0.22;
    this.faceUnderlay.castShadow = true;

    this.hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.355,
        36,
        22,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.57,
      ),
      new THREE.MeshStandardMaterial({
        color: headBackColor,
        roughness: 0.86,
        envMapIntensity: 0.18,
      }),
    );
    this.hairCap.scale.set(0.94, 1.04, 0.79);
    this.hairCap.position.set(0, 0.02, -0.29);
    this.hairCap.castShadow = true;
    this.hairCap.receiveShadow = true;

    this.capLabelCanvas = document.createElement("canvas");
    this.capLabelCanvas.width = 512;
    this.capLabelCanvas.height = 192;
    this.capLabelTexture = new THREE.CanvasTexture(this.capLabelCanvas);
    // glTF UV convention (top-left origin) matches the canvas directly
    this.capLabelTexture.flipY = false;
    this.capLabelTexture.colorSpace = THREE.SRGBColorSpace;
    this.capLabelTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.capLabelTexture.magFilter = THREE.LinearFilter;
    this.capLabelMaterial = new THREE.MeshStandardMaterial({
      map: this.capLabelTexture,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.76,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // Blender-authored cap (modeled to this head-local frame: crown r 0.4,
    // rim past the brow). Procedural fallback if the asset didn't load.
    const authoredCap = instantiateCap();
    this.capAccessory = authoredCap.children.length > 0 ? authoredCap : buildProceduralCap();
    this.capAccessory.name = "player_cap";
    this.capAccessory.position.set(0, 0.15, -0.2);
    this.capAccessory.rotation.z = -0.045;
    this.capAccessory.visible = false;
    this.capAccessory.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object.name === "cap_label") {
        object.material = this.capLabelMaterial;
        object.castShadow = false;
        object.renderOrder = 6;
        return;
      }
      const sourceMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const clonedMaterials = sourceMaterials.map((source) => {
        const clone = source.clone();
        this.capOwnedMaterials.add(clone);
        return clone;
      });
      object.material = Array.isArray(object.material)
        ? clonedMaterials
        : clonedMaterials[0]!;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.paintCapLabel();

    this.edgeSkirt = new THREE.Mesh(
      buildEdgeSkirtGeometry(this.rest),
      new THREE.MeshStandardMaterial({
        color: skinColor,
        roughness: 0.72,
        side: THREE.DoubleSide,
        envMapIntensity: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    this.edgeSkirt.castShadow = true;
    this.edgeSkirt.visible = true;
    this.headGroup.add(
      this.headShell,
      this.hairCap,
      this.capAccessory,
      this.faceUnderlay,
      this.edgeSkirt,
      this.faceMesh,
    );
    this.scene.add(this.headGroup);
    this.softness = buildVertexSoftness(landmarks);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = cssW;
    this.cssH = cssH;
    this.sourceDpr = dpr;
    this.renderer.setPixelRatio(Math.min(dpr, this.dprCap));
    this.renderer.setSize(cssW, cssH, false);
    this.camera.aspect = cssW / cssH;
    // camera distance such that 1 world unit == 1 css pixel at z = 0
    this.cameraDist = cssH / 2 / Math.tan((this.camera.fov * Math.PI) / 360);
    this.camera.position.set(0, 0, this.cameraDist);
    this.camera.updateProjectionMatrix();

    // Fit the 15:8 set wall like background-size: cover at its actual depth.
    // This reveals the authored environment instead of showing a tiny crop of
    // its quiet center, while still covering portrait and ultrawide screens.
    const depthScale = (this.cameraDist + 1100) / this.cameraDist;
    const wallScale =
      Math.max((cssW * depthScale) / 6000, (cssH * depthScale) / 3200) * 1.025;
    this.wall.scale.set(wallScale, wallScale, 1);
  }

  setQuality(profile: RenderQualityProfile) {
    const shadowSizeChanged = this.spot.shadow.mapSize.width !== profile.shadowSize;
    this.dprCap = profile.dprCap;
    this.foodFragmentCount = profile.foodFragmentCount;
    this.spot.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
    if (shadowSizeChanged && this.spot.shadow.map) {
      this.spot.shadow.map.dispose();
      this.spot.shadow.map = null;
      this.renderer.shadowMap.needsUpdate = true;
    }
    this.renderer.setPixelRatio(Math.min(this.sourceDpr, this.dprCap));
    this.renderer.setSize(this.cssW, this.cssH, false);
  }

  /** Swap the full environment without adding any per-frame scene work. */
  setBackground(background: GameBackground) {
    if (this.backgroundKind === background) return;
    this.backgroundKind = background;

    const context = this.backgroundCanvas.getContext("2d");
    if (context) {
      paintStageBackdrop(
        context,
        this.backgroundCanvas.width,
        this.backgroundCanvas.height,
        background,
      );
      this.backgroundTexture.needsUpdate = true;
    }

    const palette = BACKGROUND_PALETTES[background];
    this.renderer.setClearColor(palette.clear, 1);
    const floorMaterial = this.floor.material as THREE.MeshStandardMaterial;
    floorMaterial.color.set(palette.floor);
    this.hemisphere.color.set(palette.hemisphereSky);
    this.hemisphere.groundColor.set(palette.hemisphereGround);
    this.hemisphere.intensity = palette.hemisphereIntensity;
    this.fill.color.set(palette.fill);
    this.fill.intensity = palette.fillIntensity;
    this.rim.color.set(palette.rim);
    this.rim.intensity = palette.rimIntensity;
    this.spot.color.set(palette.spot);
    this.spot.intensity = palette.spotIntensity;
  }

  setCap(enabled: boolean, color: string, text: string) {
    this.capAccessory.visible = enabled;
    const normalizedColor = /^#[0-9a-f]{6}$/i.test(color)
      ? color.toLowerCase()
      : "#c92f35";
    const normalizedText = text
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 12);
    if (normalizedColor === this.capColor && normalizedText === this.capText) return;

    this.capColor = normalizedColor;
    this.capText = normalizedText;
    for (const material of this.capOwnedMaterials) {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.color.set(normalizedColor);
        material.needsUpdate = true;
      }
    }
    this.paintCapLabel();
  }

  private paintCapLabel() {
    const context = this.capLabelCanvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D not supported");
    const width = this.capLabelCanvas.width;
    const height = this.capLabelCanvas.height;
    context.clearRect(0, 0, width, height);
    if (!this.capText) {
      this.capLabelTexture.needsUpdate = true;
      return;
    }

    const textColor = readableTextColor(this.capColor);
    const outlineColor = textColor === "#fff7e6" ? "#17110f" : "#fff7e6";
    let fontSize = 94;
    context.textAlign = "center";
    context.textBaseline = "middle";
    do {
      context.font = `400 ${fontSize}px "Bungee", "Arial Black", sans-serif`;
      fontSize -= 2;
    } while (fontSize > 42 && context.measureText(this.capText).width > width * 0.84);
    context.lineJoin = "round";
    context.lineWidth = Math.max(7, fontSize * 0.1);
    context.strokeStyle = outlineColor;
    context.fillStyle = textColor;
    context.strokeText(this.capText.toUpperCase(), width / 2, height / 2 + 5);
    context.fillText(this.capText.toUpperCase(), width / 2, height / 2 + 5);
    this.capLabelTexture.needsUpdate = true;
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
    this.torso.scale.setScalar(r * 0.92);
    this.torso.position.set(this.wx(mount.x), this.wy(torsoTop) - r * 1.4, -r * 0.18);
    this.floor.position.y = this.wy(floorY);
    this.wall.position.y = 0;
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
    const pool = this.projectilePool.get(kind) ?? [];
    this.projectilePool.set(kind, pool);
    const group = pool.pop() ?? this.createProjectile(kind);
    const baseScale = this.headRadius * WEAPON_SCALE[kind];
    const model = group.userData.model as THREE.Group;
    group.scale.setScalar(baseScale);
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    group.visible = true;
    model.visible = true;
    const fragments = (group.userData.fragments as THREE.Mesh[] | undefined) ?? [];
    for (const fragment of fragments) {
      fragment.visible = false;
      fragment.position.set(0, 0, 0);
      fragment.rotation.set(0, 0, 0);
      fragment.scale.setScalar(1);
    }
    this.scene.add(group);
    group.userData.baseScale = baseScale;
    this.projectiles.set(id, group);
  }

  private createProjectile(kind: AttackKind) {
    const group = new THREE.Group();
    const model = instantiateWeapon(kind);
    group.add(model);
    group.userData.kind = kind;
    group.userData.model = model;

    if (kind === "tomato" || kind === "egg") {
      const fragments: THREE.Mesh[] = [];
      const materials = this.foodFragmentMaterials[kind];
      for (let i = 0; i < 9; i++) {
        const material =
          kind === "tomato"
            ? materials[i === 0 ? 2 : i % 2]
            : materials[i % 4 === 0 ? 2 : i % 2];
        const fragment = new THREE.Mesh(this.foodFragmentGeometry, material);
        const angle = (i / 9) * Math.PI * 2 + (i % 2) * 0.21;
        fragment.userData.direction = [
          Math.cos(angle) * (0.72 + (i % 3) * 0.15),
          Math.sin(angle) * (0.68 + ((i + 1) % 3) * 0.13) + 0.25,
          0.35 + (i % 4) * 0.15,
        ];
        fragment.userData.spin = [
          2.5 + i * 0.31,
          3.4 + i * 0.23,
          4.1 + i * 0.27,
        ];
        fragment.visible = false;
        fragments.push(fragment);
        group.add(fragment);
      }
      group.userData.fragments = fragments;
    }

    group.traverse((object) => {
      // Static face/dummy shadows carry the scene. Disabling fast projectile
      // shadows avoids a second full draw pass when attacks overlap.
      if (object instanceof THREE.Mesh) object.castShadow = false;
    });
    return group;
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
    contactStart: number,
    contactEnd: number,
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
      z = r * 0.2 + (1 - approach) * 750;
      py = y - Math.sin(approach * Math.PI) * r * 0.5;
      const model = group.userData.model as THREE.Group;
      const fragments = (group.userData.fragments as THREE.Mesh[] | undefined) ?? [];
      const burst = THREE.MathUtils.clamp(
        (t - contactStart) / Math.max(1 - contactStart, 0.001),
        0,
        1,
      );
      model.visible = t < contactStart;
      group.rotation.set(
        model.visible ? t * 9 : 0,
        model.visible ? t * 3.5 : 0,
        model.visible ? t * 7 : 0,
      );
      const fragmentScale = Math.max(
        0,
        1 - THREE.MathUtils.smoothstep(burst, 0.7, 1),
      );
      for (let i = 0; i < fragments.length; i++) {
        const fragment = fragments[i]!;
        fragment.visible =
          burst > 0 && i < this.foodFragmentCount && fragmentScale > 0.03;
        if (!fragment.visible) continue;
        const [dx, dy, dz] = fragment.userData.direction as [
          number,
          number,
          number,
        ];
        const [rx, ry, rz] = fragment.userData.spin as [
          number,
          number,
          number,
        ];
        const distance = easeOutCubic(burst) * 3.6;
        fragment.position.set(
          dx * distance,
          dy * distance - burst * burst * 2.1,
          dz * distance,
        );
        fragment.rotation.set(rx * burst, ry * burst, rz * burst);
        fragment.scale.setScalar(fragmentScale);
      }
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
        (t - contactStart) / Math.max(contactEnd - contactStart, 0.001),
        0,
        1,
      );
      const palmCompression =
        t >= contactStart && t <= contactEnd
          ? 0.055 * Math.sin(contactProgress * Math.PI)
          : 0;
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
        (t - contactStart) / Math.max(contactEnd - contactStart, 0.001),
        0,
        1,
      );
      const compression =
        t >= contactStart && t <= contactEnd
          ? 0.075 * Math.sin(contactProgress * Math.PI)
          : 0;
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
    this.projectiles.delete(id);
    group.visible = false;
    const kind = group.userData.kind as AttackKind;
    const pool = this.projectilePool.get(kind) ?? [];
    this.projectilePool.set(kind, pool);
    if (pool.length < 6) pool.push(group);
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
    disposeObject(this.hairCap);
    disposeObject(this.edgeSkirt);
    for (const material of this.capOwnedMaterials) material.dispose();
    this.capOwnedMaterials.clear();
    this.capLabelMaterial.dispose();
    this.capLabelTexture.dispose();
    this.texture.dispose();
    disposeObject(this.neck);
    disposeObject(this.floor);
    disposeObject(this.wall);
    this.backgroundTexture.dispose();
    this.foodFragmentGeometry.dispose();
    for (const materials of Object.values(this.foodFragmentMaterials)) {
      for (const material of materials) material.dispose();
    }
    this.projectilePool.clear();
    this.environment.dispose();
    this.renderer.dispose();
  }

  getPerformanceStats() {
    let pooledProjectiles = 0;
    for (const pool of this.projectilePool.values()) {
      pooledProjectiles += pool.length;
    }
    return {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      activeProjectiles: this.projectiles.size,
      pooledProjectiles,
    };
  }
}

/**
 * A fitted baseball cap built from primitives: dome crown snug over the hair,
 * curved-down visor wedge, top button, and a front label plane. Part names
 * (cap_crown / cap_brim / cap_button / cap_label) match the colorable/label
 * machinery that previously drove the authored model.
 */
function buildProceduralCap(): THREE.Group {
  const group = new THREE.Group();
  const shell = pbr(0xc92f35, 0.82);

  // Shallow dome, cut just past the brow line (θ ≈ 1.10 rad). The group sits
  // forward of the skull center so the front rim clears the bangs.
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 40, 26, 0, Math.PI * 2, 0, 1.1),
    shell,
  );
  crown.name = "cap_crown";
  crown.scale.set(1.02, 0.95, 0.9);
  group.add(crown);

  const rimY = 0.4 * 0.95 * Math.cos(1.1); // ≈ 0.17
  const rimR = 0.4 * Math.sin(1.1); // ≈ 0.356

  // sweatband rim: a thin torus at the crown's lower edge grounds the cap
  const band = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.021, 10, 44), shell);
  band.name = "cap_button"; // colorable like the rest of the shell
  band.rotation.x = Math.PI / 2;
  band.scale.set(1.04, 0.9, 1);
  band.position.y = rimY;
  group.add(band);

  // visor: a solid pie-wedge cylinder pointing forward (+z), tilted down
  const visor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.03, 36, 1, false, -0.62, 1.24),
    shell,
  );
  visor.name = "cap_brim";
  visor.scale.set(1, 1, 1.12);
  // tucks under the sweatband and clears the bangs — no gap, no face-slicing
  visor.position.set(0, rimY + 0.02, 0.19);
  visor.rotation.x = 0.18;
  group.add(visor);

  const button = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), shell);
  button.name = "cap_button";
  button.position.set(0, 0.4 * 0.95 + 0.006, 0);
  group.add(button);

  // front panel label; the label material/texture is swapped in by Scene3D
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), shell);
  label.name = "cap_label";
  label.position.set(0, 0.27, 0.297);
  label.rotation.x = -0.42;
  label.scale.y = -1; // PlaneGeometry UVs are bottom-origin; texture is glTF-style
  group.add(label);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) object.castShadow = true;
  });
  return group;
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
    positions.set([x, y, z + 0.025], i * 3);
    positions.set([x * 0.94, y * 0.96, -0.045], (i + contour.length) * 3);
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

const WEAPON_SCALE: Record<AttackKind, number> = {
  punch: 0.62,
  slap: 0.72,
  mallet: 0.64,
  tomato: 0.4,
  egg: 0.38,
};

function disposeObject(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}

function sampleCanvasColor(
  canvas: HTMLCanvasElement,
  u: number,
  v: number,
  defaultColor: THREE.ColorRepresentation,
): THREE.Color {
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Color(defaultColor);
  const data = ctx.getImageData(
    Math.floor(THREE.MathUtils.clamp(u, 0, 1) * (canvas.width - 1)),
    Math.floor(THREE.MathUtils.clamp(v, 0, 1) * (canvas.height - 1)),
    1,
    1,
  ).data;
  if ((data[3] ?? 0) < 32) return new THREE.Color(defaultColor);
  return new THREE.Color(
    (data[0] ?? 128) / 255,
    (data[1] ?? 96) / 255,
    (data[2] ?? 80) / 255,
  ).convertSRGBToLinear();
}

function readableTextColor(hexColor: string) {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  return luminance < 155 ? "#fff7e6" : "#17110f";
}

// ── flesh softness ───────────────────────────────────────────────────────────

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

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
