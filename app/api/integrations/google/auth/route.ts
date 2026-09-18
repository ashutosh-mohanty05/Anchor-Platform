import { NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar";

export async function GET() {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json(
      { error: "Google Calendar isn't configured yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI." },
      { status: 400 }
    );
  }
  // Single-owner app -- the userId itself doubles as the CSRF state value
  // the callback checks against.
  const userId = await getOwnerUserId();
  return NextResponse.redirect(getGoogleAuthUrl(userId));
}
