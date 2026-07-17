# Tasks: add-25d-face-deformation

## 1. Warp mesh

- [x] 1.1 Implement FaceWarp grid (spring vertices, Gaussian impact dent, settle detection) in src/game/warp.ts
- [x] 1.2 Implement textured-triangle mesh renderer with rest-state fast path

## 2. Engine integration

- [x] 2.1 Convert impact point/direction to head-local face space and trigger the dent on landPunch
- [x] 2.2 Update and render the warp mesh in the head draw path

## 3. Depth cues

- [x] 3.1 Add highlight + rim-shadow overlays on the face
- [x] 3.2 Add velocity-based fake-yaw tilt

## 4. Verification

- [x] 4.1 Visual check of dent + springback and shading; typecheck/build passes
