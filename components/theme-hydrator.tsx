"use client";

import { useEffect } from "react";
import type { ThemeName } from "@/models/Settings";

export default function ThemeHydrator({ theme }: { theme: ThemeName }) {
  useEffect(() => {
    const stored = window.localStorage.getItem("vaishnavis-stage-theme");
    const resolved = (stored as ThemeName | null) ?? theme;
    document.documentElement.setAttribute("data-theme", resolved);
    window.localStorage.setItem("vaishnavis-stage-theme", resolved);
  }, [theme]);

  return null;
}
