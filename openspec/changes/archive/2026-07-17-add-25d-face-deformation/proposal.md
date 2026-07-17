# Proposal: add-25d-face-deformation

## Why

The face currently moves and squashes as a rigid sticker. Making it read as a 2.5D object — the cheek visibly dents where the fist lands and springs back, and the head shades like a rounded dome — makes punches feel dramatically more physical and "real" while staying cartoonish.

## What Changes

- Add an elastic warp-grid over the face bitmap: punches locally deform the mesh at the impact point (dent + springback), rendered as textured triangles on the existing canvas.
- Add depth shading to the head: soft top-light highlight and rim shadow so the face reads as a dome, plus a subtle velocity-based tilt for a fake-3D turn.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `feedback-juice`: adds a requirement that punch impacts locally deform the face with elastic springback.
- `game-scene`: adds a requirement that the head renders with depth cues (shading, tilt).

## Impact

- New `apps/web/src/game/warp.ts` (grid mesh + textured-triangle renderer); `engine.ts` integrates deformation into impact handling and head drawing. No new dependencies, no detection changes — works for both auto-detected and manually-cropped faces.
