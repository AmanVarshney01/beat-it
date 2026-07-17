# Design: add-attack-arsenal-and-settings

## Context

The engine has one hardcoded attack and anchor-based damage. We generalize both and add a user-facing settings surface.

## Goals / Non-Goals

**Goals:** 4 distinct-feeling attacks; damage lands where you aim; toggles for every major effect; settings survive reload.

**Non-Goals:** wound/burn/stab imagery of any kind (explicitly out — the subject is a real person's photo); weapon unlock progression; server-side anything.

## Decisions

1. **Attacks are data + small per-type branches, not subclasses:** each fist/projectile record carries its `attack` kind; spawn position (radial / side sweep / bottom arc), impulse scale, spin, sound, and impact handling switch on it. Slap applies mostly-horizontal impulse + large angular velocity and yaw swing; food throws apply a soft impulse and paint splats instead of bruises.
2. **DamagePainter becomes mark-based.** Bruise marks and splat marks live in lists; every impact converts the face-space hit point to texture UV and either deepens a nearby existing bruise (within ~60% radius) or adds a new mark, then repaints base + all marks. Caps (20 bruises, 12 splats) bound repaint cost. Landmarks are no longer needed by the painter.
3. **Splats are source-over paintings:** tomato = red pulp star with radiating streaks and seeds; egg = translucent white splat with a yolk disc and shell chips. Slight blur, clearly food, never blood-colored beyond tomato red on inspection.
4. **Settings live in React (localStorage-persisted) and are pushed into the engine** via `updateSettings(partial)`; the engine gates shake/particles/damage/dizzy/sway at their trigger points. Sound reuses the existing `sounds.muted`.
5. **Weapon picker is HUD state in React**; the selected attack is passed on every `punch()` call, so the engine stays stateless about selection.

## Risks / Trade-offs

- [Repaint per hit during mashing] → repaint is bounded by mark caps (~0.5ms typical); if needed later, dirty-region painting.
- [Tomato splat red could read as blood at a glance] → orange-red hue, visible seeds and chunky streaks keep it unmistakably food.
