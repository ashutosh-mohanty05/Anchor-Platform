import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import OfficeShift from "@/models/OfficeShift";
import { officeShiftSchema } from "@/lib/validations";
import { OFFICE_SHIFT_PRESETS } from "@/lib/constants";
import { getOfficeBlocksForDate } from "@/lib/office-schedule";

/** Private: list Vaishnavi's office shifts, optionally within a date range,
 * or the expanded occupied-time blocks for a single date (?date=). */
export async function GET(req: NextRequest) {
  const userId = await getOwnerUserId();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const date = searchParams.get("date");

  if (date) {
    const blocks = await getOfficeBlocksForDate(userId, date);
    return NextResponse.json({ blocks });
  }

  const query: Record<string, unknown> = { userId };
  if (from && to) query.date = { $gte: from, $lte: to };

  const shifts = await OfficeShift.find(query).sort({ date: 1 }).lean();
  return NextResponse.json({ shifts });
}

/** Private: create/update the shift for a given date (one shift per date). */
export async function POST(req: NextRequest) {
  const userId = await getOwnerUserId();
  await connectToDatabase();

  const body = await req.json();
  const parsed = officeShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { date, shiftType, note, color, customLabel } = parsed.data;

  // "Custom" has no fixed preset -- Vaishnavi types the exact start/end
  // herself, and we work out whether it spans past midnight from those.
  const preset =
    shiftType === "Off" || shiftType === "Custom"
      ? { startTime: "", endTime: "", spansNextDay: false }
      : OFFICE_SHIFT_PRESETS[shiftType];

  const startTime = parsed.data.startTime || preset.startTime;
  const endTime = parsed.data.endTime || preset.endTime;
  const spansNextDay =
    shiftType === "Custom" && startTime && endTime ? endTime < startTime : preset.spansNextDay;

  const shift = await OfficeShift.findOneAndUpdate(
    { userId, date },
    {
      $set: {
        shiftType,
        startTime,
        endTime,
        spansNextDay,
        note: note ?? "",
        color: shiftType === "Custom" ? (color ?? "") : "",
        customLabel: shiftType === "Custom" ? (customLabel ?? "") : "",
      },
    },
    { new: true, upsert: true }
  );

  return NextResponse.json({ shift });
}

/** Private: remove the shift for a given date (?date=YYYY-MM-DD). */
export async function DELETE(req: NextRequest) {
  const userId = await getOwnerUserId();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  await OfficeShift.deleteOne({ userId, date });
  return NextResponse.json({ ok: true });
}
