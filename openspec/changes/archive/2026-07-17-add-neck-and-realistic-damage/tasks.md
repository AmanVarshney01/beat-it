# Tasks: add-neck-and-realistic-damage

## 1. Damage painting

- [x] 1.1 Implement DamagePainter (working canvas, landmark/fallback anchors, seeded layered bruise painting, stage progression)
- [x] 1.2 Engine: use the painted canvas as the face source in both modes; repaint on stage change; Head3D texture refresh hook; retire sticker/band-aid overlay drawing (keep dizzy stars)

## 2. Neck

- [x] 2.1 Replace spring-coil drawing with a shaded skin-toned neck quad following the head

## 3. Verification

- [x] 3.1 Verify bruises wrap the 3D face at each threshold, neck follows recoil, 2D fallback still shows damage, reset restores pristine face; typecheck/build
