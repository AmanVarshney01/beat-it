# Proposal: add-demo-face

## Why

Trying the app currently requires having a face photo on hand. A bundled demo face (public-domain, AI-generated — a person who doesn't exist) lets anyone punch within one click, and a `?demo=1` URL starts straight into the game for sharing/demos.

## What Changes

- Bundle a public-domain StyleGAN-generated face as `public/demo-face.jpg`.
- Add a "try the demo face" action on the upload screen that runs it through the normal detection → crop pipeline.
- Auto-start the demo when the page is opened with `?demo=1`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `face-upload`: adds a demo-face source alongside picker and drag-and-drop.

## Impact

- `upload-screen.tsx` (demo button), `routes/index.tsx` (demo loader + query param), new static asset (~80 KB).
