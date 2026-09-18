import { NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import { getGoogleAccountStatus, disconnectGoogleAccount, isGoogleCalendarConfigured } from "@/lib/google-calendar";

export async function GET() {
  const userId = await getOwnerUserId();
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.json({ configured: false, connected: false });
  }
  const status = await getGoogleAccountStatus(userId);
  return NextResponse.json({ configured: true, ...status });
}

export async function DELETE() {
  const userId = await getOwnerUserId();
  await disconnectGoogleAccount(userId);
  return NextResponse.json({ ok: true });
}
