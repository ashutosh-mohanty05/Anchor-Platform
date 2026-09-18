import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import User from "@/models/User";
import BookingRequest from "@/models/BookingRequest";
import { bookingRequestSchema } from "@/lib/validations";
import { generateBookingReference, formatDateLong } from "@/lib/utils";
import { sendPushToOwner } from "@/lib/push";

/** Public: anyone can submit a booking request from /book. Never auto-approved. */
export async function POST(req: NextRequest) {
  await connectToDatabase();
  const body = await req.json();
  const parsed = bookingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Honeypot field caught a bot -- silently pretend success so bots don't
  // learn to route around it, but never persist their submission.
  if (parsed.data.website) {
    return NextResponse.json({ referenceId: generateBookingReference() }, { status: 201 });
  }

  const owner = await User.findOne({ isOwner: true }).lean();
  if (!owner) {
    return NextResponse.json({ error: "Booking is not available yet" }, { status: 404 });
  }

  const { website: _honeypot, ...data } = parsed.data;
  const referenceId = generateBookingReference();

  const booking = await BookingRequest.create({
    ...data,
    userId: owner._id,
    referenceId,
    status: "New",
  });

  // Scheduled via after() so it never delays the client's own submission,
  // and -- unlike a bare un-awaited promise -- is guaranteed to actually
  // finish running rather than risk getting cut off the instant the
  // response is sent back to the client's browser. Never blocks or fails
  // the booking itself if push isn't configured.
  after(() =>
    sendPushToOwner(owner._id.toString(), {
      title: "New booking request",
      body: `${booking.clientName} wants ${booking.eventType} on ${formatDateLong(booking.preferredDate)}.`,
      url: "/bookings",
      tag: `booking-${booking._id}`,
    }).catch(() => {})
  );

  return NextResponse.json(
    { referenceId: booking.referenceId, id: booking._id },
    { status: 201 }
  );
}

/** Private: Vaishnavi's dashboard list of booking requests. */
export async function GET(req: NextRequest) {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const query: Record<string, unknown> = { userId };
  if (status) query.status = status;

  const bookings = await BookingRequest.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ bookings });
}
