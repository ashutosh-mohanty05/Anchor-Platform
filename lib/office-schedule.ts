import connectToDatabase from "./mongodb";
import OfficeShift from "@/models/OfficeShift";
import { OFFICE_SHIFT_PRESETS } from "./constants";
import type { ScheduleEventLike } from "./scheduling";

/**
 * A single block of time, on a given calendar date, during which Vaishnavi
 * is at her day job and cannot take an event. A Night shift on date D
 * produces two blocks: one late on D, and one early on D+1 (its "tail").
 */
export interface OfficeBlock {
  date: string; // YYYY-MM-DD this block occupies
  startTime: string;
  endTime: string;
  label: string;
}

function addDays(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * Given a raw OfficeShift document, expand it into the block(s) of
 * occupied time it actually produces on the calendar. "Off" produces no
 * blocks at all (Vaishnavi is free that day).
 */
export function expandShiftToBlocks(shift: {
  date: string;
  shiftType: string;
  startTime?: string;
  endTime?: string;
  spansNextDay?: boolean;
  customLabel?: string;
}): OfficeBlock[] {
  if (shift.shiftType === "Off") return [];

  const preset = OFFICE_SHIFT_PRESETS[shift.shiftType as keyof typeof OFFICE_SHIFT_PRESETS];
  const startTime = shift.startTime || preset?.startTime || "00:00";
  const endTime = shift.endTime || preset?.endTime || "23:59";
  const spansNextDay = shift.spansNextDay ?? preset?.spansNextDay ?? false;
  const fallbackLabel = shift.shiftType === "Custom" ? (shift.customLabel || "Custom Shift") : `${shift.shiftType} Shift`;
  const label = `Office (${preset?.label ?? fallbackLabel})`;

  if (!spansNextDay) {
    return [{ date: shift.date, startTime, endTime, label }];
  }

  // e.g. Night shift 22:00 -> 07:00: blocks 22:00-23:59 on `date`,
  // and 00:00-07:00 on the following date.
  return [
    { date: shift.date, startTime, endTime: "23:59", label },
    { date: addDays(shift.date, 1), startTime: "00:00", endTime, label },
  ];
}

/**
 * All office blocks that land on a given calendar date -- combining that
 * date's own shift (if it doesn't span into the next day) and the
 * previous day's shift (if its tail spills into this date, e.g. Night).
 */
export async function getOfficeBlocksForDate(userId: string, date: string): Promise<OfficeBlock[]> {
  await connectToDatabase();
  const prevDate = addDays(date, -1);

  const shifts = await OfficeShift.find({
    userId,
    date: { $in: [date, prevDate] },
  }).lean();

  const blocks: OfficeBlock[] = [];
  for (const shift of shifts) {
    for (const block of expandShiftToBlocks(shift)) {
      if (block.date === date) blocks.push(block);
    }
  }
  return blocks;
}

/** Bulk version for a date range, keyed by date -- used by public availability. */
export async function getOfficeBlocksForRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, OfficeBlock[]>> {
  await connectToDatabase();
  const rangeStartMinusOne = addDays(startDate, -1);

  const shifts = await OfficeShift.find({
    userId,
    date: { $gte: rangeStartMinusOne, $lte: endDate },
  }).lean();

  const map = new Map<string, OfficeBlock[]>();
  for (const shift of shifts) {
    for (const block of expandShiftToBlocks(shift)) {
      if (block.date < startDate || block.date > endDate) continue;
      const list = map.get(block.date) ?? [];
      list.push(block);
      map.set(block.date, list);
    }
  }
  return map;
}

/** Convert office blocks into fake "events" so they can feed checkSchedule(). */
export function officeBlocksAsScheduleEvents(blocks: OfficeBlock[]): ScheduleEventLike[] {
  return blocks.map((b, i) => ({
    _id: `office-block-${i}`,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    slot: "Custom" as const,
    status: "Confirmed",
    travelMinutes: 0,
    preparationMinutes: 0,
    safetyBufferMinutes: 0,
    title: b.label,
  }));
}
