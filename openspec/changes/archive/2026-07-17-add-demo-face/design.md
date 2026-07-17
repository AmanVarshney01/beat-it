# Design: add-demo-face

## Context

Small UX addition to the upload flow; no new subsystems.

## Goals / Non-Goals

**Goals:** one-click demo; deep-linkable demo start. **Non-Goals:** multiple demo faces, demo gallery.

## Decisions

1. **The demo face is an AI-generated (StyleGAN) public-domain image** — no real person is bundled with the app. It loads as an `HTMLImageElement` from `/demo-face.jpg` and goes through the exact same `handleImage` pipeline as an upload, so detection/crop/landmarks behave identically.
2. **`?demo=1` is read once on mount** via `URLSearchParams`; no router search-schema machinery for a single boolean.

## Risks / Trade-offs

- [Demo image fails to load offline-first cache-miss] → falls back to a toast; upload flow unaffected.
