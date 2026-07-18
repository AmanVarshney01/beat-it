import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";

import type { AttackKind } from "../types";

const ARSENAL_URL = "/assets/models/arsenal.glb";
const DUMMY_URL = "/assets/models/dummy.glb";
const CAP_URL = "/assets/models/cap.glb";
const CAP_ROOT = "accessory_cap";

const WEAPON_ROOTS: Record<AttackKind, string> = {
  punch: "weapon_punch",
  slap: "weapon_slap",
  mallet: "weapon_mallet",
  tomato: "weapon_tomato",
  egg: "weapon_egg",
};

/** Move the authored contact/grip landmark onto the runtime attack origin. */
const WEAPON_PIVOT_OFFSETS: Record<AttackKind, [number, number, number]> = {
  punch: [0, -0.38, 0],
  slap: [0, 0.06, 0],
  mallet: [0, -0.7, 0],
  tomato: [0, 0, 0],
  egg: [0, 0, 0],
};

const weaponImages = new Map<AttackKind, HTMLImageElement>();
let loadPromise: Promise<void> | null = null;
let arsenal: GLTF | null = null;
let dummy: GLTF | null = null;
let cap: GLTF | null = null;

export function weaponImageUrl(kind: AttackKind) {
  return `/assets/weapons/${kind}.png`;
}

function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

function loadWeaponImage(kind: AttackKind): Promise<void> {
  const existing = weaponImages.get(kind);
  if (existing?.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const image = existing ?? new Image();
    weaponImages.set(kind, image);
    image.onload = () => resolve();
    // A missing thumbnail is non-fatal; the button retains its accessible label.
    image.onerror = () => resolve();
    image.src = weaponImageUrl(kind);
  });
}

/** Preload authored assets while MediaPipe is already preparing the face. */
export function preloadGameAssets(): Promise<void> {
  loadPromise ??= (async () => {
    const loader = new GLTFLoader();
    const kinds = Object.keys(WEAPON_ROOTS) as AttackKind[];
    const [loadedArsenal, loadedDummy, loadedCap] = await Promise.all([
      loadGltf(loader, ARSENAL_URL),
      loadGltf(loader, DUMMY_URL),
      loadGltf(loader, CAP_URL),
    ]);
    await Promise.all(kinds.map(loadWeaponImage));
    arsenal = loadedArsenal;
    dummy = loadedDummy;
    cap = loadedCap;
    for (const kind of kinds) {
      if (!arsenal.scene.getObjectByName(WEAPON_ROOTS[kind])) {
        throw new Error(`Authored ${kind} root is missing from arsenal.glb`);
      }
    }
    if (!dummy.scene.getObjectByName("dummy")) {
      throw new Error("Authored dummy root is missing from dummy.glb");
    }
    const capRoot = cap.scene.getObjectByName(CAP_ROOT);
    if (!capRoot) {
      throw new Error("Authored cap root is missing from cap.glb");
    }
    for (const requiredPart of [
      "cap_crown",
      "cap_front_panel",
      "cap_brim",
      "cap_button",
      "cap_label",
    ]) {
      if (!capRoot.getObjectByName(requiredPart)) {
        throw new Error(`Authored ${requiredPart} is missing from cap.glb`);
      }
    }
    for (const scene of [arsenal.scene, dummy.scene, cap.scene]) {
      scene.updateMatrixWorld(true);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
        }
      });
    }
  })();
  return loadPromise;
}

function cloneRoot(
  source: THREE.Object3D | undefined,
  offset: [number, number, number] = [0, 0, 0],
): THREE.Group {
  if (!source) {
    throw new Error("Authored 3D assets must be preloaded before starting the game");
  }
  const clone = source.clone(true);
  clone.position.set(...offset);
  const group = new THREE.Group();
  group.add(clone);
  group.userData.sharedAsset = true;
  return group;
}

export function instantiateWeapon(kind: AttackKind): THREE.Group {
  return cloneRoot(
    arsenal?.scene.getObjectByName(WEAPON_ROOTS[kind]),
    WEAPON_PIVOT_OFFSETS[kind],
  );
}

export function instantiateDummy(): THREE.Group {
  return cloneRoot(dummy?.scene.getObjectByName("dummy"));
}

export function instantiateCap(): THREE.Group {
  return cloneRoot(cap?.scene.getObjectByName(CAP_ROOT));
}
