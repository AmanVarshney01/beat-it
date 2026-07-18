import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GameScreen } from "@/components/game-screen";
import { ManualCrop } from "@/components/manual-crop";
import { UploadScreen } from "@/components/upload-screen";
import { preloadGameAssets } from "@/game/face3d/assets";
import type { Landmark3 } from "@/game/types";
import { cropFaceOval, regionFromDetection, type OvalRegion } from "@/lib/face/crop";
import { detectFace, getFaceLandmarks } from "@/lib/face/detector";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

type Phase =
  | { name: "upload" }
  | { name: "detecting" }
  | { name: "manual"; image: HTMLImageElement }
  | { name: "game"; face: HTMLCanvasElement; landmarks: Landmark3[] };

function HomeComponent() {
  const [phase, setPhase] = useState<Phase>({ name: "upload" });

  // Beat It now has one renderer: a valid landmark rig and authored 3D assets
  // are required before play begins.
  const startGame = async (face: HTMLCanvasElement) => {
    setPhase({ name: "detecting" });
    try {
      const [landmarks] = await Promise.all([
        getFaceLandmarks(face),
        preloadGameAssets(),
      ]);
      if (!landmarks || landmarks.length < 468) {
        throw new Error("A complete 3D face rig could not be resolved");
      }
      setPhase({ name: "game", face, landmarks });
    } catch (error) {
      console.error("3D rig preparation failed", error);
      toast.error("Couldn't build the 3D face. Try a clearer front-facing photo.");
      setPhase({ name: "upload" });
    }
  };

  const handleImage = async (image: HTMLImageElement) => {
    setPhase({ name: "detecting" });
    try {
      const face = await detectFace(image);
      if (face) {
        await startGame(cropFaceOval(image, regionFromDetection(face)));
      } else {
        setPhase({ name: "manual", image });
      }
    } catch (error) {
      console.error("Face detection failed", error);
      toast.info("Face detection couldn't run — position the face yourself.");
      setPhase({ name: "manual", image });
    }
  };

  const handleManualConfirm = (image: HTMLImageElement, region: OvalRegion) => {
    void startGame(cropFaceOval(image, region));
  };

  const loadDemoFace = () => {
    const img = new Image();
    img.onload = () => void handleImage(img);
    img.onerror = () => toast.error("Couldn't load the demo face — try uploading one.");
    img.src = "/demo-face.jpg";
  };

  // ?demo=1 deep-links straight into punching the bundled demo face
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("demo")) loadDemoFace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  switch (phase.name) {
    case "upload":
      return <UploadScreen onImage={handleImage} onDemo={loadDemoFace} />;
    case "detecting":
      return (
        <main
          id="main-content"
          className="poster-ground relative flex h-full flex-col items-center justify-center overflow-hidden px-6 text-center"
        >
          <div className="landing-grid pointer-events-none absolute inset-0" />
          <div className="face-scan" aria-hidden="true">
            <span className="face-scan-ring" />
            <span className="face-scan-ring face-scan-ring-inner" />
            <span className="face-scan-line" />
          </div>
          <p className="mt-8 text-xs font-extrabold tracking-[0.2em] text-[var(--glove)] uppercase">
            Building the rig
          </p>
          <h1 className="brand-display mt-2 text-xl uppercase">Finding the face</h1>
          <p className="mt-2 max-w-xs text-sm font-medium opacity-60">
            Mapping the eyes, cheeks and jaw for exact hit placement.
          </p>
          <span className="sr-only">Loading face detection</span>
        </main>
      );
    case "manual":
      return (
        <ManualCrop
          image={phase.image}
          onConfirm={(region) => handleManualConfirm(phase.image, region)}
          onCancel={() => setPhase({ name: "upload" })}
        />
      );
    case "game":
      return (
        <GameScreen
          face={phase.face}
          landmarks={phase.landmarks}
          onNewFace={() => setPhase({ name: "upload" })}
        />
      );
  }
}
