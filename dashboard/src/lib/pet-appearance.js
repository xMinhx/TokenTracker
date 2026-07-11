import { normalizePetCharacter } from "./pet-personality.js";

// Clawd's SVG is cropped tightly to its painted bounds, while the generated atlas
// characters include transparent breathing room. Normalize the painted footprint
// without changing the user's small / medium / large window preset.
export const CLAWD_VISUAL_SCALE = 0.84;

export function petVisualScale(character) {
  return normalizePetCharacter(character) === "clawd" ? CLAWD_VISUAL_SCALE : 1;
}
