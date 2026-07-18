import { ImageUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { weaponImageUrl } from "@/game/face3d/assets";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const INPUT_ID = "face-photo-input";
const PREVIEW_WEAPONS = ["punch", "mallet", "tomato"] as const;

export function UploadScreen({
  onImage,
  onDemo,
}: {
  onImage: (image: HTMLImageElement) => void | Promise<void>;
  onDemo: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("That doesn't look like a photo.", {
        description: "Give me a JPEG, PNG or WebP with a face in it.",
      });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      void Promise.resolve(onImage(img)).finally(() => URL.revokeObjectURL(url));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Couldn't read that image — try another one.");
    };
    img.src = url;
  };

  return (
    <main
      id="main-content"
      className="relative isolate flex h-full min-h-0 items-start overflow-x-hidden overflow-y-auto px-5 py-8 text-white sm:px-8 lg:items-center lg:px-12 lg:py-10"
    >
      <div className="landing-grid pointer-events-none absolute inset-0 -z-20" />
      <div className="pointer-events-none absolute -top-48 -left-40 -z-10 size-[34rem] rounded-full bg-red-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-52 -bottom-64 -z-10 size-[38rem] rounded-full bg-amber-200/8 blur-[130px]" />

      <section className="mx-auto grid w-full max-w-6xl items-center gap-9 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="text-left">
          <p className="mb-5 flex items-center gap-2 text-[0.68rem] font-bold tracking-[0.22em] text-red-400 uppercase">
            <span className="size-1.5 rounded-full bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.9)]" />
            Browser-only stress dummy
          </p>
          <h1 className="brand-display text-[clamp(3rem,7.5vw,5.8rem)] leading-[0.95] text-balance uppercase">
            <span className="arcade-gradient-text">Beat</span>
            <br />
            <span className="arcade-gradient-text inline-block -rotate-2">it.</span>
          </h1>
          <p className="text-muted-foreground mt-8 max-w-md text-pretty text-lg leading-relaxed">
            Drop in a face. Pick a hit. Let the dummy take it. Every photo stays
            inside your browser.
          </p>

          <div className="mt-7 flex flex-wrap gap-2 text-xs font-semibold text-white/65">
            {["5 physical attacks", "Exact hit placement", "No sign-up"].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 backdrop-blur"
              >
                {item}
              </span>
            ))}
          </div>

          <div className="mt-9 hidden items-end gap-3 sm:flex" aria-hidden="true">
            {PREVIEW_WEAPONS.map((kind, index) => (
              <div
                key={kind}
                className="landing-weapon-tile"
                style={{ transform: `translateY(${index === 1 ? -8 : 0}px)` }}
              >
                <img src={weaponImageUrl(kind)} alt="" draggable={false} />
              </div>
            ))}
            <span className="mb-3 ml-2 text-xs leading-relaxed text-white/40">
              punch
              <br />
              splat
              <br />
              reset
            </span>
          </div>
        </div>

        <div className="upload-panel">
          <div className="mb-6 flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-white/40 uppercase">
                Start a session
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight">Choose the face</h2>
            </div>
            <span className="rounded-full border border-emerald-300/15 bg-emerald-300/8 px-2.5 py-1 text-[0.65rem] font-bold tracking-wide text-emerald-200/80 uppercase">
              Local
            </span>
          </div>

          {/* labels trigger the file input natively — no programmatic click needed */}
          <label
            htmlFor={INPUT_ID}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFile(e.dataTransfer.files[0]);
            }}
            className={`upload-dropzone ${dragging ? "is-dragging" : ""}`}
          >
            <span className="upload-icon-shell">
              <ImageUp className="size-7" strokeWidth={1.8} />
            </span>
            <span className="text-lg font-semibold">Drop a face photo</span>
            <span className="text-sm text-white/45">JPEG, PNG or WebP · max clarity works best</span>
          </label>

          <input
            id={INPUT_ID}
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <label
              htmlFor={INPUT_ID}
              className="landing-primary-action"
            >
              <ImageUp className="size-4" />
              Choose a face
            </label>
            <button
              type="button"
              onClick={onDemo}
              className="landing-secondary-action"
            >
              Try the demo
            </button>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-white/8 pt-5 text-left">
            <span className="privacy-pulse" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-white/40">
              Face detection and rendering happen on this device. Nothing is uploaded.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
