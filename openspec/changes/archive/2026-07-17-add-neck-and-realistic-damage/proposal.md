# Proposal: add-neck-and-realistic-damage

## Why

Two immersion breaks: the cartoon spring coil under the 3D face reads as a toy, and the damage overlays are flat gradient blobs floating above the face instead of injuries on skin. With the head now a lit 3D mesh, a skin-toned neck and texture-painted bruising complete the "punching a real head" feel.

## What Changes

- Replace the spring-coil visual with a skin-toned neck (color sampled from the face) connecting torso to chin; physics is unchanged.
- Paint damage directly into the face texture: layered realistic bruise rendering (dark core, violet mid, yellowed edge, mottled noise) anchored to facial landmarks (eye socket, cheekbone, brow, jaw), deepening across the hit thresholds. The painted texture wraps the 3D mesh and is lit with the skin.
- Tone boundary: bruised and swollen, never bloody — no cuts, blood, or gore. Dizzy stars at max damage stay (comic release valve).
- Works in 2D fallback mode too (the warp draws the same painted canvas).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `damage-progression`: damage changes from "cartoon sticker overlays" to realistic texture-painted bruising (still blood-free), anchored to landmarks with fixed fallback anchors.
- `game-scene`: the dummy shows a neck instead of a spring coil (physics spring behavior unchanged).

## Impact

- New `src/game/damage.ts` (DamagePainter); engine uses the painted canvas as the face source in both modes; Head3D gains a texture-refresh hook; spring-coil drawing replaced by neck drawing.
