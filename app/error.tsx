"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <p className="font-display text-lg font-semibold text-foreground">Something went wrong</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Please try again in a moment.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
