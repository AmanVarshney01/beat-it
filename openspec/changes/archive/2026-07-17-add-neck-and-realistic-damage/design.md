# Design: add-neck-and-realistic-damage

## Context

Damage is currently drawn per-frame on the foreground 2D canvas — it floats above the 3D head. The dummy's neck is a cartoon zigzag spring.

## Goals / Non-Goals

**Goals:** bruises that look like they're on the skin (wrap, rotate, and light with the mesh); a believable neck; keep the no-blood tone line; both render modes supported.

**Non-Goals:** wounds/blood/gore; bruise persistence across sessions; changing the physics mount.

## Decisions

1. **DamagePainter owns a working canvas: base crop + painted bruises.** On each damage-stage change it repaints (base copy, then cumulative bruise layers) — never per frame. Both the 2D warp and the Head3D texture read this same canvas; Head3D just flips `texture.needsUpdate` when told.
2. **Bruise realism is layered painting, not assets.** Each bruise: yellow-green outer halo, red-violet main gradient, dark core, then seeded mottling (~16 small low-alpha ellipses in purple/red hues), all composited with `multiply` so skin tone shows through. A deterministic seeded PRNG keeps repaints stable.
3. **Anchors come from landmarks when available** (eye socket 145, cheekbone 280, brow 334, jaw 152), with fixed oval-relative fallbacks for the no-landmark 2D mode.
4. **Stage progression:** 5 hits = fresh black eye; 15 = + cheekbone bruise; 30 = + brow and jaw bruises; 50 = all deepen (higher intensity repaint). Dizzy stars remain at stage 4. Emoji band-aid is retired.
5. **Neck = shaded trapezoid quad** from torso top to the chin point (follows head position/angle), filled with a vertical gradient of the sampled chin skin tone. Drawn on the background canvas so it sits behind the face in both modes. The physics constraint is untouched — the spec's "spring mount" is simulation behavior, and it still holds.

## Risks / Trade-offs

- [Sampled skin tone lands on hair/background for unusual crops] → sample point at the chin region of the crop; worst case the neck is off-tint, cosmetic only.
- [Repainting texture on stage change causes a frame hitch] → paint is ~5 gradients + 16 ellipses once per threshold, negligible.
