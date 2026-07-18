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
      className="poster-ground relative isolate flex h-full min-h-0 items-start overflow-x-hidden overflow-y-auto px-5 py-8 sm:px-8 lg:items-center lg:px-12 lg:py-10"
    >
      <div className="landing-grid pointer-events-none absolute inset-0 -z-10" />

      <section className="mx-auto grid w-full max-w-6xl items-center gap-9 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16">
        <div className="relative text-left">
          <p className="mb-5 flex items-center gap-2 text-[0.7rem] font-extrabold tracking-[0.22em] uppercase">
            <span className="size-2 rounded-full border-2 border-[var(--ink)] bg-[var(--glove)]" />
            The face-punching booth
          </p>
          <h1 className="brand-display text-[clamp(3rem,7.5vw,5.8rem)] leading-[0.95] text-balance uppercase">
            Beat
            <br />
            <span className="inline-block -rotate-2 text-[var(--glove)]">it.</span>
          </h1>
          <div
            className="poster-burst absolute top-0 right-0 max-lg:hidden"
            aria-hidden="true"
          >
            100% local · no uploads
          </div>
          <p className="mt-8 max-w-md text-lg leading-relaxed font-medium text-pretty">
            Drop in a face. Pick a hit. Let the dummy take it. Every photo stays
            inside your browser.
          </p>

          <div className="mt-7 flex flex-wrap gap-2 text-xs">
            {["5 physical attacks", "Exact hit placement", "No sign-up"].map((item) => (
              <span key={item} className="landing-chip">
                {item}
              </span>
            ))}
          </div>

          <div className="mt-9 hidden items-end gap-3 sm:flex" aria-hidden="true">
            {PREVIEW_WEAPONS.map((kind, index) => (
              <div
                key={kind}
                className="landing-weapon-tile"
                style={{ rotate: `${[-3, 2, -1][index]}deg` }}
              >
                <img src={weaponImageUrl(kind)} alt="" draggable={false} />
              </div>
            ))}
            <span className="mb-3 ml-2 text-xs leading-relaxed font-bold opacity-60">
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
              <p className="text-xs font-extrabold tracking-[0.18em] uppercase opacity-55">
                Step right up
              </p>
              <h2 className="brand-display mt-1 text-xl uppercase">Load a face</h2>
            </div>
            <span className="rounded-md border-2 border-[var(--ink)] bg-[var(--poster)] px-2.5 py-1 text-[0.65rem] font-extrabold tracking-wide uppercase -rotate-3">
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
              <ImageUp className="size-7" strokeWidth={2.2} />
            </span>
            <span className="text-lg font-extrabold">Drop a face photo</span>
            <span className="text-sm font-medium opacity-55">
              JPEG, PNG or WebP · max clarity works best
            </span>
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

          <div className="mt-6 flex items-center gap-3 border-t-2 border-[var(--ink)]/15 pt-5 text-left">
            <span className="privacy-pulse" aria-hidden="true" />
            <p className="text-xs leading-relaxed font-medium opacity-55">
              Face detection and rendering happen on this device. Nothing is uploaded.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
