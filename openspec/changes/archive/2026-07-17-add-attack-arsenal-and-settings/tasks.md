# Tasks: add-attack-arsenal-and-settings

## 1. Damage rework

- [x] 1.1 Rework DamagePainter to mark lists: bruise add-or-deepen at UV point, tomato/egg splat painting, caps, clear
- [x] 1.2 Engine: convert impact point to texture UV per hit and paint located damage (bruise vs splat by attack)

## 2. Attacks

- [x] 2.1 Add attack kinds with per-type spawn/animation (slap side sweep, food bottom arc with spin), impulse, spin/yaw
- [x] 2.2 Add slap and splat synthesized sounds
- [x] 2.3 Weapon picker UI; button + head taps use the selected attack

## 3. Settings

- [x] 3.1 Settings panel (gear) with toggles: sound, shake, particles, damage, dizzy stars, sway; localStorage persistence
- [x] 3.2 Engine gating for each toggle; Head3D sway toggle

## 4. Verification

- [x] 4.1 Verify each attack's feel + located damage in browser, settings toggles and persistence, reset clears marks; typecheck/build
