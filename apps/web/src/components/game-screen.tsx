import { Button } from "@beat-it/ui/components/button";
import { RotateCcw, UserRoundPlus, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type GameStats, PunchGame } from "@/game/engine";

export function GameScreen({
  face,
  onNewFace,
}: {
  face: HTMLCanvasElement;
  onNewFace: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PunchGame | null>(null);
  const [stats, setStats] = useState<GameStats>({ hits: 0, combo: 0, damageStage: 0 });
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = new PunchGame(canvas, face, setStats);
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, [face]);

  useEffect(() => {
    if (gameRef.current) gameRef.current.sounds.muted = muted;
  }, [muted]);

  return (
    <div className="relative h-full select-none overflow-hidden">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        onPointerDown={(e) => {
          const game = gameRef.current;
          if (!game) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          if (game.hitTestHead(point)) game.punch(point);
        }}
      />

      {/* HUD: counters */}
      <div className="pointer-events-none absolute top-4 left-4 space-y-1">
        <div className="text-3xl font-black tabular-nums">
          {stats.hits} <span className="text-base font-bold">HITS</span>
        </div>
        {stats.combo >= 2 && (
          <div
            key={stats.combo}
            className="animate-in zoom-in text-2xl font-black text-orange-500 duration-150"
            style={{ fontSize: `${Math.min(2.6, 1.4 + stats.combo * 0.06)}rem` }}
          >
            {stats.combo}x COMBO!
          </div>
        )}
      </div>

      {/* HUD: controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? <VolumeX /> : <Volume2 />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Reset damage"
          onClick={() => gameRef.current?.reset()}
        >
          <RotateCcw />
        </Button>
        <Button variant="outline" onClick={onNewFace}>
          <UserRoundPlus data-icon="inline-start" />
          New face
        </Button>
      </div>

      {/* the big red button */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button
          type="button"
          onPointerDown={() => gameRef.current?.punch()}
          className="rounded-full border-4 border-red-800 bg-red-600 px-10 py-5 text-2xl font-black text-white shadow-[0_6px_0_#7f1d1d] transition-transform active:translate-y-1 active:shadow-[0_2px_0_#7f1d1d]"
        >
          PUNCH 🥊
        </button>
      </div>
    </div>
  );
}
