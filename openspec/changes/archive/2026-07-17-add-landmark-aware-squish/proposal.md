# Proposal: add-landmark-aware-squish

## Why

The 2.5D dent treats the whole face as uniform rubber. Real faces aren't: cheeks are soft, foreheads are bone, and displaced flesh bulges around an impact. Using MediaPipe's face landmarks to build a per-region softness map makes punches feel anatomically believable while staying cartoon-legal.

## What Changes

- Run MediaPipe FaceLandmarker once on the cropped face bitmap to locate cheeks, jaw, chin, and forehead; build a per-vertex softness map for the warp grid (cheeks squishy, forehead stiff).
- Add a volume-conservation bulge: flesh around the dent pushes outward in a ring.
- Fall back to a procedural softness map (lower face softer) when landmarks can't be found — manual crops and odd photos keep working.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `feedback-juice`: extends face deformation to be anatomically weighted (soft cheeks, stiff forehead, ring bulge), with a procedural fallback.

## Impact

- `warp.ts` (softness map + ring bulge), `detector.ts` (lazy FaceLandmarker), route/game plumbing for the softness map. New vendored model `face_landmarker.task` (~3.6 MB, lazy-loaded after crop).
