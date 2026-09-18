/**
 * Smart scheduling engine for Vaishnavi's Stage.
 *
 * All times are treated as plain "HH:mm" strings on a given "YYYY-MM-DD"
 * calendar date in Asia/Kolkata. We never need to worry about UTC offsets
 * for this logic because we always compare events that share the same
 * timezone context (Vaishnavi's own calendar).
 */

export interface ScheduleEventLike {
  _id?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  slot: "Morning" | "Evening" | "Custom";
  status: string; // Enquiry | Tentative | Confirmed | Completed | Cancelled
  travelMinutes: number;
  preparationMinutes: number;
  safetyBufferMinutes: number;
  title?: string;
}

export interface ScheduleCheckOptions {
  maxEventsPerDay?: number;
}

export type ScheduleIssueLevel = "ok" | "warning" | "conflict";

export interface ScheduleIssue {
  level: ScheduleIssueLevel;
  message: string;
}

export interface ScheduleCheckResult {
  ok: boolean;
  issues: ScheduleIssue[];
  requiredGapMinutes: number;
  availableGapMinutes: number | null;
  comfortable: boolean;
}

const DEFAULT_MAX_EVENTS_PER_DAY = 2;

/** Convert "HH:mm" into minutes since midnight. */
export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Only events that actually occupy the calendar (ignore cancelled). */
function isActive(e: ScheduleEventLike): boolean {
  return e.status !== "Cancelled";
}

/**
 * Check a candidate event against the rest of that day's existing events.
 * Returns a structured list of issues ranging from informational "ok"
 * messages to hard "conflict" flags. The caller decides whether a
 * "warning" is acceptable (manual save) — a "conflict" (exact time overlap)
 * should still require explicit confirmation, and public bookings must
 * never be auto-approved regardless of the result.
 */
export function checkSchedule(
  candidate: ScheduleEventLike,
  sameDayEvents: ScheduleEventLike[],
  options: ScheduleCheckOptions = {}
): ScheduleCheckResult {
  const maxEventsPerDay = options.maxEventsPerDay ?? DEFAULT_MAX_EVENTS_PER_DAY;
  const issues: ScheduleIssue[] = [];

  const others = sameDayEvents.filter(
    (e) => isActive(e) && e._id !== candidate._id
  );

  const candidateStart = toMinutes(candidate.startTime);
  const candidateEnd = toMinutes(candidate.endTime);

  if (candidateEnd <= candidateStart) {
    issues.push({
      level: "conflict",
      message: "End time must be after start time.",
    });
  }

  // 1. Exact / partial timing overlaps
  let hasOverlap = false;
  for (const other of others) {
    const otherStart = toMinutes(other.startTime);
    const otherEnd = toMinutes(other.endTime);
    const overlaps = candidateStart < otherEnd && candidateEnd > otherStart;
    if (overlaps) {
      hasOverlap = true;
      issues.push({
        level: "conflict",
        message: `This overlaps directly with "${other.title ?? "another event"}" (${other.startTime}–${other.endTime}).`,
      });
    }
  }

  // 2. More than max events per day
  const totalThatDay = others.length + 1;
  if (totalThatDay > maxEventsPerDay) {
    issues.push({
      level: "warning",
      message: `You already have ${others.length} event(s) that day. Vaishnavi's Stage normally schedules a maximum of ${maxEventsPerDay} events per day.`,
    });
  }

  // 3. Same-slot warning (e.g. two "Morning" events)
  if (candidate.slot !== "Custom") {
    const sameSlot = others.some((o) => o.slot === candidate.slot);
    if (sameSlot) {
      issues.push({
        level: "warning",
        message: `You already have another ${candidate.slot.toLowerCase()} event booked that day.`,
      });
    }
  }

  // 4–8. Gap / travel / preparation / safety buffer against the nearest
  // neighbouring event (the one immediately before or after the candidate).
  let availableGapMinutes: number | null = null;
  let requiredGapMinutes =
    candidate.travelMinutes + candidate.preparationMinutes + candidate.safetyBufferMinutes;

  if (!hasOverlap && others.length > 0) {
    // Nearest event ending before candidate starts
    const before = others
      .filter((o) => toMinutes(o.endTime) <= candidateStart)
      .sort((a, b) => toMinutes(b.endTime) - toMinutes(a.endTime))[0];

    // Nearest event starting after candidate ends
    const after = others
      .filter((o) => toMinutes(o.startTime) >= candidateEnd)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))[0];

    if (before) {
      const gap = candidateStart - toMinutes(before.endTime);
      const required =
        candidate.travelMinutes + candidate.preparationMinutes + candidate.safetyBufferMinutes;
      availableGapMinutes = gap;
      requiredGapMinutes = required;
      if (gap >= required) {
        issues.push({
          level: "ok",
          message: "Schedule looks good. You have enough time for travel and preparation.",
        });
      } else {
        issues.push({
          level: "warning",
          message: `Scheduling issue detected. Only ${gap} minute(s) after "${before.title ?? "the previous event"}", but ${required} minute(s) are needed for travel, preparation, and buffer.`,
        });
      }
    }

    if (after) {
      const gap = toMinutes(after.startTime) - candidateEnd;
      const required =
        after.travelMinutes + after.preparationMinutes + after.safetyBufferMinutes;
      if (availableGapMinutes === null || gap < availableGapMinutes) {
        availableGapMinutes = gap;
      }
      if (gap < required) {
        issues.push({
          level: "warning",
          message: `Scheduling issue detected. Only ${gap} minute(s) before "${after.title ?? "the next event"}", but ${required} minute(s) are needed for travel, preparation, and buffer.`,
        });
      } else if (!before) {
        issues.push({
          level: "ok",
          message: "Schedule looks good. You have enough time for travel and preparation.",
        });
      }
    }
  } else if (!hasOverlap && others.length === 0) {
    issues.push({
      level: "ok",
      message: "No other events that day — this slot is wide open.",
    });
  }

  const hasConflict = issues.some((i) => i.level === "conflict");
  const hasWarning = issues.some((i) => i.level === "warning");

  return {
    ok: !hasConflict,
    issues,
    requiredGapMinutes,
    availableGapMinutes,
    comfortable: !hasConflict && !hasWarning,
  };
}

/** Human summary line used across dashboard/calendar/booking-approval UI. */
export function summarizeSchedule(result: ScheduleCheckResult): string {
  if (result.issues.some((i) => i.level === "conflict")) {
    return "This clashes directly with another event.";
  }
  if (result.issues.some((i) => i.level === "warning")) {
    return "Scheduling issue detected. There may not be enough time between events.";
  }
  return "Schedule looks good. You have enough time for travel and preparation.";
}
