import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import BookingRequest from "@/models/BookingRequest";
import Event from "@/models/Event";
import Settings from "@/models/Settings";
import { bookingStatusUpdateSchema } from "@/lib/validations";
import { checkSchedule, type ScheduleEventLike } from "@/lib/scheduling";
import { EVENT_TYPES } from "@/lib/constants";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const booking = await BookingRequest.findOne({ _id: id, userId }).lean();
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Recompute the current schedule check for this request's preferred date
  // so the dashboard can show up-to-date conflict warnings even if events
  // changed since the request was submitted.
  const settings = await Settings.findOne({ userId }).lean();
  const sameDayEvents = (await Event.find({
    userId,
    date: booking.preferredDate,
  }).lean()) as unknown as ScheduleEventLike[];

  let schedule = null;
  if (booking.preferredStartTime && booking.preferredEndTime) {
    schedule = checkSchedule(
      {
        date: booking.preferredDate,
        startTime: booking.preferredStartTime,
        endTime: booking.preferredEndTime,
        slot: booking.preferredSlot === "Flexible" ? "Custom" : booking.preferredSlot,
        status: "Enquiry",
        travelMinutes: settings?.defaultTravelMinutes ?? 30,
        preparationMinutes: settings?.defaultPreparationMinutes ?? 120,
        safetyBufferMinutes: settings?.defaultSafetyBufferMinutes ?? 30,
      },
      sameDayEvents,
      { maxEventsPerDay: settings?.maxEventsPerDay ?? 2 }
    );
  }

  return NextResponse.json({ booking, schedule });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const booking = await BookingRequest.findOne({ _id: id, userId });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = bookingStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { status, privateNotes, confirmDespiteConflict, suggestedDate, suggestedNote } = parsed.data;

  if (status === "Approved") {
    if (!booking.preferredStartTime || !booking.preferredEndTime) {
      return NextResponse.json(
        { error: "This request has no exact start/end time yet. Add times before approving." },
        { status: 400 }
      );
    }

    const settings = await Settings.findOne({ userId }).lean();
    const sameDayEvents = (await Event.find({
      userId,
      date: booking.preferredDate,
    }).lean()) as unknown as ScheduleEventLike[];

    const result = checkSchedule(
      {
        date: booking.preferredDate,
        startTime: booking.preferredStartTime,
        endTime: booking.preferredEndTime,
        slot: booking.preferredSlot === "Flexible" ? "Custom" : booking.preferredSlot,
        status: "Enquiry",
        travelMinutes: settings?.defaultTravelMinutes ?? 30,
        preparationMinutes: settings?.defaultPreparationMinutes ?? 120,
        safetyBufferMinutes: settings?.defaultSafetyBufferMinutes ?? 30,
      },
      sameDayEvents,
      { maxEventsPerDay: settings?.maxEventsPerDay ?? 2 }
    );

    if (!result.ok || (!result.comfortable && !confirmDespiteConflict)) {
      return NextResponse.json({ error: "conflict", schedule: result }, { status: 409 });
    }

    // Convert the request into a real, private event. Public bookings are
    // NEVER auto-confirmed by the system -- this only runs because Vaishnavi
    // explicitly clicked "Approve" in her private dashboard.
    const event = await Event.create({
      userId,
      title: `${booking.eventType} - ${booking.clientName}`,
      eventType: EVENT_TYPE_FALLBACK(booking.eventType),
      date: booking.preferredDate,
      startTime: booking.preferredStartTime,
      endTime: booking.preferredEndTime,
      slot: booking.preferredSlot === "Flexible" ? "Custom" : booking.preferredSlot,
      venueName: "",
      location: booking.location,
      clientName: booking.clientName,
      clientPhone: booking.phone,
      clientEmail: booking.email ?? "",
      status: "Tentative",
      travelMinutes: settings?.defaultTravelMinutes ?? 30,
      preparationMinutes: settings?.defaultPreparationMinutes ?? 120,
      safetyBufferMinutes: settings?.defaultSafetyBufferMinutes ?? 30,
      notes: booking.message ?? "",
      bookingRequestId: booking._id,
    });

    booking.status = "Approved";
    booking.convertedEventId = event._id as unknown as Types.ObjectId;
    if (privateNotes !== undefined) booking.privateNotes = privateNotes;
    await booking.save();

    return NextResponse.json({ booking, event, schedule: result });
  }

  booking.status = status;
  if (privateNotes !== undefined) booking.privateNotes = privateNotes;
  if (status === "Rescheduled") {
    if (suggestedDate !== undefined) booking.suggestedDate = suggestedDate;
    if (suggestedNote !== undefined) booking.suggestedNote = suggestedNote;
  }
  await booking.save();
  return NextResponse.json({ booking });
}

function EVENT_TYPE_FALLBACK(type: string) {
  return (EVENT_TYPES as readonly string[]).includes(type) ? type : "Other";
}
