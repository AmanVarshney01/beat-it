# Proposal: add-slapstick-arsenal-2

## Why

The user wants more over-the-top attack variety in the classic slapstick register. Four cartoon-canon attacks add destruction-comedy (mallet bonk, fish slap, pie splat, chili burn-gag) while keeping the standing tone line: no weapons-that-wound, no fire-on-flesh, no gore — the "burning" is a comic chili flush with steam, not charring.

## What Changes

- Four new attacks in the weapon picker: mallet 🔨 (overhead bonk, extreme squash), fish 🐟 (wet slap), pie 🥧 (cream splat at the impact point), chili 🌶️ (paints a red flush at the spot + 🔥💨 particle burst).
- New synthesized sounds: deep bonk, wet fish thwap, sizzle for chili.
- New located marks: pie cream splat, chili flush (warm red surface blotch, visually distinct from bruises).
- Particle bursts support per-attack glyph sets (🔥/💨 for chili, 💥 for mallet).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `punch-interaction`: arsenal extended with mallet, fish, pie, chili (same slapstick-only constraint).
- `damage-progression`: adds pie-splat and chili-flush located marks.

## Impact

- `engine.ts` (attack branches), `damage.ts` (two mark painters), `audio.ts` (three sounds), `particles.ts` (glyph override), `game-screen.tsx` (picker entries, 2-column layout).
