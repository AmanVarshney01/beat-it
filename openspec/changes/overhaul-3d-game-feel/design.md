## Context

The current scene proves the interaction loop but not the intended finish. Browser review with the bundled demo face showed four connected problems:

- the face is a raw, open MediaPipe landmark sheet with `z` multiplied by a single exaggeration constant;
- the room, torso, neck, and weapons are runtime primitives using flat Lambert materials;
- every attack advances through one normalized timer and contacts at `t = 0.5`;
- the effects systems independently reconstruct an approximate impact position;

The result is uncanny rather than deliberately stylized: objects have no shared scale or material language, attacks lack weight, contacts slide, and residue does not appear to come from the thing that hit the face.

The game must remain fully client-side, validate arbitrary uploaded faces before entering play, use one authored 3D renderer, support rapid input, run on mobile browsers, and stay in a non-gory slapstick register. “Realistic” therefore means physically coherent shape, light, weight, contact, and follow-through—not photorealistic injury.

## Goals / Non-Goals

**Goals:**

- Make the face, dummy, room, weapons, and effects look like one authored game.
- Give every weapon an unmistakable silhouette, material, scale, grip/orientation, and motion signature.
- Resolve one 3D contact record and use it for physics, deformation, residue, particles, sound, and camera response.
- Make direct punch, slap, and mallet attacks originate from the same side of the face the player targets.
- Establish deterministic visual-review scenes and explicit desktop/mobile frame budgets.
- Split the current monolithic scene/engine responsibilities enough to test attack timing and simulation without a live browser.

**Non-Goals:**

- Photorealistic skin, cuts, open wounds, burns, or gore.
- Full-body ragdoll physics, destructible environments, multiplayer, or a backend.
- Replacing MediaPipe or inventing gameplay for an invalid face reconstruction.
- Requiring Blender at application runtime. Blender is an offline authoring/build tool only.

## Decisions

### 1. Target “stylized physical” realism

The art direction will use slightly exaggerated proportions and readable comic timing, but surfaces, shadows, inertia, contact, and gravity must remain internally consistent. This avoids the uncanny mix of a photographic face and toy-placeholder geometry.

Alternative considered: pursue photoreal rendering. Rejected because arbitrary source photos, no calibrated camera/lighting, and the slapstick premise make photorealism both fragile and tonally wrong.

### 2. Author reusable assets in Blender and export glTF

An idempotent Blender Python build script will create or update:

- one optimized `arsenal.glb` containing named roots for punch, slap, mallet, tomato, and egg;
- one `dummy.glb` containing the torso/shoulder/base presentation;
- transparent picker/cursor thumbnails rendered from the same weapon assets.

All assets will use meter-like canonical units, +Y up, forward axes documented per weapon, applied transforms, stable origins at the grip or center of mass, bevelled silhouettes, smooth/custom normals, and Principled BSDF materials. Exported meshes will be modest enough for mobile and will share materials where sensible. Three.js `GLTFLoader` will load and cache the files once; attack instances clone scene nodes without disposing shared geometry. Missing or invalid authored assets prevent the game scene from starting and return the player to upload with a clear error.

Alternative considered: continue improving runtime primitives. Rejected because the current approach makes bevels, topology, normals, pivots, proportions, and consistent art direction unnecessarily difficult and has already produced placeholder-looking results.

### 3. Separate orchestration from render systems

`PunchGame` remains the public imperative game facade but delegates to focused modules:

- `AttackController`: data-driven attack timelines and active instances;
- `ContactResolver`: screen/head-local targeting and resolved surface contact;
- `Scene3D`: renderer, camera, environment, and system composition;
- `HeadRig`: head geometry, material, deformation, raycast target, and neck anchor;
- `WeaponSystem`: cached GLB assets, instances, transforms, and pooling;
- `FeedbackCoordinator`: physics impulse, camera impulse, particles, sound, and residue;
- `RenderQualityManager`: DPR, shadow/particle budgets, and frame monitoring.

The engine and render systems communicate through typed records instead of reconstructing coordinates independently.

### 4. Use one canonical head-local coordinate system

Landmarks will be normalized from stable eye, nose, cheek, forehead, and chin anchors instead of directly subtracting `0.5`. Raw depth will be median-centered, clamped, smoothed, and scaled relative to inter-eye distance. The front landmark surface will sit in a shallow proxy head shell with an edge skirt so the silhouette reads as a volume and the neck does not terminate against a paper mask.

The photographed face remains the front texture. A clean sampled-color shell, a subdued hair cap, and an adaptive skin-toned neck provide a coherent silhouette without adding separate ear geometry or claiming photorealistic reconstruction. Boundary vertices are stiffer than cheeks and jaw. Local deformation acts along the surface normal plus a smaller tangential component, with capped displacement and volume-preserving surrounding bulge.

Alternative considered: generate a full head from the photo. Rejected because a single image and the existing model do not provide reliable back-of-head, ear, or hair geometry.

### 5. Resolve contact once and preserve it through the hit

At attack launch, a direct pointer target is raycast against the current face mesh and stored in head-local form. Programmatic attacks choose a valid local point from a bounded face region. During the approach, the contact target follows the moving head. At the contact phase, the system produces:

