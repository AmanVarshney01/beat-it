# Proposal: add-3d-face-mesh

## Why

Even with 2.5D warping, the head reads as "an oval we're punching" — a flat sticker. The fix is real 3D: MediaPipe's 468 landmarks carry per-point depth, so we can build an actual 3D mesh of the uploaded face (nose protruding, real jaw/forehead silhouette), texture it with the photo, and light it. This replaces the flat oval with the person's own geometry — better than mapping the photo onto a generic modeled head, which would never align.

## What Changes

- Build a Three.js head from the landmarks: face mesh (positions + depth from landmarks, photo as texture, canonical 880-triangle tessellation) plus a skin-toned back-of-head ellipsoid, lit with directional + ambient light.
- Render the 3D head on a WebGL canvas layered between the scene background (torso, spring, shadow) and the effects foreground (fists, particles, damage stickers).
- Physics still drives the head: position/rotation from matter.js, plus punch-driven yaw/pitch swings and idle sway that show off the depth.
- Port punch deformation to the 3D mesh (spring-vertex dents with per-region softness).
- Keep the 2D warp pipeline as the fallback when no landmarks are found (manual crops of non-faces).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `game-scene`: the head SHALL render as a textured, lit 3D face mesh built from the photo's landmarks when available, with the 2D oval pipeline as fallback.

## Impact

- New dependency: `three` (+ types). New `src/game/face3d/` (triangulation data, Head3D renderer). Engine refactor to a background/WebGL/foreground canvas sandwich. Route passes landmarks into the game synchronously.
