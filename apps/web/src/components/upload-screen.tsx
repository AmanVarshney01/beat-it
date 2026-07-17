import { Button } from "@beat-it/ui/components/button";
import { ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export function UploadScreen({ onImage }: { onImage: (image: HTMLImageElement) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error("That doesn't look like a photo 🤔", {
        description: "Give me a JPEG, PNG or WebP with a face in it.",
      });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => onImage(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast.error("Couldn't read that image — try another one.");
    };
    img.src = url;
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-2">
        <h1 className="text-5xl font-black tracking-tight">
          BEAT&nbsp;IT&nbsp;🥊
        </h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Upload a face, mount it on the dummy, punch your stress away. Photos never
          leave your browser — everything runs locally.
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
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
        className={`flex h-64 w-full max-w-lg cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-4 border-dashed transition-colors ${
          dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
        }`}
      >
        <ImageUp className="size-12" />
        <span className="text-lg font-semibold">Drop a face photo here</span>
        <span className="text-muted-foreground text-sm">or click to choose a file</span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <Button size="lg" onClick={() => inputRef.current?.click()}>
        Pick a photo
      </Button>
    </div>
  );
}
