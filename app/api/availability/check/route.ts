import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import Settings from "@/models/Settings";
import { checkTimeAvailability } from "@/lib/availability";
import { availabilityCheckSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated endpoint used by the "Check availability" step
 * of the booking form. Given a date (and optionally a start/end time),
 * returns ONLY a yes/no + a short generic reason -- never client data,
 * fees, venues, or notes. This is the single source of truth clients see,
 * so they never have to guess between two slots: they just type the date
 * and time they actually want and get a real answer.
 */
export async function POST(req: NextRequest) {
  await connectToDatabase();

  const body = await req.json();
  const parsed = availabilityCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const owner = await User.findOne({ isOwner: true }).lean();
  if (!owner) {
    return NextResponse.json({ error: "Not configured yet" }, { status: 404 });
  }

  const settings = await Settings.findOne({ userId: owner._id }).lean();
  if (settings && settings.publicBookingEnabled === false) {
    return NextResponse.json({ error: "Public booking is currently disabled" }, { status: 403 });
  }

  const { date, startTime, endTime } = parsed.data;
  const result = await checkTimeAvailability(owner._id.toString(), date, startTime || undefined, endTime || undefined);

  return NextResponse.json(result);
}
