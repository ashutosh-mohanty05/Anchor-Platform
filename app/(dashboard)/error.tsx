"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Catches errors thrown while rendering any dashboard page (most commonly a
 * transient MongoDB hiccup on the free Atlas tier) and offers a one-tap
 * retry instead of Next.js's default full-page crash screen. `reset()`
 * re-renders the segment without a full reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-lg font-semibold">Something didn&apos;t load right</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        This is usually a brief connection hiccup. Give it another try.
      </p>
      <Button onClick={() => reset()} className="mt-2">
        <RefreshCw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}
