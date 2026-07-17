import { Button } from "@beat-it/ui/components/button";
import { useEffect, useRef, useState } from "react";

import { FACE_ASPECT, type OvalRegion } from "@/lib/face/crop";

/**
 * Fallback when detection finds no face: the user drags an oval over the
 * photo and scales it with the slider, then confirms.
 */
export function ManualCrop({
  image,
  onConfirm,
  onCancel,
}: {
  image: HTMLImageElement;
  onConfirm: (region: OvalRegion) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [center, setCenter] = useState({
    x: image.naturalWidth / 2,
    y: image.naturalHeight / 2,
  });
  const [rx, setRx] = useState(Math.min(image.naturalWidth, image.naturalHeight) * 0.25);
  const dragging = useRef(false);
  // canvas CSS px per image px, recomputed every draw
  const scaleRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const scale = Math.min(cssW / image.naturalWidth, cssH / image.naturalHeight);
    scaleRef.current = scale;
    const offX = (cssW - image.naturalWidth * scale) / 2;
    const offY = (cssH - image.naturalHeight * scale) / 2;

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(image, offX, offY, image.naturalWidth * scale, image.naturalHeight * scale);

    // dim everything outside the oval
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cssW, cssH);
    ctx.ellipse(
      offX + center.x * scale,
      offY + center.y * scale,
      rx * scale,
      rx * FACE_ASPECT * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill("evenodd");
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.rect(0, 0, cssW, cssH);
    ctx.ellipse(
      offX + center.x * scale,
      offY + center.y * scale,
      rx * scale,
      rx * FACE_ASPECT * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill("evenodd");
    ctx.restore();

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fff";
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.ellipse(
      offX + center.x * scale,
      offY + center.y * scale,
      rx * scale,
      rx * FACE_ASPECT * scale,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }, [image, center, rx]);

  const toImageCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    const offX = (rect.width - image.naturalWidth * scale) / 2;
    const offY = (rect.height - image.naturalHeight * scale) / 2;
    return {
      x: (e.clientX - rect.left - offX) / scale,
      y: (e.clientY - rect.top - offY) / scale,
    };
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
      <div className="space-y-1 text-center">
        <h2 className="text-2xl font-black">Couldn't find a face 😅</h2>
        <p className="text-muted-foreground text-sm">
          No problem — drag the oval over the face and hit confirm.
        </p>
      </div>

      <canvas
        ref={canvasRef}
        className="h-[55vh] w-full max-w-2xl cursor-move touch-none rounded-xl"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = toImageCoords(e);
          if (p) setCenter(p);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          const p = toImageCoords(e);
          if (p) {
            setCenter({
              x: Math.max(0, Math.min(image.naturalWidth, p.x)),
              y: Math.max(0, Math.min(image.naturalHeight, p.y)),
            });
          }
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
      />

      <label className="flex w-full max-w-sm items-center gap-3 text-sm">
        Size
        <input
          type="range"
          min={Math.min(image.naturalWidth, image.naturalHeight) * 0.08}
          max={Math.min(image.naturalWidth, image.naturalHeight) * 0.5}
          value={rx}
          onChange={(e) => setRx(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
        <Button
          size="lg"
          onClick={() =>
            onConfirm({ cx: center.x, cy: center.y, rx, ry: rx * FACE_ASPECT, angle: 0 })
          }
        >
          Use this face
        </Button>
      </div>
    </div>
  );
}
