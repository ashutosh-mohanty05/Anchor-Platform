import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import { connectGoogleAccount } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/settings?google=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/settings?google=error&reason=missing_code`);
  }

  const userId = await getOwnerUserId();
  try {
    await connectGoogleAccount(userId, code);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    return NextResponse.redirect(`${origin}/settings?google=error&reason=${encodeURIComponent(reason)}`);
  }

  return NextResponse.redirect(`${origin}/settings?google=connected`);
}
