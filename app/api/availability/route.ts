import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import Settings from "@/models/Settings";
import { getPublicAvailability } from "@/lib/availability";
import { todayInIndia } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint used by /book. Returns ONLY one simple
 * available/booked status per day plus safe profile fields -- never
 * client data, fees, venues, or notes. See lib/availability.ts.
 */
export async function GET(req: NextRequest) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 42), 90);

  const owner = await User.findOne({ isOwner: true }).lean();
  if (!owner) {
    return NextResponse.json({ error: "Not configured yet" }, { status: 404 });
  }

  const settings = await Settings.findOne({ userId: owner._id }).lean();
  if (settings && settings.publicBookingEnabled === false) {
    return NextResponse.json({ error: "Public booking is currently disabled" }, { status: 403 });
  }

  const start = todayInIndia();
  const startDate = new Date(start + "T00:00:00Z");
  startDate.setUTCDate(startDate.getUTCDate() + days);
  const end = startDate.toISOString().slice(0, 10);

  const availability = await getPublicAvailability(owner._id.toString(), start, end);

  return NextResponse.json({
    profile: {
      displayName: settings?.displayName ?? "Vaishnavi",
      bio: settings?.bio ?? "Event Anchor | Host | Emcee",
      profileImage: settings?.profileImage ?? "",
      instagramUrl: settings?.instagramUrl ?? "",
      whatsappNumber: settings?.whatsappNumber ?? "",
    },
    availability,
  });
}
