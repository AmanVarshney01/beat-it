# Proposal: arcade-ui-and-arsenal-sync

## Why

The current UI is polished but reads as a SaaS dashboard — the user wants it to feel like a game. Separately, the user's authored-assets pass curated the arsenal to 5 weapons and dropped the weapon cursor and noodles; the specs still describe the old surface and need to be brought back in line with reality.

## What Changes

- Arcade visual language: bundled display font (Bungee, local via fontsource), arcade gradient title, chunky pressable HIT button (bottom-right, also triggered by Space), big center-screen combo pops, scoreboard-style hit counter, hotbar-style weapon dock with visible key badges.
- Keyboard controls formalized: 1–5 select weapons, Space attacks, Escape closes settings.
- Spec sync with the curated build: arsenal is punch/slap/mallet/tomato/egg with authored GLB models; noodles attack, fish/pie/chili, their marks, and the weapon cursor are removed from the specs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `punch-interaction`: arsenal requirement updated to the curated 5; keyboard controls added; noodles/extended-arsenal/cursor requirements removed.
- `damage-progression`: pie/chili and noodle mark requirements removed.

## Impact

- `index.css` (arcade tokens/components), `game-screen.tsx` (HIT button, combo pop, Space key), `upload-screen.tsx` (arcade title), new dependency `@fontsource/bungee` (bundled, no external requests).
