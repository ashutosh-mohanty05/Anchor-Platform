"use client";

import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { THEMES } from "@/lib/constants";
import type { ThemeName } from "@/models/Settings";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const THEME_META: Record<ThemeName, { label: string; blurb: string; swatch: string }> = {
  rose: { label: "Rose", blurb: "Elegant & warm", swatch: "linear-gradient(135deg,#f6c9d6,#f2a5bd)" },
  lavender: { label: "Lavender", blurb: "Calm & creative", swatch: "linear-gradient(135deg,#e3d6f7,#c6a8ec)" },
  sky: { label: "Sky", blurb: "Fresh & minimal", swatch: "linear-gradient(135deg,#cdeafe,#8fd0f2)" },
  cream: { label: "Cream", blurb: "Classic & clean", swatch: "linear-gradient(135deg,#faf1de,#e9cfa3)" },
  midnight: { label: "Midnight", blurb: "Bold & focused", swatch: "linear-gradient(135deg,#2c2350,#4a3a7a)" },
};

export default function ThemeSwitcher({ initialTheme }: { initialTheme: ThemeName }) {
  const { theme, setTheme } = useTheme(initialTheme);

  return (
    <div className="space-y-2">
      {THEMES.map((t) => {
        const meta = THEME_META[t];
        const active = theme === t;
        return (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
              active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
            )}
          >
            <span
              className="h-10 w-10 shrink-0 rounded-full border border-border"
              style={{ background: meta.swatch }}
            />
            <span className="flex-1">
              <span className="block text-sm font-semibold">{meta.label}</span>
              <span className="block text-xs text-muted-foreground">{meta.blurb}</span>
            </span>
            {active && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-primary">
                <Check className="h-5 w-5" />
              </motion.span>
            )}
          </button>
        );
      })}
      <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Theme changes instantly and syncs across your devices.
      </p>
    </div>
  );
}
