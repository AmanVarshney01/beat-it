# Proposal: add-attack-arsenal-and-settings

## Why

One attack (punch) gets stale, damage appears at fixed anchor spots regardless of where you hit, and there's no way to tune the experience. An arsenal of slapstick attacks, impact-located damage, and a settings menu make the game replayable and configurable.

## What Changes

- Attack arsenal with a weapon picker: punch 🥊 (existing), slap ✋ (horizontal sweep, big spin), tomato 🍅 and egg 🥚 throws (arcing projectiles that splat on the face).
- Location-based damage: bruises are painted at the exact impact point (repeat hits in the same area deepen the existing bruise); tomato/egg leave splats at the impact point. Fixed-anchor damage is replaced.
- Settings menu (gear): toggles for sound, screen shake, particles & words, damage marks, dizzy stars, and idle sway; persisted in localStorage.
- Tone boundary unchanged and explicit: no cutting, burning, stabbing, blood, or gore — attacks are slapstick (impact and food-splat only).

## Capabilities

### New Capabilities

- `game-settings`: user-configurable effect toggles, persisted locally.

### Modified Capabilities

- `punch-interaction`: generalized to an attack system with selectable attack types and per-type animation/physics/sound.
- `damage-progression`: damage marks are located at the impact point (bruises deepen on repeat hits nearby; splats for food attacks); hit thresholds now drive only the dizzy-stars max state.

## Impact

- `damage.ts` rework (mark lists, splat painting), `audio.ts` (slap/splat sounds), `engine.ts` (attack types, projectiles, settings gating), `game-screen.tsx` (weapon picker, settings panel).
