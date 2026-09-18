"use client";

import { useCallback, useEffect, useState } from "react";
import type { ThemeName } from "@/models/Settings";

const STORAGE_KEY = "vaishnavis-stage-theme";
const DEFAULT_THEME: ThemeName = "rose";

/**
 * Applies the theme to <html data-theme="...">, persists it in
 * localStorage for instant restores, and (best-effort) syncs it to
 * MongoDB via PATCH /api/settings so it follows the signed-in user
 * across devices. Reading the saved value from Mongo happens once on
 * the server (dashboard layout) and is passed in as `initialTheme`.
 */
export function useTheme(initialTheme?: ThemeName) {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme ?? DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    const resolved = initialTheme ?? stored ?? DEFAULT_THEME;
    setThemeState(resolved);
    document.documentElement.setAttribute("data-theme", resolved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: ThemeName, persistRemote = true) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);

    if (persistRemote) {
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      }).catch(() => {
        // Non-fatal: the theme still persists locally via localStorage.
      });
    }
  }, []);

  return { theme, setTheme };
}
