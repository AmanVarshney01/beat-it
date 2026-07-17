# Proposal: go-full-3d-scene

## Why

Three user complaints converge on one architecture: the neck looks fake (flat 2D quad), emoji sprites clash with the realistic 3D head, and the scene should feel like a place. Moving the entire scene into Three.js — room, dummy with real neck, 3D weapon models flying in depth — fixes all of it at the root and unlocks projectiles that fly from the viewer INTO the screen.

## What Changes

- Full 3D scene: room (floor + back wall), spotlight with real cast shadows, 3D torso and neck (skin-tinted cylinder) under the existing 3D face mesh.
- All weapons become 3D models built from primitives (glove, hand, mallet, fish, tomato, egg, pie, chili) — food flies from the viewer with depth and tumble; melee swings in 3D. Zero emoji anywhere in 3D mode.
- New weapon: noodles 🍜 — a clump of 3D noodle strands drops from above, drapes strands on the head and leaves a sauce stain at the impact spot ("make it all dirty").
- Weapon-model renders used everywhere: picker icons, custom mouse cursor (the cursor becomes the selected weapon), and 2D-fallback sprites — replacing emoji in all modes.
- Particles switch from emoji glyphs to drawn shapes (stars, sparks, flames, smoke, droplets); comic words stay as styled text.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `game-scene`: the scene renders as a 3D room with lit dummy, real shadows, and 3D neck; 2D pipeline remains the no-landmarks fallback.
- `punch-interaction`: weapons render as 3D models (or drawn sprites in fallback); the mouse cursor over the scene shows the selected weapon; adds the noodles attack.
- `damage-progression`: adds noodle sauce stain marks and draped noodle strands that persist until reset.

## Impact

- `face3d/head3d.ts` grows into `face3d/scene3d.ts` (room, dummy, weapons, noodles, icon renderer); engine drives it; `damage.ts` gains a noodle stain; `particles.ts` drops emoji; picker/cursor UI updates. three.js already a dependency.
