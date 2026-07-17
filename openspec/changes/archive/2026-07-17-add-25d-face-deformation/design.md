# Design: add-25d-face-deformation

## Context

The MVP renders the cropped face bitmap rigidly (one drawImage + whole-head squash). We want per-impact local deformation and depth cues.

## Goals / Non-Goals

**Goals:** visible cheek-dent at the impact point with elastic springback; dome-like shading; keep 60fps; work identically for detected and manually-cropped faces.

**Non-Goals:** true 3D reconstruction, WebGL renderer, FaceLandmarker mesh tracking.

## Decisions

1. **Uniform elastic grid warp (≈10×12 cells) over the face bitmap, not MediaPipe FaceLandmarker's 468-point mesh.** A grid needs no extra model download, costs ~240 canvas triangles per frame only while deformed, and — decisively — also works for manually-cropped faces, which have no landmarks. Landmark-anchored warping is a possible future upgrade for feature-aware squishing.
2. **Vertices are damped springs in normalized face space.** A punch pushes vertices along the impact direction with Gaussian falloff from the impact point; each vertex springs back independently. When all offsets settle below a threshold the renderer falls back to plain `drawImage` (zero overhead at rest).
3. **Textured triangles via affine clip+transform on the existing 2D canvas.** No WebGL migration; each grid cell renders as two clipped `drawImage` calls only while the mesh is active.
4. **Depth cues are gradient overlays + velocity tilt.** A top-left highlight and an elliptical rim shadow are drawn over the face each frame (cheap), and horizontal head velocity slightly narrows the head (fake yaw) for a 3D-turn illusion.

## Risks / Trade-offs

- [Triangle rendering cost on low-end mobiles] → deformation is active only ~0.5s after each hit; rest state uses the fast path. Grid density is a single constant to tune down.
- [Visible triangle seams at extreme dents] → cell overlap of ~0.5px when rendering hides seams; deformation magnitude is clamped.
