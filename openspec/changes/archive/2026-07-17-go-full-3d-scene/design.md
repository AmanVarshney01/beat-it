# Design: go-full-3d-scene

## Context

The head is already a 3D mesh on a WebGL layer; torso/neck/projectiles/particles are 2D canvas drawings and emoji. This promotes the whole scene to Three.js while keeping matter.js as the motion source.

## Goals / Non-Goals

**Goals:** scene reads as a lit room with a physical dummy; projectiles have real depth (thrown from the viewer); no emoji anywhere; weapon cursor; noodles mess.

**Non-Goals:** replacing matter.js with a 3D physics engine (head motion stays in the screen plane); external 3D asset files (all models from primitives); changing the 2D fallback's warp pipeline.

## Decisions

1. **Scene3D subsumes Head3D.** One class owns renderer/camera/lights/room/torso/neck/face-mesh/projectiles/noodles. The engine keeps physics, input, timing, damage painting, sounds, and per-frame drives Scene3D (head transform, neck endpoints, projectile positions along the existing t-timeline). World units = CSS pixels at the z=0 plane (same camera math as before), so physics coordinates map 1:1.
2. **Room + shadows:** floor plane + back wall (Lambert, warm dark tones), ambient + directional fill + a spotlight that casts real shadows (head/torso cast, floor/wall receive). Screen shake becomes camera jitter.
3. **Weapons are primitive-built groups** (`buildWeaponMesh(kind)`): tomato = sphere + stem cone; egg = scaled sphere; pie = tin cylinder + cream blobs + cherry; chili = curved cone + stem; glove = sphere cluster + cuff; hand = palm box + finger capsules; mallet = wood cylinder head + handle; fish = scaled sphere + tail cone + fins; noodles = clump of TubeGeometry strands on wiggly CatmullRom curves.
4. **Projectile depth:** engine keeps the 2D (x, y) path and impact timing; Scene3D adds z(t) — food starts ~700px toward the viewer and closes to 0 at impact (flying "into" the screen), melee sweeps with a small z arc, mallet drops from above. Tumble/spin per kind.
5. **One icon pipeline:** a tiny shared offscreen WebGLRenderer renders each weapon model to a cached canvas → used for picker icons, the custom CSS cursor (32px, hotspot centered), and rotated drawImage sprites in the 2D fallback. Emoji fully retired; particles get procedural drawn shapes.
6. **Noodles = located mess:** on impact, a sauce stain (tan-brown blotch + pale squiggles) paints into the face texture at the hit UV, and 3–5 strand meshes attach to the head group at the impact point (hanging curves, jiggling with the head), cleared on reset. Strand count capped (~24).

## Risks / Trade-offs

- [Scene rewrite regresses 2D fallback] → fallback path untouched except sprites swap from emoji to icon images; verified separately.
- [Shadow maps on low-end GPUs] → single spotlight shadow at 1024px; everything else unlit-cheap Lambert.
- [Icon renderer context churn] → one shared small renderer, cached outputs, disposed after warm-up.
