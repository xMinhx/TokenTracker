import { useCallback, useEffect, useState } from "react";
import {
  isNativeApp,
  isPetBridgeAvailable,
  onNativePetSettings,
  requestNativePetSettings,
  setNativePetSetting,
} from "../lib/native-bridge";
import { normalizePetCharacter } from "../lib/pet-personality";

const DEFAULTS = { visible: false, character: "clawd", size: "medium" };

export function usePetSettings() {
  const available = isNativeApp() && isPetBridgeAvailable();
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    if (!available) return undefined;
    const unsubscribe = onNativePetSettings((next) => {
      setSettings({
        visible: Boolean(next.visible),
        character: normalizePetCharacter(next.character),
        size: ["small", "medium", "large"].includes(next.size) ? next.size : "medium",
      });
    });
    requestNativePetSettings();
    return unsubscribe;
  }, [available]);

  // Always apply the optimistic local update so the page reflects the choice
  // immediately (and previews work on the plain web build); only the native
  // post is gated on bridge availability.
  const setSetting = useCallback((key, value) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (available) setNativePetSetting(key, value);
  }, [available]);

  return { available, settings, setSetting };
}
