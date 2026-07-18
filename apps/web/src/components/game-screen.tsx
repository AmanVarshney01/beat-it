import { Button } from "@beat-it/ui/components/button";
import { RotateCcw, Settings, UserRoundPlus, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ReactionVoice } from "@/game/audio";
import { type AttackKind, type GameSettings, type GameStats, PunchGame } from "@/game/engine";
import { weaponImageUrl } from "@/game/face3d/assets";
import type { Landmark3 } from "@/game/types";

const WEAPONS: Array<{ kind: AttackKind; label: string }> = [
  { kind: "punch", label: "Punch" },
  { kind: "slap", label: "Slap" },
  { kind: "mallet", label: "Mallet" },
  { kind: "tomato", label: "Tomato" },
  { kind: "egg", label: "Egg" },
];

const SETTINGS_KEY = "beat-it-settings";

interface StoredSettings extends GameSettings {
  sound: boolean;
  reactionVoice: ReactionVoice;
}

const DEFAULT_SETTINGS: StoredSettings = {
  sound: true,
  reactionVoice: "female",
  shake: true,
  particles: true,
  damage: true,
  dizzyStars: true,
  sway: true,
};

type ToggleSetting = Exclude<keyof StoredSettings, "reactionVoice">;

const SETTING_LABELS: Record<ToggleSetting, string> = {
  sound: "Sound effects",
  shake: "Screen shake",
  particles: "Impact particles",
  damage: "Damage marks",
  dizzyStars: "Dizzy stars",
  sway: "Idle head sway",
};

const REACTION_VOICES: readonly ReactionVoice[] = ["off", "female", "male"];

function loadSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return {
        ...DEFAULT_SETTINGS,
        shake: !reduceMotion,
        sway: !reduceMotion,
      };
    }
    const stored = JSON.parse(raw) as Partial<StoredSettings>;
    const reactionVoice = REACTION_VOICES.includes(stored.reactionVoice as ReactionVoice)
      ? (stored.reactionVoice as ReactionVoice)
      : DEFAULT_SETTINGS.reactionVoice;
    return { ...DEFAULT_SETTINGS, ...stored, reactionVoice };
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
  const selectedWeapon = WEAPONS.find((item) => item.kind === weapon) ?? WEAPONS[0]!;

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
    const { sound, reactionVoice, ...engineSettings } = settings;
    game.sounds.reactionVoice = reactionVoice;
    game.sounds.muted = !sound;
    game.updateSettings(engineSettings);
  }, [settings, face, landmarks]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key === "Escape") {
        setShowSettings(false);
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        gameRef.current?.punch(undefined, weaponRef.current);
        return;
      }
      const shortcut = Number(event.key);
      const nextWeapon = WEAPONS[shortcut - 1];
      if (nextWeapon) setWeapon(nextWeapon.kind);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggle = (key: ToggleSetting) =>
    setSettings((s) => ({ ...s, [key]: !s[key] }));

  return (
    // fullscreen overlay above the app shell — the face is the whole show
    <main
      id="main-content"
      className="fixed inset-0 z-40 select-none overflow-hidden bg-[#0d0d10]"
    >
      {/* canvas sandwich: 2D background → WebGL head → 2D effects */}
      <canvas ref={bgRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={glRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={fgRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div
        data-testid="hit-surface"
        className="absolute inset-0 z-0 touch-none cursor-default"
        onPointerDown={(e) => {
          const game = gameRef.current;
          if (!game) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
          if (game.hitTestHead(point)) game.punch(point, weaponRef.current);
        }}
      />

      {/* HUD: counters */}
      <div
        className="game-stat-card pointer-events-none absolute z-20"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex items-end gap-2">
          <span
            key={stats.hits}
            className="arcade-num animate-in zoom-in text-4xl leading-none tabular-nums duration-150"
          >
            {stats.hits}
          </span>
          <span className="pb-0.5 text-[0.64rem] font-bold tracking-[0.18em] text-white/45 uppercase">
            hits
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-label={`Damage stage ${stats.damageStage} of 4`}>
          {[1, 2, 3, 4].map((stage) => (
            <span
              key={stage}
              className={`h-1 w-6 rounded-full transition-colors duration-300 ${
                stats.damageStage >= stage ? "bg-red-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>
      </div>

      {/* combo takes center stage, like it deserves */}
      {stats.combo >= 2 && (
        <div
          key={stats.combo}
          aria-hidden="true"
          className="game-combo-pop arcade-gradient-text pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
          style={{ fontSize: `${Math.min(6.5, 2 + stats.combo * 0.22)}rem` }}
        >
          {stats.combo}x combo
        </div>
      )}

      {/* HUD: controls */}
      <div className="game-control-rail absolute z-40 flex gap-1.5">
        <Button
          variant="outline"
          size="icon"
          aria-label={settings.sound ? "Mute" : "Unmute"}
          aria-pressed={!settings.sound}
          onClick={() => toggle("sound")}
          className="game-control-button"
        >
          {settings.sound ? <Volume2 /> : <VolumeX />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Settings"
          aria-expanded={showSettings}
          aria-controls="game-settings"
          onClick={() => setShowSettings((s) => !s)}
          className="game-control-button"
        >
          <Settings />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Reset damage"
          onClick={() => gameRef.current?.reset()}
          className="game-control-button"
        >
          <RotateCcw />
        </Button>
        <Button
          variant="outline"
          onClick={onNewFace}
          className="game-control-button px-3 sm:px-3.5"
        >
          <UserRoundPlus data-icon="inline-start" />
          <span className="hidden sm:inline">New face</span>
        </Button>
      </div>

      {/* settings panel */}
      {showSettings && (
        <>
          <button
            type="button"
            aria-label="Close settings"
            className="absolute inset-0 z-30 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setShowSettings(false)}
          />
          <section
            id="game-settings"
            aria-label="Game settings"
            className="game-settings-panel"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[0.62rem] font-bold tracking-[0.18em] text-white/35 uppercase">
                  Game feel
                </p>
                <h2 className="text-lg font-bold tracking-tight">Settings</h2>
              </div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setShowSettings(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              {(Object.keys(SETTING_LABELS) as ToggleSetting[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/5"
                >
                  {SETTING_LABELS[key]}
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={() => toggle(key)}
                    className="game-switch"
                  />
                </label>
              ))}
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-white/5">
                Reaction voice
                <select
                  aria-label="Reaction voice"
                  value={settings.reactionVoice}
                  onChange={(event) => {
                    const reactionVoice = event.target.value as ReactionVoice;
                    setSettings((current) => ({ ...current, reactionVoice }));
                    if (reactionVoice === "off") {
                      gameRef.current?.sounds.stopVoice();
                    } else {
                      gameRef.current?.sounds.previewReactionVoice(reactionVoice);
                    }
                  }}
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold capitalize outline-none focus:border-red-400/60"
                >
                  <option value="off">Off</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
            </div>
            <p className="px-2 pt-2 text-[0.68rem] leading-relaxed text-white/35">
              Voices stay short and never stack during rapid hits.
            </p>
          </section>
        </>
      )}

      {stats.hits === 0 && !showSettings && (
        <div className="game-hint pointer-events-none absolute left-1/2 z-20 -translate-x-1/2">
          <span className="game-hint-dot" />
          Tap the face · space to swing
        </div>
      )}

      {/* the big red button — every arcade needs one (Space works too) */}
      <button
        type="button"
        aria-keyshortcuts="Space"
        onPointerDown={(e) => {
          e.stopPropagation();
          gameRef.current?.punch(undefined, weaponRef.current);
        }}
        className="game-attack-button absolute z-30 max-sm:right-3 max-sm:bottom-[8.2rem] max-sm:px-6 max-sm:py-3.5 max-sm:text-lg"
      >
        Hit!
      </button>

      {/* weapon picker */}
      <div className="game-weapon-dock absolute z-30">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className="text-[0.62rem] font-bold tracking-[0.2em] text-white/35 uppercase">
            Selected
          </span>
          <span className="text-[0.68rem] font-bold tracking-wide text-white/75 uppercase">
            {selectedWeapon.label}
          </span>
        </div>
        <div className="flex gap-1.5">
          {WEAPONS.map((item, index) => (
            <button
              key={item.kind}
              type="button"
              aria-label={item.label}
              aria-pressed={weapon === item.kind}
              aria-keyshortcuts={`${index + 1}`}
              title={`${item.label} · ${index + 1}`}
              onClick={() => setWeapon(item.kind)}
              className={`game-weapon-button ${
                weapon === item.kind ? "is-selected" : ""
              }`}
            >
              <span className="game-weapon-shortcut" aria-hidden="true">
                {index + 1}
              </span>
              <img
                src={weaponImageUrl(item.kind)}
                alt=""
                className="size-9 object-contain"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
