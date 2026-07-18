# Design: arcade-ui-and-arsenal-sync

## Context

Restyle pass over the user's glassy UI system — structure, accessibility, and layout stay; the visual register shifts from "product dashboard" to "arcade cabinet".

## Goals / Non-Goals

**Goals:** unmistakably game-like at a glance; zero regressions to the existing a11y/keyboard work; no external network requests (font bundled).

**Non-Goals:** rebuilding layouts, changing game mechanics, re-adding retired weapons.

## Decisions

1. **Bungee (fontsource, bundled) as the display voice** — applied through the existing `.brand-display` hook so the header, hero, and score inherit it without markup churn; negative tracking removed where Bungee needs air.
2. **Arcade gradient (`.arcade-gradient-text`)** — yellow→orange→red vertical ramp with a hard drop shadow for the hero title and combo pops.
3. **A physical HIT button returns** — chunky red pill, hard 0/7px bottom shadow that compresses on press, bottom-right (above the dock on mobile); mirrors Space. Tap-the-face remains the primary input; the button is the arcade totem.
4. **Combo feedback moves center-stage** — big rotated Bungee pop keyed on the combo count, font size scaling with the streak; the stat card keeps only the counter and damage pips.
5. **Hotbar affordance** — brighter key badges, selected slot lifts/tilts with a red glow; scoreboard numerals go arcade-yellow.

## Risks / Trade-offs

- [Bungee is single-weight and wide] → used only for display moments; body text stays on the system stack.
- [Button could double-fire with hit-surface taps] → button sits above the hit surface (z-order) and stops propagation.
