import { cache } from "react";
import connectToDatabase from "@/lib/mongodb";
import Settings from "@/models/Settings";

/**
 * Wrapped in React's `cache()` so that multiple server components rendered
 * during the *same* request (e.g. `app/(dashboard)/layout.tsx` and
 * `app/(dashboard)/page.tsx`, which both need Settings) share one DB call
 * instead of each firing their own. `cache()` only dedupes within a single
 * render pass -- it's not a cross-request cache, so data is still fresh on
 * every request.
 */
export const getOwnerSettings = cache(async (userId: string) => {
  await connectToDatabase();
  return Settings.findOne({ userId }).lean();
});
