import React, { useEffect, useState } from "react";
import { MonitorUp, Zap } from "lucide-react";
import { ToggleSwitch, SegmentedControl } from "../components/settings/Controls.jsx";
import { usePetSettings } from "../hooks/use-pet-settings.js";
import { copy } from "../lib/copy";
import { cn } from "../lib/cn";
import { ClawdAnimated } from "../ui/foundation/ClawdAnimated.jsx";
import { FadeIn } from "../ui/foundation/FadeIn.jsx";

const CHARACTERS = [
  { id: "clawd", nameKey: "pet.character.clawd", descKey: "pet.character.clawd_desc", tint: "from-oai-amber-50 dark:from-orange-950/70" },
  { id: "sprout", nameKey: "pet.character.sprout", descKey: "pet.character.sprout_desc", tint: "from-oai-brand-100 dark:from-emerald-950/70" },
  { id: "byte", nameKey: "pet.character.byte", descKey: "pet.character.byte_desc", tint: "from-oai-gray-200 dark:from-slate-800/70" },
  { id: "ember", nameKey: "pet.character.ember", descKey: "pet.character.ember_desc", tint: "from-orange-100 dark:from-orange-950/80" },
];

const PREVIEW_STATES = [
  { id: "idle-living", labelKey: "pet.state.calm" },
  { id: "working-thinking", labelKey: "pet.state.focus" },
  { id: "working-juggling", labelKey: "pet.state.multitask" },
  { id: "working-wizard", labelKey: "pet.state.streak" },
  { id: "happy", labelKey: "pet.state.celebrate" },
  { id: "sleeping", labelKey: "pet.state.rest" },
];

function CharacterCard({ character, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500",
        selected
          ? "border-oai-brand-500/40 bg-white shadow-sm shadow-oai-brand-500/10 dark:border-oai-brand-500/25 dark:bg-oai-gray-900/80 dark:shadow-black/25"
          : "border-oai-gray-200/80 bg-white/55 hover:-translate-y-0.5 hover:border-oai-gray-400 dark:border-oai-gray-800 dark:bg-oai-gray-950/55 dark:hover:border-oai-gray-600",
      )}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-80 dark:opacity-55", character.tint)} />
      <div className="relative flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white/70 dark:bg-black/15">
          <ClawdAnimated state="idle-living" character={character.id} size={58} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-oai-black dark:text-white">{copy(character.nameKey)}</span>
            {selected ? <span className="h-1.5 w-1.5 rounded-full bg-oai-brand-500" aria-hidden /> : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
            {copy(character.descKey)}
          </p>
        </div>
      </div>
    </button>
  );
}

function PetStage({ character, state }) {
  const stateSpec = PREVIEW_STATES.find(function findState(item) {
    return item.id === state;
  });
  const stateLabel = copy(stateSpec?.labelKey || "pet.state.calm");
  return (
    <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-[28px] border border-oai-gray-200/70 bg-oai-gray-50 dark:border-oai-gray-800 dark:bg-oai-gray-950">
      <div
        className="absolute inset-0 opacity-[0.16] dark:opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(currentColor 0.7px, transparent 0.7px)", backgroundSize: "14px 14px" }}
        aria-hidden
      />
      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-black/5 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-oai-gray-600 backdrop-blur-md dark:border-white/10 dark:bg-black/20 dark:text-oai-gray-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
        {stateLabel}
      </div>
      <div className="relative flex h-48 w-48 items-center justify-center">
        <div className="absolute bottom-6 h-3 w-24 rounded-full bg-black/10 blur-sm dark:bg-black/35" aria-hidden />
        <ClawdAnimated state={state} character={character} size={176} />
      </div>
    </div>
  );
}

