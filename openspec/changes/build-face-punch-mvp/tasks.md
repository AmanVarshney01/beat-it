# Tasks: build-face-punch-mvp

## 1. Project Scaffold

- [ ] 1.1 Scaffold Vite + React + TypeScript app in repo root (package.json, vite.config, tsconfig, index.html, src/main.tsx, src/App.tsx)
- [ ] 1.2 Add dependencies: matter-js (+ @types/matter-js), @mediapipe/tasks-vision
- [ ] 1.3 Set up app shell: screen state machine (upload → detecting → manual-crop → game), base styles/layout, comic-style theme
- [ ] 1.4 Verify dev server runs and typecheck/build passes

## 2. Face Upload & Detection (face-upload spec)

- [ ] 2.1 Build upload screen with file picker + drag-and-drop, image-type validation, friendly errors
- [ ] 2.2 Vendor MediaPipe face detector model into public/ and lazy-load FaceDetector on first upload
- [ ] 2.3 Run detection on the uploaded image; pick highest-confidence face; extract bounding box + eye keypoints
- [ ] 2.4 Implement oval crop: rotate via eye line, apply oval alpha mask + cartoon outline, cache as offscreen bitmap
- [ ] 2.5 Implement manual oval-crop fallback UI (drag/scale oval, confirm) for zero-detection case
- [ ] 2.6 Verify no network requests carry image data (all processing local)

## 3. Game Scene & Physics (game-scene spec)

- [ ] 3.1 Create canvas scene component with rAF render loop and resize handling
- [ ] 3.2 Draw cartoon dummy (body + head sprites) with face bitmap composited on the head
- [ ] 3.3 Set up matter.js engine: head circle body tethered to mount with stiff damped constraint; idle bob at rest
- [ ] 3.4 Wire physics → render (head position/rotation from body each frame); confirm smooth 60fps
- [ ] 3.5 Add "new face" control that returns to upload and clears face + damage state

## 4. Punch Interaction (punch-interaction spec)

- [ ] 4.1 Add punch button in scene UI and click/tap-on-head hit detection
- [ ] 4.2 Implement fist sprite animation (enter → contact → retract, ≤300ms, interruptible/restartable)
- [ ] 4.3 On contact, apply impulse to head body at impact point scaled by punch strength
- [ ] 4.4 Emit punchLanded(strength, point) event on contact; ensure rapid mashing drops no inputs

## 5. Feedback Juice (feedback-juice spec)

- [ ] 5.1 Implement squash-and-stretch tween on head sprite along impact axis (render-only, ~250ms)
- [ ] 5.2 Implement screen shake (strength-scaled canvas offset with fast decay, ~300ms)
- [ ] 5.3 Implement particle system: star bursts + random onomatopoeia text sprites at impact point
- [ ] 5.4 Add comic hit sounds (CC0/synthesized pool) via Web Audio with pitch randomization; init context on first gesture
- [ ] 5.5 Add mute toggle (session-persistent)

## 6. Damage Progression (damage-progression spec)

- [ ] 6.1 Implement hit counter state + display
- [ ] 6.2 Implement combo tracking (~1s window, reset on lapse) with escalating "Nx COMBO!" display
- [ ] 6.3 Create cartoon damage sticker sprites (black eye, bruise, band-aid, dizzy stars)
- [ ] 6.4 Apply stickers at hit thresholds (5/15/30/50) anchored to face oval; cap at max damage state
- [ ] 6.5 Add reset control: clear overlays and counters without re-upload

## 7. Polish & Verification

- [ ] 7.1 Mobile/touch pass: tap punching, responsive layout, performance on mobile
- [ ] 7.2 Walk every spec scenario end-to-end (upload happy path, no-face fallback, mashing, mute, thresholds, reset, new-face)
- [ ] 7.3 Final typecheck + production build
