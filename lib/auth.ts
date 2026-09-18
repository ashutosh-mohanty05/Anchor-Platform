import connectToDatabase from "./mongodb";
import User from "@/models/User";
import Settings from "@/models/Settings";

/**
 * This app has exactly one user: Vaishnavi herself. There is no login
 * screen and no session to check -- every request is treated as hers.
 *
 * We still keep a single "owner" User document because every other
 * collection (Event, Settings, BookingRequest, etc.) is keyed by userId.
 * The very first time the app runs, we lazily create that one owner
 * record and its default Settings; every call after that just reuses it.
 */
const OWNER_NAME = "Vaishnavi";
const OWNER_EMAIL = "vaishnavi@owner.local";

let cachedOwnerId: string | null = null;
let cachedOwnerVerifiedAt = 0;

// How long we trust a warm container's cached owner id before spending an
// extra round-trip re-checking it exists. This function runs at the top of
// nearly every page render and API call, so re-verifying on every single
// call (as opposed to periodically) was doubling the DB round-trips for
// the entire app -- a real, measurable source of sluggishness on every
// screen, not just an edge case. Five minutes is short enough to notice a
// wiped/reseeded database quickly, but long enough that a warm container
// serving normal traffic only pays for the check a handful of times an hour.
const OWNER_ID_TTL_MS = 5 * 60 * 1000;

export async function getOwnerUserId(): Promise<string> {
  await connectToDatabase();

  // Trust the cache, but verify it periodically -- this is a
  // per-process/module cache, and different API routes can be bundled
  // into separate serverless functions with their own warm containers. If
  // the database was ever reset or re-seeded (fresh Mongo cluster, wiped
  // collections, etc.) while one of those containers stayed warm, its
  // cached id would keep pointing at a user document that no longer
  // exists -- so every booking and event lookup made from that route
  // would silently 404 as "Not found" even though the record you're
  // looking at is right there in another tab. A periodic existence check
  // closes that gap without paying for it on every single request.
  if (cachedOwnerId) {
    const isFresh = Date.now() - cachedOwnerVerifiedAt < OWNER_ID_TTL_MS;
    if (isFresh) return cachedOwnerId;

    const stillExists = await User.exists({ _id: cachedOwnerId, isOwner: true });
    if (stillExists) {
      cachedOwnerVerifiedAt = Date.now();
      return cachedOwnerId;
    }
    cachedOwnerId = null;
  }

  let owner = await User.findOne({ isOwner: true });
  if (!owner) {
    try {
      owner = await User.create({
        name: OWNER_NAME,
        email: OWNER_EMAIL,
        isOwner: true,
      });
    } catch (err) {
      // Another concurrent cold start may have created the owner a moment
      // ago (the unique email index would reject our insert) -- re-fetch
      // instead of failing the request outright.
      owner = await User.findOne({ isOwner: true });
      if (!owner) throw err;
    }
  }

  const existingSettings = await Settings.findOne({ userId: owner._id });
  if (!existingSettings) {
    await Settings.create({ userId: owner._id });
  }

  cachedOwnerId = owner._id.toString();
  cachedOwnerVerifiedAt = Date.now();
  return cachedOwnerId;
}
