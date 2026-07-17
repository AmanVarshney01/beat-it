# Design: add-3d-face-mesh

## Context

The head is currently a warped 2D bitmap. Landmarks (with z) give us the photo's own 3D geometry for free — no Blender, no generic model, no texture-projection alignment problems.

## Goals / Non-Goals

**Goals:** the head visibly reads as a 3D object (protruding nose, silhouette, lighting, parallax on rotation); punches still dent it; everything else (physics, effects, damage, sounds) unchanged; graceful 2D fallback.

**Non-Goals:** full-head scan accuracy, hair/ear reconstruction, skeletal animation, replacing matter.js.

## Decisions

1. **Mesh from the user's landmarks, not a generic modeled head.** FaceLandmarker's 468 normalized points include z; vertices = (x, y, −z·scale) in normalized face space, UVs = (x, y) into the cropped bitmap, indices = the canonical MediaPipe tessellation (880 triangles, vendored from tfjs-models, Apache-2.0). Texture alignment is perfect by construction.
2. **Canvas sandwich: 2D background → WebGL head → 2D foreground.** Background canvas draws spotlight/torso/spring/shadow; the transparent WebGL canvas renders only the head; the foreground canvas draws fists, particles, damage stickers, and HUD-adjacent effects. Avoids porting the whole scene to WebGL while keeping correct occlusion (head over torso, effects over head).
3. **Physics keeps authority.** The matter.js body still owns position/impulses; each frame the head group copies (x, y, angle). 3D-only motion (yaw/pitch swing on punch, idle sway) runs as light springs inside Head3D — this rotation is what sells the depth.
4. **Deformation ports to mesh vertices.** Same damped-spring model as the 2D warp but on the 468 vertices in 3D (dents push into the face along −z-biased direction), with per-vertex softness from the same cheek/chin/forehead anchors. Normals recompute only while deformed.
5. **Back of head = flattened sphere tinted from a sampled forehead pixel.** Cheap volume so profile views don't show a hollow shell.
6. **Landmarks resolve before entering the game.** The route awaits landmark detection after cropping (models are already local); when none are found the game starts in the existing 2D warp mode, whose landmark-softness plumbing is removed (2D mode now always uses the procedural softness map — its anatomical weighting role is superseded by 3D mode).

## Risks / Trade-offs

- [WebGL context unavailable (rare)] → catch at Head3D construction, fall back to 2D mode.
- [Landmark z is relative, not metric] → depth scale is a tuned constant; comic exaggeration is a feature here, not a bug.
- [Texture shows crop-oval edge on extreme yaw] → yaw is clamped (±~0.5 rad) and the back-of-head sphere covers the silhouette.
