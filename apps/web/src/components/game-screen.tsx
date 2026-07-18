import { Button } from "@beat-it/ui/components/button";
import { RotateCcw, Settings, UserRoundPlus, Volume2, VolumeX, X } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ReactionVoice } from "@/game/audio";
import { type AttackKind, type GameSettings, type GameStats, PunchGame } from "@/game/engine";
import { weaponImageUrl } from "@/game/face3d/assets";
import { GAME_BACKGROUNDS } from "@/game/face3d/backgrounds";
import type { PerformanceSnapshot } from "@/game/quality";
import type { GameBackground, Landmark3 } from "@/game/types";

declare global {
  interface Window {
    __beatItReview?: {
      performance: () => PerformanceSnapshot;
    };
  }
}

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
  background: "gym",
  capEnabled: false,
  capColor: "#c92f35",
  capText: "BEAT IT",
  shake: true,
  particles: true,
  damage: true,
  dizzyStars: true,
  sway: true,
};

type ToggleSetting = Exclude<
  keyof StoredSettings,
  "background" | "reactionVoice" | "capEnabled" | "capColor" | "capText"
>;

const SETTING_LABELS: Record<ToggleSetting, string> = {
  sound: "Sound effects",
  shake: "Screen shake",
  particles: "Impact particles",
  damage: "Damage marks",
  dizzyStars: "Dizzy stars",
  sway: "Idle head sway",
};

const REACTION_VOICES: readonly ReactionVoice[] = ["off", "female", "male"];
const CAP_COLOR_PRESETS = [
  { label: "Red", value: "#c92f35" },
  { label: "Blue", value: "#1e63d8" },
  { label: "Green", value: "#218c5b" },
  { label: "Yellow", value: "#f1c62d" },
  { label: "Black", value: "#17110f" },
  { label: "Cream", value: "#f5efe3" },
] as const;

function normalizeCapText(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 12);
}

function normalizeCapColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : DEFAULT_SETTINGS.capColor;
}

