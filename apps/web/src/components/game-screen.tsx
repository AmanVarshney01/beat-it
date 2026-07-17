import { Button } from "@beat-it/ui/components/button";
import { RotateCcw, Settings, UserRoundPlus, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Landmark3 } from "@/game/face3d/head3d";
import { type AttackKind, type GameSettings, type GameStats, PunchGame } from "@/game/engine";

const WEAPONS: Array<{ kind: AttackKind; glyph: string; label: string }> = [
  { kind: "punch", glyph: "🥊", label: "Punch" },
  { kind: "slap", glyph: "✋", label: "Slap" },
  { kind: "tomato", glyph: "🍅", label: "Tomato" },
  { kind: "egg", glyph: "🥚", label: "Egg" },
];

const SETTINGS_KEY = "beat-it-settings";

interface StoredSettings extends GameSettings {
  sound: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  sound: true,
  shake: true,
  particles: true,
  damage: true,
  dizzyStars: true,
  sway: true,
};

const SETTING_LABELS: Record<keyof StoredSettings, string> = {
  sound: "Sound effects",
  shake: "Screen shake",
  particles: "Stars & comic words",
  damage: "Damage marks",
  dizzyStars: "Dizzy stars",
  sway: "Idle head sway",
};

function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function GameScreen({
  face,
  landmarks,
  onNewFace,
}: {
  face: HTMLCanvasElement;
  landmarks: Landmark3[] | null;
  onNewFace: () => void;
}) {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<PunchGame | null>(null);
  const [stats, setStats] = useState<GameStats>({ hits: 0, combo: 0, damageStage: 0 });
  const [weapon, setWeapon] = useState<AttackKind>("punch");
  const [settings, setSettings] = useState<StoredSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const weaponRef = useRef(weapon);
  weaponRef.current = weapon;

  useEffect(() => {
    const bg = bgRef.current;
    const gl = glRef.current;
    const fg = fgRef.current;
    if (!bg || !gl || !fg) return;
    const game = new PunchGame({ bg, fg, gl, face, landmarks, onStats: setStats });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, [face, landmarks]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    const game = gameRef.current;
    if (!game) return;
    game.sounds.muted = !settings.sound;
    const { sound: _sound, ...engineSettings } = settings;
    game.updateSettings(engineSettings);
  }, [settings, face, landmarks]);

  const toggle = (key: keyof StoredSettings) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  const selected = WEAPONS.find((w) => w.kind === weapon) ?? WEAPONS[0]!;

  return (
    // fullscreen overlay above the app shell — the face is the whole show
    <div className="bg-background fixed inset-0 z-40 select-none overflow-hidden">
      {/* canvas sandwich: 2D background → WebGL head → 2D effects */}
      <canvas ref={bgRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={glRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas
        ref={fgRef}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={(e) => {
          const game = gameRef.current;
          if (!game) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          if (game.hitTestHead(point)) game.punch(point, weaponRef.current);
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
          aria-label={settings.sound ? "Mute" : "Unmute"}
          onClick={() => toggle("sound")}
        >
          {settings.sound ? <Volume2 /> : <VolumeX />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Settings"
          onClick={() => setShowSettings((s) => !s)}
        >
          <Settings />
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

      {/* settings panel */}
      {showSettings && (
        <div className="bg-background/95 border-border absolute top-16 right-4 z-10 w-64 space-y-1 rounded-xl border p-4 shadow-xl backdrop-blur">
          <h3 className="mb-2 font-black">Settings</h3>
          {(Object.keys(SETTING_LABELS) as Array<keyof StoredSettings>).map((key) => (
            <label
              key={key}
              className="hover:bg-muted flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
            >
              {SETTING_LABELS[key]}
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={() => toggle(key)}
                className="size-4 accent-red-600"
              />
            </label>
          ))}
        </div>
      )}

      {/* weapon picker */}
      <div className="absolute bottom-8 left-6 flex flex-col gap-2">
        {WEAPONS.map((w) => (
          <button
            key={w.kind}
            type="button"
            aria-label={w.label}
            title={w.label}
            onClick={() => setWeapon(w.kind)}
            className={`flex size-14 items-center justify-center rounded-2xl border-2 text-3xl transition-transform ${
              weapon === w.kind
                ? "border-red-600 bg-red-600/20 scale-110"
                : "border-border bg-background/70 hover:scale-105"
            }`}
          >
            {w.glyph}
          </button>
        ))}
      </div>

      {/* the big red button */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <button
          type="button"
          onPointerDown={() => gameRef.current?.punch(undefined, weaponRef.current)}
          className="rounded-full border-4 border-red-800 bg-red-600 px-10 py-5 text-2xl font-black text-white uppercase shadow-[0_6px_0_#7f1d1d] transition-transform active:translate-y-1 active:shadow-[0_2px_0_#7f1d1d]"
        >
          {selected.label} {selected.glyph}
        </button>
      </div>
    </div>
  );
}
