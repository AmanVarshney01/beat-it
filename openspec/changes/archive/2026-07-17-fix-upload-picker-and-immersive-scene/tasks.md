# Tasks: fix-upload-picker-and-immersive-scene

## 1. Upload picker fix

- [x] 1.1 Convert drop zone and "Pick a photo" to `<label htmlFor>` targeting an `sr-only` file input; keep drag-and-drop and validation

## 2. Immersive scene

- [x] 2.1 Render GameScreen as a fixed full-viewport overlay above the app shell
- [x] 2.2 Scale head radius to ~0.34 × min(w,h) clamped [90, 400]; keep dummy/torso composition working on short viewports
- [x] 2.3 Scale fist and particle sizes with head radius; add soft spotlight behind the dummy

## 3. Verification

- [x] 3.1 Verify picker opens via label activation, game fills viewport on desktop + mobile sizes, typecheck/build passes
