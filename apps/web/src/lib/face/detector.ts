import type { FaceDetector, FaceLandmarker } from "@mediapipe/tasks-vision";

export interface DetectedFace {
  /** face bounding box in source-image pixels */
  box: { x: number; y: number; width: number; height: number };
  /** eye centers in source-image pixels (used to level the crop) */
  leftEye: { x: number; y: number };
  rightEye: { x: number; y: number };
}

let detectorPromise: Promise<FaceDetector> | null = null;

// Model + wasm are vendored in public/mediapipe so detection never talks to a
// third-party host and the uploaded image stays entirely in the browser.
async function getDetector(): Promise<FaceDetector> {
  detectorPromise ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" },
      runningMode: "IMAGE",
    });
  })();
  return detectorPromise;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function getLandmarker(): Promise<FaceLandmarker> {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task" },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })();
  return landmarkerPromise;
}

/**
 * 468 face landmarks in normalized [0,1] coords of the given canvas, or null
 * when no face is found (e.g. a manual crop of something that isn't a face).
 */
export async function getFaceLandmarks(
  face: HTMLCanvasElement,
): Promise<Array<{ x: number; y: number }> | null> {
  try {
    const landmarker = await getLandmarker();
    const result = landmarker.detect(face);
    const landmarks = result.faceLandmarks[0];
    return landmarks && landmarks.length > 0 ? landmarks : null;
  } catch (error) {
    console.warn("Face landmark detection unavailable", error);
    return null;
  }
}

/** Returns the highest-confidence face, or null if none was found. */
export async function detectFace(image: HTMLImageElement): Promise<DetectedFace | null> {
  const detector = await getDetector();
  const result = detector.detect(image);
  const best = result.detections
    .filter((d) => d.boundingBox)
    .sort((a, b) => (b.categories[0]?.score ?? 0) - (a.categories[0]?.score ?? 0))[0];
  if (!best?.boundingBox) return null;

  const { originX, originY, width, height } = best.boundingBox;
  // BlazeFace keypoints are normalized to the image; 0 = right eye, 1 = left eye.
  const kp = best.keypoints;
  const toPx = (p: { x: number; y: number }) => ({
    x: p.x * image.naturalWidth,
    y: p.y * image.naturalHeight,
  });
  const rightEye = kp[0] ? toPx(kp[0]) : { x: originX + width * 0.3, y: originY + height * 0.4 };
  const leftEye = kp[1] ? toPx(kp[1]) : { x: originX + width * 0.7, y: originY + height * 0.4 };

  return { box: { x: originX, y: originY, width, height }, leftEye, rightEye };
}
