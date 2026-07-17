# Design: build-face-punch-mvp

## Context

Greenfield project. The app is a single-page browser game with three phases: upload a face photo → face is detected and mounted on a cartoon dummy → punch it. Everything is client-side; there is no backend. The fun lives almost entirely in the "juice" of the punch feedback, so the architecture should make the game loop and effects easy to iterate on.

## Goals / Non-Goals

**Goals:**

- Fully client-side pipeline: image never leaves the browser.
- Satisfying, low-latency punch feedback at 60fps on a mid-range laptop and modern phone.
- Cartoonish presentation throughout (comic sounds, "POW" particles, sticker-style damage).
- Simple codebase a solo dev can iterate on quickly.

**Non-Goals:**

- 3D head reconstruction, face mesh warping/deformation (candidate for a later change).
- Accounts, persistence, sharing/exporting videos, leaderboards.
- Server-side anything.
- Mobile app packaging; this is a responsive web app only.

## Decisions

1. **Vite + React + TypeScript, with the game scene on a single `<canvas>`.**
   React owns app state and chrome (upload screen, buttons, counters); the game scene renders imperatively in a `requestAnimationFrame` loop on one canvas. Alternative considered: rendering the scene in React/DOM with CSS transforms — simpler, but screen shake, particles, and per-frame physics fight React's render model. A game-engine (Phaser/Pixi) was also considered but is overkill for one scene.

2. **MediaPipe `@mediapipe/tasks-vision` FaceDetector for detection, run once per upload.**
   We only need a bounding box + eye keypoints to place and rotate the oval crop — the short-range BlazeFace model (~1 MB) suffices. Alternative: face-api.js (unmaintained) or FaceLandmarker (468 landmarks — only needed when we later do squish-warping). Model file is served from our own `public/` dir, not a CDN, so the app works offline and has no third-party calls.

3. **Face compositing done once into an offscreen canvas.**
   On successful detection: crop the face region, apply an oval alpha mask and a thin cartoon outline, and cache it as an offscreen canvas/ImageBitmap. The game loop just draws this bitmap — no per-frame image processing.

4. **matter.js for head physics: head body on a spring constraint (punching-dummy style).**
   The head is a circle body tethered to a fixed mount point with a stiff constraint + damping; a punch applies an impulse. This gives free, natural-looking wobble/recoil. Alternative: hand-rolled spring math — viable, but matter.js also gives us future ragdoll/knock-off-the-stand options cheaply.

5. **Squash-and-stretch is render-only, not physics.**
   On hit, a tween scales the head sprite (squash on impact axis, overshoot back). Keeping deformation out of the physics sim keeps the sim stable.

6. **Effects (particles, shake, sounds) via a lightweight event system.**
   A `punchLanded(strength, point)` event fans out to: particle spawner (stars + onomatopoeia text sprites), screen-shake (canvas transform offset with decay), sound player (Web Audio, pool of 3–4 comic hit sounds, pitch-randomized), damage system. Keeps effects decoupled and easy to add/tune.

7. **Damage overlays are pre-drawn sticker sprites keyed to hit-count thresholds.**
   Thresholds (e.g., 5/15/30/50 hits) progressively add stickers (black eye, bruise, band-aid, dizzy stars) at fixed anchor points relative to the face oval. Deterministic and cartoonish; no image processing of the user's photo.

8. **Sounds and art are original/permissively-licensed assets checked into `public/`.**
   Comic hit sounds synthesized or CC0; head/body/fist drawn as simple SVG/PNG sprites. No copyrighted game assets.

## Risks / Trade-offs

- [MediaPipe fails to detect a face (angle, lighting, cartoon input)] → Fallback: let the user manually position/scale an oval crop over their image; never dead-end the flow.
- [Model file size (~1 MB) slows first load] → Lazy-load the detector only when an image is chosen; show a short "finding the face…" state.
- [matter.js + React lifecycle leaks (double engines under StrictMode)] → Engine lives in a ref with explicit create/destroy in one effect; game loop owns all mutable state.
- [Audio blocked by browser autoplay policy] → Initialize AudioContext on first user gesture (the first punch), not on page load.
- [Uploading photos of real people could read as mean-spirited] → Locked-in cartoon tone: comic sounds, sticker damage, no blood; copy frames it as a stress-relief gag.

## Open Questions

- Punch input: keep both button and click-on-head for v1 (leaning yes — button is the requested feature, clicking is the intuitive one).
- Whether the dummy body should also react (wobble) or stay static in v1.
