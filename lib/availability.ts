import connectToDatabase from "./mongodb";
import Event from "@/models/Event";
import { toMinutes } from "./scheduling";
import { getOfficeBlocksForDate, getOfficeBlocksForRange } from "./office-schedule";

export type PublicSlotStatus = "available" | "booked";

export interface PublicDayAvailability {
  date: string;
  /**
   * A single, simple status per day -- deliberately NOT split into
   * morning/evening slots, so clients are never left guessing which of
   * two dots applies to the time they actually want. Only CONFIRMED
   * events and Vaishnavi's office shifts ever mark a day "booked" here;
   * a pending Enquiry/Tentative request never blocks the public calendar,
   * because it isn't a real commitment yet.
   */
  status: PublicSlotStatus;
}

export interface TimeAvailabilityResult {
  available: boolean;
  reason?: string;
}

/**
 * Computes ONLY safe, public-facing availability for a date range.
 * This function must never return client names, fees, venues, notes,
 * or any other private field -- only a status per day.
 */
export async function getPublicAvailability(
  ownerUserId: string,
  startDate: string,
  endDate: string
): Promise<PublicDayAvailability[]> {
  await connectToDatabase();

  // Only CONFIRMED events count as a real commitment for public display --
  // Enquiry/Tentative requests are not yet promises Vaishnavi has made.
  const events = await Event.find({
    userId: ownerUserId,
    date: { $gte: startDate, $lte: endDate },
    status: "Confirmed",
  })
    .select("date")
    .lean();

  const bookedDates = new Set(events.map((e) => e.date));

  const officeBlocksByDate = await getOfficeBlocksForRange(ownerUserId, startDate, endDate);
  for (const date of officeBlocksByDate.keys()) {
    if ((officeBlocksByDate.get(date) ?? []).length > 0) bookedDates.add(date);
  }

  const results: PublicDayAvailability[] = [];
  const cursor = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10);
    results.push({ date: dateStr, status: bookedDates.has(dateStr) ? "booked" : "available" });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return results;
}

/**
 * Checks whether a SPECIFIC date + time window is free, the way a client
 * actually wants to know it ("is she free 6-9pm on the 12th?") instead of
 * a vague morning/evening label. Only confirmed events + office shifts can
 * make a window unavailable -- same rule as the calendar above. If no time
 * is given, checks the whole day for any confirmed event or office shift.
 */
export async function checkTimeAvailability(
  ownerUserId: string,
  date: string,
  startTime?: string,
  endTime?: string
): Promise<TimeAvailabilityResult> {
  await connectToDatabase();

  const officeBlocks = await getOfficeBlocksForDate(ownerUserId, date);
  const confirmedEvents = await Event.find({ userId: ownerUserId, date, status: "Confirmed" })
    .select("startTime endTime")
    .lean();

  const hasWindow = Boolean(startTime && endTime);
  const s = hasWindow ? toMinutes(startTime as string) : 0;
  const e = hasWindow ? toMinutes(endTime as string) : 24 * 60;

  for (const block of officeBlocks) {
    const bs = toMinutes(block.startTime);
    const be = toMinutes(block.endTime === "23:59" ? "24:00" : block.endTime);
    if (s < be && e > bs) {
      return { available: false, reason: "Vaishnavi is unavailable during that time." };
    }
  }

  for (const ev of confirmedEvents) {
    const es = toMinutes(ev.startTime);
    const ee = toMinutes(ev.endTime);
    if (s < ee && e > es) {
      return { available: false, reason: "Vaishnavi already has a confirmed event at that time." };
    }
  }

  return { available: true };
}
