import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Reminder from "@/models/Reminder";
import Event from "@/models/Event";
import { reminderSchema } from "@/lib/validations";

const OFFSET_MINUTES: Record<string, number> = {
  "1_week_before": 7 * 24 * 60,
  "2_days_before": 2 * 24 * 60,
  "1_day_before": 24 * 60,
  "2_hours_before": 2 * 60,
};

/** Upcoming (not-yet-acknowledged, not-yet-passed) reminders for the dashboard. */
export async function GET() {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const reminders = await Reminder.find({
    userId,
    acknowledged: false,
    remindAt: { $gte: new Date() },
  })
    .sort({ remindAt: 1 })
    .limit(10)
    .populate("eventId", "title date startTime")
    .lean();

  return NextResponse.json({ reminders });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const body = await req.json();
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { eventId, offset, customMinutesBefore, note } = parsed.data;

  const event = await Event.findOne({ _id: eventId, userId }).lean();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const eventStart = new Date(`${event.date}T${event.startTime}:00+05:30`);
  const minutesBefore = offset === "custom" ? customMinutesBefore ?? 60 : OFFSET_MINUTES[offset];
  const remindAt = new Date(eventStart.getTime() - minutesBefore * 60000);

  const reminder = await Reminder.create({
    userId, eventId, offset, customMinutesBefore, remindAt, note,
  });

  return NextResponse.json({ reminder }, { status: 201 });
}