```ts
interface ContactEvent {
  attackId: number;
  attack: AttackKind;
  worldPoint: THREE.Vector3;
  localPoint: THREE.Vector3;
  worldNormal: THREE.Vector3;
  uv: THREE.Vector2;
  impulse2D: { x: number; y: number };
  strength: number;
  occurredAt: number;
}
```

Physics, denting, splats, particles, camera motion, and sound consume this exact event. The visible face raycast is the only playable contact source.

### 6. Replace the shared timer with weapon-specific phase timelines

Each `AttackDefinition` specifies anticipation, approach, contact, follow-through, and recovery durations; position/orientation curves; held pose; contact radius; impulse; camera response; deformation; sound; particle family; and residue behavior.

Melee attacks preserve contact for several frames so they compress and push rather than teleport through the head. Thrown food visibly breaks or splats at contact and keeps fragments/residue for a short follow-through. The mallet uses a weighted diagonal swing and the slap uses a palm-led lateral arc. Rapid input remains supported by pooling and a bounded active-attack count.

Alternative considered: add more branches to the existing normalized `t` loop. Rejected because it cannot express different contact dwell, follow-through, or moving-target behavior without becoming another monolith.

### 7. Preserve direct-target side and camera-facing silhouettes

For punch, slap, and mallet, the target’s horizontal position relative to the moving head selects the entry side. A left-half target begins left of the head and a right-half target begins right of the head. Punch and slap remain camera-facing and mirror handedness rather than rotating edge-on. The mallet begins above and outside the selected side, aligns its handle behind the incoming vector, and follows through past contact.

Alternative considered: derive entry from a radial vector through the head center. Rejected because upper/lower target offsets make the hand appear to enter diagonally or vertically even when the player clearly chose the left or right side.

### 8. Use a physically coherent render pipeline

The renderer will use sRGB output, ACES filmic tone mapping, capped device pixel ratio, and `MeshStandardMaterial`/`MeshPhysicalMaterial`. A generated room environment supplies soft reflections; key, fill, and rim lights define form; one budgeted shadow-casting key plus contact shadowing grounds the character. Camera shake becomes a damped positional/rotational impulse with band-limited noise rather than independent random offsets every frame.

The camera rig maintains a stable head/torso composition across aspect ratios and reserves HUD safe areas. Weapon scale comes from canonical asset bounds and desired screen coverage, not one scalar multiplied by head radius.

### 9. Add deterministic review and performance gates

A development-only review mode will accept a fixed seed, attack kind, target, timeline phase/frame, viewport, and quality tier. It will allow repeatable screenshots for rest, anticipation, contact, follow-through, residue, and reset states. Unit tests cover timeline phase transitions, side-aware contact mapping, resource cleanup, and deterministic seeding. Browser checks cover all weapons, resize, rapid input, reset, and invalid-start handling.

Reference budgets:

- desktop 1440×900: median frame time at or below 16.7 ms during a ten-hit sequence;
- mid-tier mobile-equivalent 390×844 at DPR 1.25: median at or below 25 ms and no sustained frame above 50 ms;
- no unbounded growth in scene nodes, geometries, materials, textures, attacks, or particles after repeated hit/reset cycles.

## Risks / Trade-offs

- [Blender output becomes an opaque binary artifact] → keep the complete deterministic Blender build script, object/material naming contract, and generated-asset manifest in version control.
- [GLB loading delays the first attack] → preload during face detection and enter play only after every required authored root is validated.
- [A proxy shell mismatches unusual faces] → derive conservative dimensions from robust landmark anchors, keep the shell visually subordinate, and reject unusable reconstructions before play.
- [PBR and shadows regress low-end devices] → cap DPR, pool instances, monitor moving frame time, and lower shadow/particle counts through quality tiers.
- [A full rewrite breaks the working interaction loop] → migrate behind a local renderer switch and land systems in vertical slices with deterministic comparison scenes.
- [More realism makes violence feel harsher] → keep exaggerated timing, toy-like weapons, bright food residue, small optional surface-only blood spatter, and the existing prohibition on cuts, open wounds, and gore.

## Migration Plan

1. Add deterministic review mode and capture current baselines.
2. Add typed attack/contact records and adapters while keeping current visuals.
3. Introduce the Blender build pipeline, asset loader, and required authored weapon/dummy assets.
4. Introduce the camera, lighting, material, and quality pipeline.
5. Replace the head construction with normalized depth, shell/skirt, surface raycast, and bounded deformation.
6. Move each weapon to a phase timeline one at a time, starting with punch, mallet, and tomato.
7. Make direct melee entry side-aware and keep hand silhouettes camera-facing.
8. Route all feedback through resolved 3D contact, then verify rapid input, reset, resize, and invalid-start handling.
9. Remove the legacy 2D renderer and all procedural weapon/runtime builders after visual/performance gates pass.

The cutover is direct: there is one production Three.js renderer and no `renderer=legacy` or 2D gameplay path.

## Open Questions

- Final asset style can be tuned after the first Blender turntable, but the default is premium toy/stylized physical rather than photoreal.
- The exact mid-tier mobile reference device must be selected before final performance sign-off; the initial emulator budget above is the implementation gate.
- If the proxy shell performs poorly on strongly rotated or occluded faces, those inputs will return to upload rather than forcing a broken presentation.
