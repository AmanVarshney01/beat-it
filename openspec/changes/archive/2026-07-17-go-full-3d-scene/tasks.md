# Tasks: go-full-3d-scene

## 1. Scene3D

- [x] 1.1 Grow Head3D into Scene3D: room (floor/wall), spotlight shadows, camera shake, torso + 3D neck; absorb face mesh/deform/texture code
- [x] 1.2 buildWeaponMesh(kind) primitive models for all 9 weapons; projectile attach/move/remove API with per-kind depth paths and tumble
- [x] 1.3 Noodle system: strand clump projectile, draped strands attached to head at impact, caps + reset
- [x] 1.4 Icon pipeline: shared offscreen renderer → cached weapon images for picker, cursor, and 2D-fallback sprites

## 2. Integration

- [x] 2.1 Engine: drive Scene3D (layout, head, neck, projectiles); camera shake; 2D-mode-only canvas dummy; noodles attack kind + sauce stain mark; particle shapes replace emoji
- [x] 2.2 UI: picker uses icon images; cursor reflects selected weapon; noodles in picker

## 3. Verification

- [x] 3.1 Browser: room+shadows, tomato depth flight, noodle mess, each weapon renders, cursor, 2D fallback; typecheck/build
