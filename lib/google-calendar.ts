import connectToDatabase from "./mongodb";
import GoogleAccount from "@/models/GoogleAccount";
import type { IEvent } from "@/models/Event";

/**
 * Google Calendar sync, implemented with plain `fetch` against Google's
 * REST endpoints (no `googleapis` dependency). This keeps every confirmed
 * event mirrored into Vaishnavi's own Google Calendar, so it shows up (and
 * reminds her) on every device she's signed into -- not just this app.
 *
 * Setup required (see .env.example):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
 * from a Google Cloud project with the Calendar API enabled and an OAuth
 * consent screen configured for http(s)://<your-domain>/api/integrations/google/callback.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to your environment (see .env.example).`);
  return value;
}

export function isGoogleCalendarConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

/**
 * Keeps the linked Google Calendar event in step with an event's current
 * status: push/update while Confirmed, remove if it stops being Confirmed
 * (cancelled, reverted to tentative, etc). Best-effort and never throws --
 * a failed sync should never block Vaishnavi's own save.
 *
 * Shared by every place an event can be created/updated -- the normal
 * event form, its PATCH endpoint, AND the voice/text assistant -- so a
 * show added or confirmed by voice ends up on her Google Calendar exactly
 * the same way one added by hand does. Returns whether a sync happened.
 */
export async function syncEventToGoogle(
  userId: string,
  event: IEvent & { _id: unknown; save: () => Promise<unknown> }
): Promise<boolean> {
  try {
    if (event.status === "Confirmed") {
      const googleEventId = await upsertGoogleCalendarEvent(userId, event, event.googleEventId || undefined);
      if (googleEventId) {
        if (googleEventId !== event.googleEventId) {
          event.googleEventId = googleEventId;
          await event.save();
        }
        return true;
      }
      return false;
    } else if (event.googleEventId) {
      await deleteGoogleCalendarEvent(userId, event.googleEventId);
      event.googleEventId = "";
      await event.save();
    }
    return false;
  } catch (err) {
    console.error("Google Calendar sync error:", err);
    return false;
  }
}

/** Step 1: send the browser here to ask for calendar access. */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // always return a refresh_token, even on reconnect
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Step 2: exchange the ?code= the callback received for tokens, and store them. */
export async function connectGoogleAccount(userId: string, code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`);
  }
  const tokens = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  await connectToDatabase();
  const existing = await GoogleAccount.findOne({ userId });

  // Google only sends refresh_token the first time consent is granted (or
  // when prompt=consent forces re-grant, which getGoogleAuthUrl always
  // does) -- fall back to the previous one if this exchange somehow omits it.
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Please disconnect and reconnect.");
  }

  let googleEmail = existing?.googleEmail ?? "";
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (profileRes.ok) {
      const profile = (await profileRes.json()) as { email?: string };
      googleEmail = profile.email ?? googleEmail;
    }
  } catch {
    // Non-critical -- just cosmetic for the settings screen.
  }

  await GoogleAccount.findOneAndUpdate(
    { userId },
    {
      $set: {
        accessToken: tokens.access_token,
        refreshToken,
        expiryDate: Date.now() + tokens.expires_in * 1000,
        googleEmail,
        calendarId: existing?.calendarId ?? "primary",
      },
    },
    { upsert: true }
  );
}

export async function disconnectGoogleAccount(userId: string): Promise<void> {
  await connectToDatabase();
  const account = await GoogleAccount.findOne({ userId });
  if (!account) return;
  // Best-effort revoke; never let a failed revoke block disconnecting locally.
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.refreshToken)}`, {
      method: "POST",
    });
  } catch {
    // ignore
  }
  await GoogleAccount.deleteOne({ userId });
}

export async function getGoogleAccountStatus(
  userId: string
): Promise<{ connected: boolean; googleEmail?: string }> {
  await connectToDatabase();
  const account = await GoogleAccount.findOne({ userId }).lean();
  if (!account) return { connected: false };
  return { connected: true, googleEmail: account.googleEmail };
}

/** Returns a valid access token, refreshing it first if it's expired/about to expire. */
async function getValidAccessToken(userId: string): Promise<string | null> {
  await connectToDatabase();
  const account = await GoogleAccount.findOne({ userId });
  if (!account) return null;

  if (account.expiryDate - Date.now() > 60_000) {
    return account.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: account.refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // Refresh token was revoked or expired -- the connection is dead;
    // caller should treat this event as "not synced" rather than crash.
    return null;
  }
  const tokens = (await res.json()) as { access_token: string; expires_in: number };
  account.accessToken = tokens.access_token;
  account.expiryDate = Date.now() + tokens.expires_in * 1000;
  await account.save();
  return account.accessToken;
}

function toGoogleDateTime(date: string, time: string): { dateTime: string; timeZone: string } {
  return { dateTime: `${date}T${time}:00`, timeZone: "Asia/Kolkata" };
}

type SyncableEvent = Pick<
  IEvent,
  "title" | "date" | "startTime" | "endTime" | "venueName" | "location" | "notes" | "clientName" | "clientPhone"
>;

/**
 * Create (or update, if already synced) the Google Calendar event for a
 * confirmed booking. Returns the Google event id to store on the event
 * document, or null if there's no connected Google account / the call
 * failed -- callers should treat this as best-effort, never blocking the
 * user's own save.
 */
export async function upsertGoogleCalendarEvent(
  userId: string,
  event: SyncableEvent,
  existingGoogleEventId?: string
): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return null;

  await connectToDatabase();
  const account = await GoogleAccount.findOne({ userId }).lean();
  if (!account) return null;

  const body = {
    summary: event.title,
    location: [event.venueName, event.location].filter(Boolean).join(", "),
    description: [
      event.notes || "",
      event.clientName ? `Client: ${event.clientName}` : "",
      event.clientPhone ? `Phone: ${event.clientPhone}` : "",
      "\nSynced automatically from Vaishnavi's Stage.",
    ]
      .filter(Boolean)
      .join("\n"),
    start: toGoogleDateTime(event.date, event.startTime),
    end: toGoogleDateTime(event.date, event.endTime),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 24 * 60 },
        { method: "popup", minutes: 2 * 60 },
      ],
    },
  };

  const url = existingGoogleEventId
    ? `${CALENDAR_API}/calendars/${encodeURIComponent(account.calendarId)}/events/${encodeURIComponent(existingGoogleEventId)}`
    : `${CALENDAR_API}/calendars/${encodeURIComponent(account.calendarId)}/events`;

  const res = await fetch(url, {
    method: existingGoogleEventId ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // If the previously-synced event was deleted on the Google side, fall
  // back to creating a fresh one instead of failing silently forever.
  if (res.status === 404 && existingGoogleEventId) {
    return upsertGoogleCalendarEvent(userId, event, undefined);
  }

  if (!res.ok) {
    console.error("Google Calendar sync failed:", await res.text());
    return null;
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function deleteGoogleCalendarEvent(userId: string, googleEventId: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return;

  await connectToDatabase();
  const account = await GoogleAccount.findOne({ userId }).lean();
  if (!account) return;

  try {
    await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(account.calendarId)}/events/${encodeURIComponent(googleEventId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch {
    // Best-effort -- never block the user's own delete/cancel on this.
  }
}
