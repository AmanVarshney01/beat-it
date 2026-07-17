import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GameScreen } from "@/components/game-screen";
import Loader from "@/components/loader";
import { ManualCrop } from "@/components/manual-crop";
import { UploadScreen } from "@/components/upload-screen";
import { buildSoftnessFromLandmarks } from "@/game/warp";
import { cropFaceOval, regionFromDetection, type OvalRegion } from "@/lib/face/crop";
import { detectFace, getFaceLandmarks } from "@/lib/face/detector";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

type Phase =
  | { name: "upload" }
  | { name: "detecting" }
  | { name: "manual"; image: HTMLImageElement }
  | { name: "game"; face: HTMLCanvasElement };

function HomeComponent() {
  const [phase, setPhase] = useState<Phase>({ name: "upload" });
  const [softness, setSoftness] = useState<Float32Array | null>(null);

  // enter the game immediately; the landmark-based flesh map upgrades the
  // deformation asynchronously when (and if) it resolves
  const startGame = (face: HTMLCanvasElement) => {
    setSoftness(null);
    setPhase({ name: "game", face });
    void getFaceLandmarks(face).then((landmarks) => {
      const map = landmarks ? buildSoftnessFromLandmarks(landmarks) : null;
      if (map) setSoftness(map);
    });
  };

  const handleImage = async (image: HTMLImageElement) => {
    setPhase({ name: "detecting" });
    try {
      const face = await detectFace(image);
      if (face) {
        startGame(cropFaceOval(image, regionFromDetection(face)));
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
    startGame(cropFaceOval(image, region));
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
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Loader />
          <p className="text-muted-foreground animate-pulse">Finding the face…</p>
        </div>
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
          softness={softness}
          onNewFace={() => setPhase({ name: "upload" })}
        />
      );
  }
}