function capTextColor(hexColor: string) {
  const red = Number.parseInt(hexColor.slice(1, 3), 16);
  const green = Number.parseInt(hexColor.slice(3, 5), 16);
  const blue = Number.parseInt(hexColor.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 < 155
    ? "#fff7e6"
    : "#17110f";
}

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
    const background = GAME_BACKGROUNDS.some(
      (option) => option.kind === stored.background,
    )
      ? (stored.background as GameBackground)
      : DEFAULT_SETTINGS.background;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      background,
      reactionVoice,
      capEnabled:
        typeof stored.capEnabled === "boolean"
          ? stored.capEnabled
          : DEFAULT_SETTINGS.capEnabled,
      capColor: normalizeCapColor(stored.capColor),
      capText:
        typeof stored.capText === "string"
          ? normalizeCapText(stored.capText)
          : DEFAULT_SETTINGS.capText,
    };
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
  landmarks: Landmark3[];
  onNewFace: () => void;
}) {
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
    const gl = glRef.current;
    const fg = fgRef.current;
    if (!gl || !fg) return;
    let game: PunchGame;
    try {
      game = new PunchGame({ fg, gl, face, landmarks, onStats: setStats });
      gameRef.current = game;
      const reviewEnabled =
        import.meta.env.DEV ||
        new URLSearchParams(window.location.search).has("review");
      if (reviewEnabled) {
        window.__beatItReview = {
          performance: () => game.getPerformanceSnapshot(),
        };
        gl.dataset.performance = JSON.stringify(game.getPerformanceSnapshot());
      }
      const performanceInterval = reviewEnabled
        ? window.setInterval(() => {
            gl.dataset.performance = JSON.stringify(game.getPerformanceSnapshot());
          }, 500)
        : 0;
      return () => {
        if (performanceInterval) window.clearInterval(performanceInterval);
        delete gl.dataset.performance;
        delete window.__beatItReview;
        game.destroy();
        gameRef.current = null;
      };
    } catch (error) {
      console.error("3D game initialization failed", error);
      toast.error("This browser couldn't start the 3D game.");
      onNewFace();
      return;
    }
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
      {/* authored WebGL scene + lightweight 2D impact overlay */}
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
          <span className="pb-0.5 text-[0.64rem] font-extrabold tracking-[0.18em] uppercase opacity-55">
            hits
          </span>
        </div>
        <div className="mt-2 flex gap-1" aria-label={`Damage stage ${stats.damageStage} of 4`}>
          {[1, 2, 3, 4].map((stage) => (
            <span
              key={stage}
              className={`h-1.5 w-6 rounded-full border border-[var(--ink)] transition-colors duration-300 ${
                stats.damageStage >= stage ? "bg-[var(--glove)]" : "bg-[var(--ink)]/10"
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
          className="game-combo-pop pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
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
                <p className="text-[0.62rem] font-extrabold tracking-[0.18em] uppercase opacity-55">
                  Game feel
                </p>
                <h2 className="brand-display text-base uppercase">Settings</h2>
              </div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setShowSettings(false)}
                className="flex size-8 items-center justify-center rounded-md border-2 border-[var(--ink)] bg-[var(--canvas)] transition hover:bg-[var(--poster)] focus-visible:outline-3 focus-visible:outline-[var(--booth-blue)]"
              >
                <X className="size-4" />
              </button>
            </div>
            <fieldset className="game-background-fieldset">
              <legend>Stage</legend>
              <div className="grid grid-cols-2 gap-2">
                {GAME_BACKGROUNDS.map((option) => (
                  <button
                    key={option.kind}
                    type="button"
                    aria-pressed={settings.background === option.kind}
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        background: option.kind,
                      }))
                    }
                    className="game-background-button"
                  >
                    <span
                      className="game-background-swatch"
                      data-background={option.kind}
                      aria-hidden="true"
                    />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="game-cap-fieldset">
              <legend>Player cap</legend>
              <label className="game-cap-toggle">
                <span>
                  <strong>Wear a cap</strong>
                  <small>Moves with the 3D head</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.capEnabled}
                  onChange={() =>
                    setSettings((current) => ({
                      ...current,
                      capEnabled: !current.capEnabled,
                    }))
                  }
                  className="game-switch"
                />
              </label>
              <div
                className="game-cap-customizer"
                data-enabled={settings.capEnabled}
              >
                <div
                  className="game-cap-preview"
                  style={
                    {
                      "--cap-color": settings.capColor,
                      "--cap-ink": capTextColor(settings.capColor),
                    } as CSSProperties
                  }
                  aria-hidden="true"
                >
                  <span className="game-cap-preview-crown">
                    <span>{settings.capText.trim() || "YOUR NAME"}</span>
                  </span>
                </div>
                <div className="game-cap-fields">
                  <div className="game-cap-color-field">
                    <span>Color</span>
                    <span className="game-cap-color-control">
                      <input
                        type="color"
                        aria-label="Cap color"
                        value={settings.capColor}
                        disabled={!settings.capEnabled}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            capColor: normalizeCapColor(event.target.value),
                          }))
                        }
                        className="game-cap-color-input"
                      />
                      <span>{settings.capColor.toUpperCase()}</span>
                    </span>
                    <div className="game-cap-palette" aria-label="Cap color presets">
                      {CAP_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          aria-label={`Set cap color ${preset.label}`}
                          aria-pressed={settings.capColor === preset.value}
                          disabled={!settings.capEnabled}
                          onClick={() =>
                            setSettings((current) => ({
                              ...current,
                              capColor: preset.value,
                            }))
                          }
                          style={{ "--swatch-color": preset.value } as CSSProperties}
                        />
                      ))}
                    </div>
                  </div>
                  <label>
                    <span>Front text</span>
                    <input
                      type="text"
                      aria-label="Cap text"
                      value={settings.capText}
                      maxLength={12}
                      disabled={!settings.capEnabled}
                      placeholder="Your name"
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          capText: normalizeCapText(event.target.value),
                        }))
                      }
                      className="game-cap-text-input"
                    />
                  </label>
                </div>
              </div>
            </fieldset>
            <div className="mt-3 space-y-0.5 border-t-2 border-[var(--ink)]/15 pt-2">
              {(Object.keys(SETTING_LABELS) as ToggleSetting[]).map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors hover:bg-[var(--poster)]/40"
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
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors hover:bg-[var(--poster)]/40">
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
                  className="rounded-md border-2 border-[var(--ink)] bg-[var(--canvas)] px-2.5 py-1.5 text-xs font-bold capitalize outline-none focus-visible:outline-3 focus-visible:outline-[var(--booth-blue)]"
                >
                  <option value="off">Off</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
            </div>
            <p className="px-2 pt-2 text-[0.68rem] leading-relaxed font-medium opacity-55">
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
          <span className="text-[0.62rem] font-extrabold tracking-[0.2em] uppercase opacity-50">
            Selected
          </span>
          <span className="brand-display text-[0.68rem] tracking-wide uppercase">
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
