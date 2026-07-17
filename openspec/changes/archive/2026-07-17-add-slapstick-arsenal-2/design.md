# Design: add-slapstick-arsenal-2

## Context

The attack system is data + per-kind branches (spawn path, impulse, sound, mark). Adding four kinds extends existing switches; no new architecture.

## Goals / Non-Goals

**Goals:** four distinct-feeling slapstick attacks; chili delivers a comedic "burning" without depicting burns; marks stay located at the impact point.

**Non-Goals:** blades, fire-on-flesh, impalement, charring, gore — the register is Looney Tunes, the target is a real person's photo, and weapon-wound imagery stays out.

## Decisions

1. **Mallet:** drops from above the head (angle ≈ straight down), oversized glyph, biggest impulse + a squash overshoot beyond the normal clamp for the "flattened" frame, deep bonk (sine drop 150→60Hz + overtone).
2. **Fish:** slap variant — side sweep, slightly slower, wet thwap = slap crack layered with the splat plop; leaves no mark (it's a fish).
3. **Pie:** food-arc projectile; mark = fluffy cream splat (overlapping white/cream blobs + tan crust chips) — reads as dessert, not liquid.
4. **Chili:** food-arc projectile; mark = warm red-orange radial flush multiplied onto the skin (hue clearly warmer than bruise violet); burst uses 🔥/💨 glyphs; sizzle = bandpassed noise ~2.8kHz decaying 0.35s. This is the sanctioned "burning" gag.
5. **Particle glyph override:** `burst()` gains an optional glyph array; default remains stars.

## Risks / Trade-offs

- [Chili flush could be mistaken for injury] → hue kept orange-red and diffuse (no core darkening), plus 🔥💨 framing at impact time.
- [8 weapons crowd the picker on phones] → picker becomes a 2-column grid with smaller cells.