export function PetPage() {
  const { available, settings, setSetting } = usePetSettings();
  const [previewState, setPreviewState] = useState("idle-living");
  // Auto-cycle the preview until the user picks a state themselves — a manual
  // choice must stick, so the first click stops the rotation for this visit.
  const [autoRotate, setAutoRotate] = useState(true);
  const selectedCharacter = settings.character || "clawd";

  useEffect(() => {
    if (!autoRotate) return undefined;
    const timer = window.setInterval(() => {
      setPreviewState((current) => {
        const index = PREVIEW_STATES.findIndex((item) => item.id === current);
        return PREVIEW_STATES[(index + 1) % PREVIEW_STATES.length].id;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [autoRotate]);

  const sizeOptions = [
    { value: "small", label: copy("pet.size.small") },
    { value: "medium", label: copy("pet.size.medium") },
    { value: "large", label: copy("pet.size.large") },
  ];

  return (
    <div className="flex flex-1 flex-col font-oai text-oai-black antialiased dark:text-oai-white">
      <main className="flex-1 pb-14 pt-8 sm:pt-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <FadeIn y={12}>
            <header className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy("pet.page.title")}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-oai-gray-500 dark:text-oai-gray-400">
                {copy("pet.page.subtitle")}
              </p>
            </header>
          </FadeIn>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <FadeIn y={12} delay={0.04}>
              <PetStage character={selectedCharacter} state={previewState} />
              <div className="mt-3 flex flex-wrap gap-2" aria-label={copy("pet.preview.states") }>
                {PREVIEW_STATES.map((state) => (
                  <button
                    key={state.id}
                    type="button"
                    onClick={() => {
                      setAutoRotate(false);
                      setPreviewState(state.id);
                    }}
                    aria-pressed={previewState === state.id}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand-500",
                      previewState === state.id
                        ? "bg-oai-black text-white dark:bg-white dark:text-black"
                        : "bg-oai-gray-100 text-oai-gray-600 hover:bg-oai-gray-200 dark:bg-oai-gray-900 dark:text-oai-gray-300 dark:hover:bg-oai-gray-800",
                    )}
                  >
                    {copy(state.labelKey)}
                  </button>
                ))}
              </div>
            </FadeIn>

            <FadeIn y={12} delay={0.08}>
              <div className="rounded-2xl border border-oai-gray-200 bg-white/70 p-5 dark:border-oai-gray-800 dark:bg-oai-gray-900/60">
                <div className="flex items-center gap-2">
                  <MonitorUp className="h-4 w-4 text-oai-gray-500" aria-hidden />
                  <h2 className="text-sm font-semibold">{copy("pet.controls.title")}</h2>
                </div>
                <div className="mt-5 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm">{copy("pet.controls.show")}</div>
                      <div className="mt-0.5 text-xs text-oai-gray-500">{copy("pet.controls.show_hint")}</div>
                    </div>
                    <ToggleSwitch
                      checked={settings.visible}
                      onChange={() => setSetting("visible", !settings.visible)}
                      disabled={!available}
                      ariaLabel={copy("pet.controls.show")}
                    />
                  </div>
                  <div className="h-px bg-oai-gray-200/70 dark:bg-oai-gray-800" />
                  <div>
                    <div className="mb-2 text-sm">{copy("pet.controls.size")}</div>
                    <SegmentedControl
                      options={sizeOptions}
                      value={settings.size}
                      onChange={(value) => setSetting("size", value)}
                      disabled={!available}
                    />
                  </div>
                  {!available ? (
                    <div className="flex gap-2 rounded-xl bg-oai-gray-100 p-3 text-xs leading-relaxed text-oai-gray-500 dark:bg-oai-gray-800/70 dark:text-oai-gray-400">
                      <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {copy("pet.controls.native_only")}
                    </div>
                  ) : null}
                </div>
              </div>
            </FadeIn>
          </div>

          <FadeIn y={12} delay={0.12}>
            <section className="mt-10" aria-labelledby="pet-character-title">
              <div className="mb-4">
                <h2 id="pet-character-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {copy("pet.characters.title")}
                </h2>
                <p className="mt-1 text-sm text-oai-gray-500 dark:text-oai-gray-400">{copy("pet.characters.subtitle")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {CHARACTERS.map((character) => (
                  <CharacterCard
                    key={character.id}
                    character={character}
                    selected={selectedCharacter === character.id}
                    onSelect={() => setSetting("character", character.id)}
                  />
                ))}
              </div>
            </section>
          </FadeIn>
        </div>
      </main>
    </div>
  );
}
