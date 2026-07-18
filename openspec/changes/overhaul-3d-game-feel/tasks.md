## 1. Baseline and Review Harness

- [ ] 1.1 Add seeded randomness and a development-only review configuration for demo face, viewport, quality tier, attack, target, and phase/frame
- [ ] 1.2 Add deterministic screenshot states for rest, anticipation, contact, follow-through, residue, and reset
- [ ] 1.3 Record baseline frame time and renderer memory for the current ten-hit desktop and mobile-equivalent sequences

## 2. Blender Asset Pipeline

- [x] 2.1 Create an idempotent Blender 5.2 Python build script with shared materials, canonical units, object naming, transforms, and export helpers
- [x] 2.2 Author and export beveled, smooth-shaded GLB models for glove, hand, mallet, tomato, and egg
- [x] 2.3 Author and export the dummy torso/shoulder/base model with a documented adaptive-neck attachment
- [x] 2.4 Render transparent picker/cursor thumbnails from the authored weapon assets
- [ ] 2.5 Emit an asset manifest and verify mesh/material/texture/file-size budgets in the build script

## 3. Runtime Asset System

- [x] 3.1 Add a cached GLTFLoader-based asset registry with preload during face detection
- [x] 3.2 Add clone-safe weapon and dummy instantiation that never disposes shared source geometry/materials
- [x] 3.3 Replace runtime weapon icons/cursors with authored thumbnails and keep a bounded load-failure fallback
- [ ] 3.4 Add one-time non-fatal asset diagnostics and loading-state coverage

## 4. Render, Lighting, and Camera

- [x] 4.1 Configure sRGB output, ACES tone mapping, capped DPR, environment lighting, and PBR materials
- [x] 4.2 Replace the flat room/dummy presentation with the authored dummy, grounded floor/set, key/fill/rim hierarchy, and contact/dynamic shadows
- [x] 4.3 Implement responsive camera framing with HUD safe areas for desktop, landscape, and portrait
- [x] 4.4 Replace per-frame random shake with a damped directional camera impulse and band-limited noise

## 5. Head Rig and Contact

- [ ] 5.1 Normalize face landmarks from stable facial anchors and robustly center, smooth, and clamp depth
- [x] 5.2 Add the shallow proxy shell, edge skirt, PBR face material, and adaptive neck anchors
- [ ] 5.3 Move local deformation into a HeadRig with surface-normal displacement, tangential drag, boundary stiffness, bulge, and capped recovery
- [ ] 5.4 Implement raycastable target capture and immutable ContactEvent output with world/local point, normal, UV, impulse, and strength
- [ ] 5.5 Add validity checks that route bad 3D reconstructions to the existing 2D fallback

## 6. Attack Timeline and Weapons

- [ ] 6.1 Replace the generic Fist timer with typed AttackDefinition phases and pooled AttackInstance state
- [x] 6.2 Make stored head-local targets follow head motion throughout approach and contact
- [x] 6.3 Implement side-aware punch, slap, and mallet choreography with correct pivots, camera-facing orientation, contact dwell, and recovery
- [x] 6.4 Re-author punch and slap contact silhouettes so knuckles and palm remain camera-facing from both approach directions
- [ ] 6.5 Implement authored tomato and egg arcs, tumble, contact break/splat, and follow-through
- [x] 6.6 Preserve bounded rapid input and implement complete active-attack cleanup on overflow, reset, and destroy

## 7. Unified Contact Feedback

- [ ] 7.1 Route Matter.js impulse, head deformation, squash, camera, particles, sound, and residue through the same ContactEvent
- [ ] 7.2 Make squash/compression weapon-specific, volume-preserving, bounded, and synchronized with contact
- [ ] 7.3 Spawn weapon-specific particles/fragments from the resolved surface normal with blood-free palettes and caps
- [ ] 7.4 Re-time layered whoosh/contact/body/residue audio from attack phases and add bounded heavy-hit hit-stop
- [x] 7.5 Store all bruises and food residue at resolved UVs and verify registration through deformation and recovery
- [x] 7.6 Add persisted Off/Female/Male reaction voices with short lines, mute integration, overlap throttling, preview, and lifecycle cleanup

## 8. Scope Simplification

- [x] 8.1 Remove fish, pie, noodles, and chili from the playable type, HUD, runtime animation, damage, audio, fallbacks, and authored asset output
- [x] 8.2 Remove the noodle simulation and its per-frame rendering workload
- [x] 8.3 Remove the random red attack button and retain direct face targeting as the primary control
- [x] 8.4 Remove emoji and comic-word gameplay effects in favor of authored thumbnails and physical particles

## 9. Responsive HUD and Fallback Parity

- [x] 9.1 Rework weapon selection and action controls so they do not cover the head or attack path at supported viewports
- [x] 9.2 Verify every authored weapon thumbnail, selected state, cursor, label, and direct-target interaction
- [ ] 9.3 Preserve settings behavior and confirm disabled shake, particles, damage, stars, sound, and sway remain independent
- [ ] 9.4 Verify no-landmarks and WebGL-failure flows remain fully playable with equivalent attack phases

## 10. Performance and Lifecycle

- [ ] 10.1 Implement RenderQualityManager tiers for DPR, shadows, particles, and fragments
- [ ] 10.2 Pool weapons, fragments, and particle render instances and remove per-hit geometry/material allocation
- [x] 10.3 Dispose face-owned textures/geometry, observers, animation frames, audio loops, and scene resources on new face/destroy
- [x] 10.4 Fix reset ordering so active projectiles and all transient systems are cleared before their tracking records
- [ ] 10.5 Meet desktop/mobile frame budgets and demonstrate stable renderer-memory counts across ten hit/reset cycles
- [x] 10.6 Make capped bruise and food-residue painting incremental so rapid hits do not rebuild the full damage history

## 11. Verification and Cutover

- [ ] 11.1 Add unit tests for attack phases, moving targets, side-aware ContactEvent mapping, seeded replay, and cleanup
- [ ] 11.2 Add browser smoke coverage for all attacks, rapid input, reset during every phase, resize, settings, and fallback
- [ ] 11.3 Capture and review deterministic visual baselines at desktop and mobile sizes
- [x] 11.4 Run type checks, production build, OpenSpec strict validation, and performance review with no unexpected console errors
- [ ] 11.5 Keep a temporary `renderer=legacy` comparison path until the new path passes acceptance, then document follow-up removal
