# Design: fix-upload-picker-and-immersive-scene

## Context

Bug-fix + UX pass on the shipped MVP, driven by first-user feedback.

## Goals / Non-Goals

**Goals:** file picker opens on every click in every browser; the face is unmistakably the main thing on screen.

**Non-Goals:** any change to detection, physics feel, damage progression, or sounds.

## Decisions

1. **Native `<label htmlFor="...">` instead of `ref.click()` for the file input.** Label activation is the platform's built-in way to open a picker and cannot be blocked as an untrusted programmatic click; the input becomes `sr-only` (still focusable/accessible) rather than `display:none`. Drag-and-drop handlers move onto the label.
2. **Game screen renders as a `fixed inset-0` overlay** above the app shell instead of inside the header grid — cheap immersion, no global state needed to hide the header.
3. **Head radius scales to ~0.34 × min(viewport dimension), clamped [90, 400].** Fist and particle sizes take a scale factor derived from head radius so the juice grows with the head. A soft radial spotlight behind the dummy anchors the composition.

## Risks / Trade-offs

- [Oversized head leaves little room for the torso on short viewports] → torso extends off the bottom edge by design; the shadow clamps to the visible area.
