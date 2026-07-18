## Why

The game uses Three.js, but its presentation still reads as a prototype: the face is an open landmark sheet, the dummy and weapons are minimally shaded primitives, attacks follow generic paths, and effects appear beside the contact instead of behaving as part of it. The whole experience needs one coherent game-feel pass rather than more isolated effects.

## What Changes

- Establish a single stylized-physical art direction: believable materials, proportions, depth, contact, and weight without pursuing photorealism or graphic violence.
- Rebuild the 3D head as a normalized, closed-looking presentation with controlled depth, stable silhouette, better skin shading, and a convincing neck connection.
- Replace the empty primitive room and dummy treatment with a grounded set, readable lighting hierarchy, contact shadows, improved framing, and responsive composition.
- Replace the shared attack interpolation with weapon-specific choreography containing anticipation, approach, contact, compression, follow-through, and recovery phases.
- Replace procedural weapon stand-ins with authored Blender models so each weapon has a recognizable silhouette, grip/orientation, scale, and surface response.
- Narrow the playable arsenal to punch, slap, mallet, tomato, and egg; remove fish, pie, noodles, and chili from UI, runtime, authored assets, damage, audio, and fallback behavior.
- Make punch, slap, and mallet enter from the same side of the face the player directly targets, while preserving a camera-facing hand silhouette and a physically aligned mallet.
- Make dents, splats, particles, audio, camera impulse, and head physics derive from one resolved 3D contact event.
- Replace emoji/comic-word effect stand-ins with authored weapon renders and bounded physical impact particles.
- Add optional short spoken reactions with selectable female or male local voices, bounded overlap, and shared mute behavior.
- Add measurable visual and performance acceptance scenes for desktop and mobile, including deterministic attack playback and graceful quality reduction.
- Preserve client-only face processing, rapid input, existing controls, and the blood-free slapstick tone while requiring a valid authored 3D scene for gameplay.

## Capabilities

### New Capabilities

- `render-quality`: Shared material, lighting, camera, shadow, quality-tier, deterministic-review, and frame-budget requirements for the Three.js scene.

### Modified Capabilities

- `game-scene`: Upgrade the head, neck, dummy, environment, composition, depth behavior, and strict 3D startup validation.
- `punch-interaction`: Replace generic projectile motion with weapon-specific attack timelines, orientations, contact resolution, and reset behavior.
- `feedback-juice`: Synchronize deformation, camera, particles, audio, and recovery around the actual contact event.
- `damage-progression`: Place and render bruises and food residue from resolved mesh contact data so marks remain attached while the head deforms and rotates.

## Impact

The change primarily affects `apps/web/src/game/engine.ts`, `apps/web/src/game/face3d/scene3d.ts`, weapon construction, face-mesh preparation, particles, damage painting, audio timing, and the game HUD. The monolithic `Scene3D` and `PunchGame` responsibilities will be split into focused scene, head, weapon, attack-timeline, contact, and effects systems. New lightweight rendering helpers may be added, but the game will remain browser-only and must not require a server or upload user images.
