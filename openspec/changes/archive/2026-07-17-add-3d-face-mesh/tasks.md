# Tasks: add-3d-face-mesh

## 1. Face mesh foundation

- [x] 1.1 Add three dependency; vendor canonical 880-triangle tessellation as src/game/face3d/triangulation.ts
- [x] 1.2 Implement Head3D: scene/camera/lights, face BufferGeometry from landmarks (positions, UVs, depth), photo texture, back-of-head sphere

## 2. Integration

- [x] 2.1 Refactor engine + GameScreen to the bg/WebGL/fg canvas sandwich; physics drives the head group per frame
- [x] 2.2 Punch-driven yaw/pitch springs and idle sway; squash applied to the 3D group
- [x] 2.3 Port dent deformation to mesh vertices with per-vertex softness; wire into landPunch
- [x] 2.4 Route awaits landmarks post-crop and passes them into the game; remove obsolete 2D softness plumbing

## 3. Verification

- [x] 3.1 Verify 3D look (silhouette, nose depth on sway, dents), 2D fallback via non-face manual crop, reset/new-face, typecheck/build
