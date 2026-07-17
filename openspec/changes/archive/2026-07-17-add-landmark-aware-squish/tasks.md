# Tasks: add-landmark-aware-squish

## 1. Landmarks

- [x] 1.1 Vendor face_landmarker.task model; add lazy FaceLandmarker singleton and getFaceLandmarks(faceCanvas)

## 2. Softness map

- [x] 2.1 Build per-vertex softness from anchor landmarks (cheeks/chin soft, forehead stiff); procedural fallback map
- [x] 2.2 Apply softness to dent impulse; add radial ring bulge around impacts

## 3. Plumbing & verification

- [x] 3.1 Compute softness after crop (both auto and manual paths) and pass through GameScreen into PunchGame
- [x] 3.2 Verify cheek-vs-forehead difference, bulge, and fallback; typecheck/build passes
