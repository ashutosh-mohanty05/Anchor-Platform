import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import BookingRequest from "@/models/BookingRequest";
import Event from "@/models/Event";
import Settings from "@/models/Settings";

/**
 * Public: a client checks their own booking status with their reference ID
 * (and phone, as a light lookup guard). Only ever returns fields that are
 * safe to show the person who submitted the request -- never other
 * clients' data, private notes, or fees.
 */
export async function GET(req: NextRequest) {
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref")?.trim().toUpperCase();
  const phone = searchParams.get("phone")?.replace(/[^\d]/g, "");

  if (!ref) {
    return NextResponse.json({ error: "A reference ID is required" }, { status: 400 });
  }

  const booking = await BookingRequest.findOne({ referenceId: ref }).lean();
  if (!booking) {
    return NextResponse.json({ error: "We couldn't find a request with that reference ID" }, { status: 404 });
  }

  if (phone) {
    const bookingDigits = booking.phone.replace(/[^\d]/g, "");
    const matches = bookingDigits.endsWith(phone) || phone.endsWith(bookingDigits);
    if (!matches) {
      return NextResponse.json({ error: "That phone number doesn't match this reference ID" }, { status: 403 });
    }
  }

  let eventDetails: { venueName: string; location: string; date: string; startTime: string; endTime: string } | null = null;
  if (booking.convertedEventId) {
    const event = await Event.findById(booking.convertedEventId)
      .select("venueName location date startTime endTime")
      .lean();
    if (event) {
      eventDetails = {
        venueName: event.venueName,
        location: event.location,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
      };
    }
  }

  const settings = await Settings.findOne({ userId: booking.userId })
    .select("whatsappNumber displayName")
    .lean();

  return NextResponse.json({
    booking: {
      referenceId: booking.referenceId,
      clientName: booking.clientName,
      eventType: booking.eventType,
      preferredDate: booking.preferredDate,
      preferredSlot: booking.preferredSlot,
      status: booking.status,
      suggestedDate: booking.suggestedDate || "",
      suggestedNote: booking.suggestedNote || "",
    },
    event: eventDetails,
    contact: {
      whatsappNumber: settings?.whatsappNumber ?? "",
      displayName: settings?.displayName ?? "Vaishnavi",
    },
  });
}
