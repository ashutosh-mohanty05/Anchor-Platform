import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Reminder from "@/models/Reminder";
import { sendPushToOwner } from "@/lib/push";
import { formatDateLong, formatTime12h } from "@/lib/utils";

/**
 * Meant to be hit every few minutes by an external scheduler, not by a
 * person -- see .github/workflows/reminders-cron.yml (GitHub Actions is
 * used instead of Vercel Cron, since Vercel's Hobby plan only allows a
 * once-a-day schedule). Finds reminders whose time has arrived, sends
 * each one as a real push notification -- the "Google Calendar-style"
 * alert Vaishnavi gets before her own shows -- and marks them
 * acknowledged so they only fire once.
 *
 * Protected by a shared secret (CRON_SECRET) so random visitors can't
 * trigger it or drain the push quota. Works with either an
 * `Authorization: Bearer <CRON_SECRET>` header (what Vercel Cron sends
 * automatically, if you ever switch to a paid plan and use it) or a
 * `?secret=...` query param (what the GitHub Action / cron-job.org / any
 * other scheduler uses).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const queryParam = new URL(req.url).searchParams.get("secret");
  const authorized = !secret || authHeader === `Bearer ${secret}` || queryParam === secret;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = await getOwnerUserId();
  await connectToDatabase();

  const due = await Reminder.find({
    userId,
    acknowledged: false,
    remindAt: { $lte: new Date() },
  })
    .populate("eventId", "title date startTime")
    .lean();

  for (const reminder of due) {
    const event = reminder.eventId as unknown as { title: string; date: string; startTime: string } | null;
    await sendPushToOwner(userId, {
      title: event ? `Reminder: ${event.title}` : "Event reminder",
      body: event
        ? `${formatDateLong(event.date)} at ${formatTime12h(event.startTime)}${reminder.note ? ` — ${reminder.note}` : ""}`
        : reminder.note || "You have an upcoming event.",
      url: "/calendar",
      tag: `reminder-${reminder._id}`,
    }).catch(() => {});

    await Reminder.updateOne({ _id: reminder._id }, { $set: { acknowledged: true } });
  }

  return NextResponse.json({ sent: due.length });
}
