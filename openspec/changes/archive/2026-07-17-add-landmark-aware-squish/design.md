# Design: add-landmark-aware-squish

## Context

The warp grid dents uniformly. We want per-region flesh behavior derived from actual face geometry.

## Goals / Non-Goals

**Goals:** cheek hits squish visibly more than forehead hits; displaced flesh bulges outward around the dent; graceful fallback when no landmarks are found.

**Non-Goals:** full 468-point mesh rendering, expression animation, per-frame landmark tracking.

## Decisions

1. **Run FaceLandmarker on the cropped oval bitmap, not the source photo.** Landmarks come back in crop space, which maps to the warp grid's normalized face space with no coordinate gymnastics — and it works for manually-cropped faces too. Runs once per face, lazily; model vendored like the detector's.
2. **Landmarks reduce to a per-vertex softness scalar [0.2, 1], not a mesh.** A handful of anchor landmarks (cheek centers, chin, forehead) seed Gaussian soft/stiff fields sampled at each grid vertex. The dent impulse is multiplied by vertex softness. Keeps the renderer untouched.
3. **Ring bulge for fake volume conservation.** Each punch also pushes vertices in a ring around the impact radially outward (Gaussian band at ~0.85 face-radii). Reads as displaced flesh.
4. **Procedural fallback softness** (lower half of the face progressively softer) when landmark detection fails, so behavior degrades smoothly rather than switching off.

## Risks / Trade-offs

- [FaceLandmarker misses on the oval crop (transparent corners)] → fallback map keeps the feature alive; detection failure is silent and non-fatal.
- [+3.6 MB model] → fetched lazily after a face is confirmed, parallel to entering the game.
