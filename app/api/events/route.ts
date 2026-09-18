import { NextRequest, NextResponse } from "next/server";
import { unstable_after as after } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Event from "@/models/Event";
import Settings from "@/models/Settings";
import { eventSchema } from "@/lib/validations";
import { checkSchedule, type ScheduleEventLike } from "@/lib/scheduling";
import { upsertGoogleCalendarEvent } from "@/lib/google-calendar";

export async function GET(req: NextRequest) {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const eventType = searchParams.get("eventType");

  const query: Record<string, unknown> = { userId };
  if (from || to) {
    query.date = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
  if (status) query.status = status;
  if (eventType) query.eventType = eventType;

  const events = await Event.find(query).sort({ date: 1, startTime: 1 }).lean();
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const body = await req.json();
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const settings = await Settings.findOne({ userId }).lean();
  const sameDayEvents = (await Event.find({ userId, date: data.date }).lean()) as unknown as ScheduleEventLike[];

  const result = checkSchedule(
    { ...data, _id: undefined },
    sameDayEvents,
    { maxEventsPerDay: settings?.maxEventsPerDay ?? 2 }
  );

  if (!result.ok) {
    return NextResponse.json({ error: "conflict", schedule: result }, { status: 409 });
  }

  const hasWarning = result.issues.some((i) => i.level === "warning");
  if (hasWarning && !data.forceSaveWithWarning) {
    return NextResponse.json({ error: "warning", schedule: result }, { status: 422 });
  }

  const event = await Event.create({ ...data, userId });

  if (event.status === "Confirmed") {
    // Sync to Google Calendar *after* the response is sent -- this is a
    // network round-trip to a third-party API, and there's no reason to
    // make Vaishnavi wait on it before her own save appears to finish.
    // Best-effort: if it fails, the event is still saved either way.
    after(async () => {
      try {
        const googleEventId = await upsertGoogleCalendarEvent(userId, event);
        if (googleEventId) {
          event.googleEventId = googleEventId;
          await event.save();
        }
      } catch (err) {
        console.error("Google Calendar sync error:", err);
      }
    });
  }

  return NextResponse.json({ event, schedule: result }, { status: 201 });
}
