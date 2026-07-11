import { describe, expect, it } from "vitest";
import {
  normalizePetCharacter,
  pickPetAmbientState,
  resolvePetState,
} from "./pet-personality";

describe("pet personality", () => {
  it("normalizes unknown characters to Clawd", () => {
    expect(normalizePetCharacter("BYTE")).toBe("byte");
    expect(normalizePetCharacter("unknown")).toBe("clawd");
  });

  it("resolves live states in a stable priority order", () => {
    expect(resolvePetState({ rage: true, connected: false })).toBe("working-overheated");
    expect(resolvePetState({ connected: false, syncing: true })).toBe("disconnected");
    expect(resolvePetState({ syncing: true, celebrating: true })).toBe("working-typing");
    expect(resolvePetState({ celebrating: true, todayTokens: 10 })).toBe("happy");
    expect(resolvePetState({ todayTokens: 0, ambientState: "working-wizard" })).toBe("sleeping");
  });

  it("adds data-specific ambient actions without making them permanent", () => {
    const rich = { todayTokens: 2_500_000, streakDays: 8, topModels: [{}, {}, {}] };
    expect(pickPetAmbientState(rich, () => 0)).toBe("idle-living");
    expect(pickPetAmbientState(rich, () => 0.999)).toBe("working-wizard");
    expect(pickPetAmbientState({ todayTokens: 0 }, () => 0.5)).toBe("sleeping");
  });

});
