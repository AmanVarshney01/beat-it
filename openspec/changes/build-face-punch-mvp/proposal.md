# Proposal: build-face-punch-mvp

## Why

"beat-it" doesn't exist yet — this change bootstraps the entire app. The goal is a browser gag/stress-relief game where you upload a photo of a face, the app mounts that face on a cartoon head, and you punch it with maximally satisfying comic feedback. Everything runs client-side so photos never leave the browser, which keeps the app free to host and private by design.

## What Changes

- Scaffold a new Vite + React + TypeScript single-page app.
- Add face upload flow: pick/drop an image, detect the face in-browser with MediaPipe, crop it to an oval cutout.
- Render a game scene on canvas: cartoon head + body with the user's face composited on, mounted like a punching dummy.
- Add punch interaction: a punch button (and clicking the head) drives a fist sprite that strikes the head.
- Add juice/feedback: squash-and-stretch spring animation via matter.js-style physics, screen shake, comic particles ("POW!", stars), comic sound effects.
- Add escalating damage: hit counter, combo meter, damage overlays (black eye, bruises, band-aids) that accumulate with hits, and a reset button.

## Capabilities

### New Capabilities

- `face-upload`: Selecting/dropping a photo, in-browser face detection, oval crop of the detected face, error handling when no face is found. Images are processed entirely client-side.
- `game-scene`: The canvas scene — cartoon head/body with the cropped face composited on, idle animation, physics-driven head motion on a spring mount.
- `punch-interaction`: Triggering punches (button press, clicking/tapping the head), fist animation, hit registration, and the resulting head knockback physics.
- `feedback-juice`: Visual/audio feedback per punch — squash-and-stretch, screen shake, comic particles and onomatopoeia, sound effects, with a mute toggle.
- `damage-progression`: Hit/combo counters and escalating cartoon damage overlays on the face, plus reset to pristine state.

### Modified Capabilities

None — this is the first change; no existing specs.

## Impact

- New codebase: `package.json`, Vite config, `src/` app code. No backend, no persistence beyond in-memory state.
- New runtime dependencies: `react`, `react-dom`, `@mediapipe/tasks-vision`, `matter-js`.
- MediaPipe model file (~1 MB face detector) fetched at runtime; needs bundling or CDN reference.
- Sound effects and cartoon art assets (head/body/fist/overlay sprites) need to be created or sourced with permissive licenses.
- Tone constraint: cartoonish/comic presentation throughout — no realistic violence, no blood.
