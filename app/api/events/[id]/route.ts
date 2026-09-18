import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Event from "@/models/Event";
import Settings from "@/models/Settings";
import { eventUpdateSchema } from "@/lib/validations";
import { checkSchedule, type ScheduleEventLike } from "@/lib/scheduling";
import { syncEventToGoogle, deleteGoogleCalendarEvent } from "@/lib/google-calendar";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const event = await Event.findOne({ _id: id, userId }).lean();
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ event });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const existing = await Event.findOne({ _id: id, userId });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  // Support quick single-field status transitions (mark completed, cancel, etc.)
  // without requiring the full event payload from the client.
  if (
    Object.keys(body).length === 1 &&
    "status" in body &&
    typeof body.status === "string"
  ) {
    existing.status = body.status;
    await existing.save();
    after(() => syncEventToGoogle(userId, existing));
    return NextResponse.json({ event: existing });
  }

  const parsed = eventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const merged = { ...existing.toObject(), ...data };

  const settings = await Settings.findOne({ userId }).lean();
  const sameDayEvents = (await Event.find({
    userId,
    date: merged.date,
    _id: { $ne: existing._id },
  }).lean()) as unknown as ScheduleEventLike[];

  const result = checkSchedule(
    { ...merged, _id: existing._id.toString() },
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

  Object.assign(existing, data);
  await existing.save();
  after(() => syncEventToGoogle(userId, existing));
  return NextResponse.json({ event: existing, schedule: result });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const deleted = await Event.findOneAndDelete({ _id: id, userId });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (deleted.googleEventId) {
    // Scheduled via after() rather than a bare fire-and-forget promise --
    // on Vercel's serverless runtime, an un-awaited promise can get cut off
    // the instant the response is sent, so the Google delete might never
    // actually complete. after() guarantees it runs to completion.
    after(() => deleteGoogleCalendarEvent(userId, deleted.googleEventId!).catch(() => {}));
  }
  return NextResponse.json({ ok: true });
}
