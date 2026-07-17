import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { GameScreen } from "@/components/game-screen";
import Loader from "@/components/loader";
import { ManualCrop } from "@/components/manual-crop";
import { UploadScreen } from "@/components/upload-screen";
import { cropFaceOval, regionFromDetection, type OvalRegion } from "@/lib/face/crop";
import { detectFace } from "@/lib/face/detector";

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

  const handleImage = async (image: HTMLImageElement) => {
    setPhase({ name: "detecting" });
    try {
      const face = await detectFace(image);
      if (face) {
        setPhase({ name: "game", face: cropFaceOval(image, regionFromDetection(face)) });
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
    setPhase({ name: "game", face: cropFaceOval(image, region) });
  };

  switch (phase.name) {
    case "upload":
      return <UploadScreen onImage={handleImage} />;
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
      return <GameScreen face={phase.face} onNewFace={() => setPhase({ name: "upload" })} />;
  }
}
