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
- [x] 3.3 Replace runtime weapon icons/cursors with authored thumbnails and require the authored model bundle before play
- [ ] 3.4 Add one-time non-fatal asset diagnostics and loading-state coverage

## 4. Render, Lighting, and Camera

- [x] 4.1 Configure sRGB output, ACES tone mapping, capped DPR, environment lighting, and PBR materials
- [x] 4.2 Replace the flat room/dummy presentation with the authored dummy, grounded floor/set, key/fill/rim hierarchy, and contact/dynamic shadows
- [x] 4.3 Implement responsive camera framing with HUD safe areas for desktop, landscape, and portrait
- [x] 4.4 Replace per-frame random shake with a damped directional camera impulse and band-limited noise
- [x] 4.5 Add persisted Studio, Boxing Gym, Midway, and Rooftop stages as one reusable backdrop texture with stage-specific floor and lighting palettes

## 5. Head Rig and Contact

- [ ] 5.1 Normalize face landmarks from stable facial anchors and robustly center, smooth, and clamp depth
- [x] 5.2 Add the shallow proxy shell, edge skirt, PBR face material, and adaptive neck anchors
- [ ] 5.3 Move local deformation into a HeadRig with surface-normal displacement, tangential drag, boundary stiffness, bulge, and capped recovery
- [ ] 5.4 Implement raycastable target capture and immutable ContactEvent output with world/local point, normal, UV, impulse, and strength
- [x] 5.5 Add validity checks that return bad 3D reconstructions to upload with a clear error
- [x] 5.6 Close the inner-mouth topology with the source-photo texture, remove the opaque face underlay, and clip the proxy shell to rear-only geometry so photographed teeth remain visible without a gray oval

## 6. Attack Timeline and Weapons

- [x] 6.1 Replace the generic Fist timer with typed AttackDefinition phases and pooled AttackInstance state
- [x] 6.2 Make stored head-local targets follow head motion throughout approach and contact
- [x] 6.3 Implement side-aware punch, slap, and mallet choreography with correct pivots, camera-facing orientation, contact dwell, and recovery
- [x] 6.4 Re-author punch and slap contact silhouettes so knuckles and palm remain camera-facing from both approach directions
- [x] 6.5 Implement authored tomato and egg arcs, tumble, contact break/splat, and follow-through
- [x] 6.6 Preserve bounded rapid input and implement complete active-attack cleanup on overflow, reset, and destroy

## 7. Unified Contact Feedback

- [ ] 7.1 Route Matter.js impulse, head deformation, squash, camera, particles, sound, and residue through the same ContactEvent
- [x] 7.2 Make squash/compression weapon-specific, volume-preserving, bounded, and synchronized with contact
- [x] 7.3 Spawn weapon-specific particles/fragments from the resolved contact with blood-free palettes and caps
- [x] 7.4 Synchronize whoosh/contact/residue audio to attack phases and add bounded heavy-hit hit-stop
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
- [x] 9.4 Verify invalid-landmark, missing-asset, and WebGL-failure flows return cleanly to upload

## 10. Performance and Lifecycle

- [x] 10.1 Implement RenderQualityManager tiers for DPR, shadows, particles, and fragments
- [x] 10.2 Pool weapons, fragments, and particle render instances and remove per-hit geometry/material allocation
- [x] 10.3 Dispose face-owned textures/geometry, observers, animation frames, audio loops, and scene resources on new face/destroy
- [x] 10.4 Fix reset ordering so active projectiles and all transient systems are cleared before their tracking records
- [x] 10.5 Meet desktop/mobile frame budgets and demonstrate stable renderer-memory counts across ten hit/reset cycles (10 ms median, ≤30.1 ms max; geometry/texture counts stable across reset)
- [x] 10.6 Make capped bruise and food-residue painting incremental so rapid hits do not rebuild the full damage history

## 11. Verification and Cutover

- [ ] 11.1 Add unit tests for attack phases, moving targets, side-aware ContactEvent mapping, seeded replay, and cleanup
- [ ] 11.2 Add browser smoke coverage for all attacks, rapid input, reset during every phase, resize, settings, and invalid-start handling
- [ ] 11.3 Capture and review deterministic visual baselines at desktop and mobile sizes
- [x] 11.4 Run type checks, production build, OpenSpec strict validation, and performance review with no unexpected console errors
- [x] 11.5 Remove the legacy/2D gameplay renderer and procedural weapon path after cutover

## 12. Player Cap Customization

- [x] 12.1 Author and export a clean cap GLB with independently colorable crown, brim, button, and front label mesh
- [x] 12.2 Add persisted cap visibility, six-digit color, and 12-character front-text settings
- [x] 12.3 Render cap text through one reusable canvas texture with automatic light/dark contrast
- [x] 12.4 Verify cap fit, text centering, live updates, persistence, recoil attachment, and mobile settings layout
- [x] 12.5 Refine the cap to a compact fitted crown with a clean lower edge, matte fabric, narrow curved bill, and cap-aware dizzy-star orbit
- [x] 12.6 Consolidate the cap into one checked-in Blender source, optimize its runtime mesh, remove the procedural fallback, and keep max-damage stars clear of the larger crown
