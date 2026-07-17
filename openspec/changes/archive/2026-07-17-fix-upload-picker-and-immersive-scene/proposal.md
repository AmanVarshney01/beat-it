# Proposal: fix-upload-picker-and-immersive-scene

## Why

First real-user test surfaced two problems: the "choose a file" action doesn't open the OS file picker in the user's browser (programmatic `input.click()` is unreliable across browsers), and the game scene reads as tiny — the face is a small element floating in empty space instead of being the point of the whole app.

## What Changes

- Replace programmatic file-input clicking with native `<label htmlFor>` activation so the picker opens reliably in every browser.
- Make the game screen a full-viewport immersive overlay (covers the header/app chrome).
- Scale the head up to dominate the viewport (~⅓ of the smaller dimension as radius), with the dummy, fist, and particles scaling proportionally, plus a subtle spotlight behind the dummy.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `game-scene`: adds a requirement that the scene fills the viewport with the face as the dominant focal point.

## Impact

- `apps/web/src/components/upload-screen.tsx` (label-based picker), `game-screen.tsx` (fullscreen overlay), `src/game/engine.ts` and `particles.ts` (size scaling, spotlight). No dependency changes.
