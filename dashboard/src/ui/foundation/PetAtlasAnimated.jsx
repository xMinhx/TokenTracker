import React, { useEffect, useMemo, useState } from "react";
import { normalizePetCharacter } from "../../lib/pet-personality.js";

const ROWS = {
  idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
  "running-right": { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  "running-left": { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
  waving: { row: 3, durations: [140, 140, 140, 280] },
  jumping: { row: 4, durations: [140, 140, 140, 140, 280] },
  failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
  waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
  running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
  review: { row: 8, durations: [150, 150, 150, 150, 150, 280] },
};

export function petAtlasRowForState(state) {
  if (["error", "disconnected", "working-overheated"].includes(state)) return "failed";
  if (["happy", "waking", "mini-happy", "jumping"].includes(state)) return "jumping";
  if (["working-typing", "working-ultrathink", "working-juggling", "running"].includes(state)) return "running";
  if (["working-thinking", "working-wizard", "review"].includes(state)) return "review";
  if (["sleeping", "idle-doze", "mini-sleep", "waiting"].includes(state)) return "waiting";
  if (["mini-peek", "waving"].includes(state)) return "waving";
  if (state === "running-left" || state === "running-right") return state;
  return "idle";
}

// Pause the frame timer while the page is hidden (background tab, or the Windows
// pet window after HidePet() — which hides rather than closes the WebView2 host),
// mirroring PetAtlasSpriteView's `paused: !isVisible` so an invisible pet never
// keeps waking the renderer.
function usePageVisible() {
  const [visible, setVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState !== "hidden";
  });
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const onChange = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

export function PetAtlasAnimated({ character, state = "idle-living", size = 48, className = "" }) {
  const id = normalizePetCharacter(character);
  const rowId = petAtlasRowForState(state);
  const row = ROWS[rowId];
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisible();
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (reducedMotion || !pageVisible) return undefined;
    let cancelled = false;
    let timer = 0;
    const advance = (current) => {
      timer = window.setTimeout(() => {
        if (cancelled) return;
        const next = (current + 1) % row.durations.length;
        setFrame(next);
        advance(next);
      }, row.durations[current]);
    };
    advance(0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [reducedMotion, pageVisible, row]);

  const style = useMemo(() => ({
    width: size * (192 / 208),
    height: size,
    backgroundImage: `url(/pets/${id}/spritesheet.webp)`,
    backgroundRepeat: "no-repeat",
    backgroundSize: "800% 900%",
    backgroundPosition: `${(frame / 7) * 100}% ${(row.row / 8) * 100}%`,
    imageRendering: "pixelated",
  }), [frame, id, row.row, size]);

  return <div aria-hidden="true" className={`pet-atlas-animated ${className}`} style={style} />;
}
