/**
 * Lightweight, offline natural-language parser for the voice/text
 * assistant. Turns a free-form sentence like "Add a wedding on 28
 * September at 7pm in Pune" or "Night shift tomorrow" into structured
 * date/time/event-type/shift fields, so the assistant can actually save
 * things instead of just echoing the transcript back.
 *
 * Intentionally simple, rule-based, and dependency-free (no external AI
 * API) -- it favors covering common everyday phrasing over handling every
 * possible sentence.
 */

import { EVENT_STATUSES, EVENT_TYPES, OFFICE_SHIFT_TYPES } from "@/lib/constants";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3));

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function toISODate(y: number, mIndex: number, d: number): string {
  return `${y}-${pad2(mIndex + 1)}-${pad2(d)}`;
}

/** Parses a calendar date out of free text. `todayISO` anchors relative phrases. */
export function parseDateFromText(text: string, todayISO: string): string | null {
  const lower = text.toLowerCase();
  const today = new Date(todayISO + "T00:00:00Z");

  if (/\btoday\b/.test(lower)) return todayISO;

  if (/\bday after tomorrow\b/.test(lower)) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // "next monday" / "this friday" / bare "monday"
  const weekdayMatch = lower.match(new RegExp(`\\b(next\\s+|this\\s+)?(${WEEKDAYS.join("|")})\\b`));
  if (weekdayMatch) {
    const targetDay = WEEKDAYS.indexOf(weekdayMatch[2]);
    const isNext = Boolean(weekdayMatch[1]?.trim() === "next");
    const d = new Date(today);
    let diff = (targetDay - d.getUTCDay() + 7) % 7;
    if (diff === 0) diff = isNext ? 7 : 0;
    else if (isNext) diff += 7;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  // "28 september" / "28th of september" / "september 28"
  const monthNames = `${MONTHS.join("|")}|${MONTH_ABBR.join("|")}`;
  const dayFirst = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthNames})\\b`));
  if (dayFirst) {
    const day = Number(dayFirst[1]);
    const mIndex = resolveMonthIndex(dayFirst[2]);
    const year = today.getUTCFullYear();
    let candidate = toISODate(year, mIndex, day);
    // If that date already passed this year, assume next year.
    if (candidate < todayISO) candidate = toISODate(year + 1, mIndex, day);
    return candidate;
  }
  const monthFirst = lower.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (monthFirst) {
    const mIndex = resolveMonthIndex(monthFirst[1]);
    const day = Number(monthFirst[2]);
    const year = today.getUTCFullYear();
    let candidate = toISODate(year, mIndex, day);
    if (candidate < todayISO) candidate = toISODate(year + 1, mIndex, day);
    return candidate;
  }

  // "28/9" or "28-09" (DD/MM or DD-MM, optionally with a year)
  const slash = lower.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : today.getUTCFullYear();
      let candidate = toISODate(year, month - 1, day);
      if (!slash[3] && candidate < todayISO) candidate = toISODate(year + 1, month - 1, day);
      return candidate;
    }
  }

  return null;
}

function resolveMonthIndex(token: string): number {
  const full = MONTHS.indexOf(token);
  if (full !== -1) return full;
  return MONTH_ABBR.indexOf(token.slice(0, 3));
}

export interface ParsedTimeRange {
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

const DAYPART_DEFAULTS: Record<string, ParsedTimeRange> = {
  morning: { startTime: "09:00", endTime: "12:00" },
  afternoon: { startTime: "14:00", endTime: "17:00" },
  evening: { startTime: "18:00", endTime: "21:00" },
  night: { startTime: "20:00", endTime: "23:00" },
};

function to24h(hour: number, minute: number, meridiem?: string): string {
  let h = hour % 12;
  if (meridiem === "pm") h += 12;
  if (!meridiem && hour === 12) h = 12; // bare "12" with no am/pm stays as typed
  return `${pad2(h)}:${pad2(minute)}`;
}

/** Parses a start (and optional end) time out of free text. */
export function parseTimeRangeFromText(text: string): ParsedTimeRange | null {
  const lower = text.toLowerCase();

  // "7pm to 9pm", "from 7 to 9 pm", "7:30pm-9:30pm"
  const rangeMatch = lower.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–|until|till)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/
  );
  if (rangeMatch) {
    const [, h1, m1, mer1raw, h2, m2, mer2raw] = rangeMatch;
    const mer2 = mer2raw;
    const mer1 = mer1raw ?? mer2; // "7 to 9pm" -> both pm
    const startTime = to24h(Number(h1), m1 ? Number(m1) : 0, mer1);
    const endTime = to24h(Number(h2), m2 ? Number(m2) : 0, mer2 ?? mer1);
    return { startTime, endTime };
  }

  // A single clock time, e.g. "at 7pm" / "at 19:00" / "7:30 pm"
  const singleMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) ?? lower.match(/\bat\s+(\d{1,2}):(\d{2})\b/);
  if (singleMatch) {
    const [, h, m, mer] = singleMatch;
    const startTime = to24h(Number(h), m ? Number(m) : 0, mer);
    const [sh, sm] = startTime.split(":").map(Number);
    const endDate = new Date(Date.UTC(2000, 0, 1, sh, sm));
    endDate.setUTCHours(endDate.getUTCHours() + 3); // default 3-hour event
    const endTime = `${pad2(endDate.getUTCHours())}:${pad2(endDate.getUTCMinutes())}`;
    return { startTime, endTime };
  }

  // Day-part words with sensible default windows.
  for (const part of Object.keys(DAYPART_DEFAULTS)) {
    if (new RegExp(`\\b${part}\\b`).test(lower)) return DAYPART_DEFAULTS[part];
  }

  return null;
}

/** Best-guess event type from the EVENT_TYPES list based on keywords in the text. */
export function detectEventType(text: string): (typeof EVENT_TYPES)[number] | null {
  const lower = text.toLowerCase();
  const keywordMap: Record<string, (typeof EVENT_TYPES)[number]> = {
    "baby shower": "Baby Shower",
    wedding: "Wedding",
    sangeet: "Wedding",
    corporate: "Corporate",
    college: "College",
    cultural: "Cultural",
    social: "Social",
    brand: "Brand event",
    birthday: "Birthday",
    award: "Award function",
  };
  for (const [kw, type] of Object.entries(keywordMap)) {
    if (lower.includes(kw)) return type;
  }
  return null;
}

/**
 * Best-guess event status from spoken/typed text, so she can say "add a
 * *confirmed* wedding on 28 September" and have it saved straight as
 * Confirmed instead of always landing as Tentative. Checked as whole words
 * so it doesn't misfire on unrelated text; returns null (caller defaults
 * to "Tentative") when nothing is said either way.
 */
export function detectEventStatus(text: string): (typeof EVENT_STATUSES)[number] | null {
  const lower = text.toLowerCase();
  if (/\bconfirm(ed)?\b/.test(lower)) return "Confirmed";
  if (/\btentative(ly)?\b/.test(lower)) return "Tentative";
  if (/\b(enquiry|enquire|inquiry|inquire)\b/.test(lower)) return "Enquiry";
  if (/\bcompleted?\b/.test(lower)) return "Completed";
  return null;
}

export interface ParsedShift {
  shiftType: (typeof OFFICE_SHIFT_TYPES)[number];
  customLabel?: string;
}

/** Detects whether the transcript is about her day-job office schedule, not an event. */
export function detectOfficeShift(text: string): ParsedShift | null {
  const lower = text.toLowerCase();
  const mentionsShift = /\b(shift|office|day off|off day|on leave|leave day|working)\b/.test(lower);
  if (!mentionsShift) return null;

  if (/\bnight\b/.test(lower)) return { shiftType: "Night" };
  if (/\bmorning\b/.test(lower)) return { shiftType: "Morning" };
  if (/\bafternoon\b/.test(lower)) return { shiftType: "Afternoon" };
  if (/\b(off|leave|holiday)\b/.test(lower)) return { shiftType: "Off" };

  // Generic "shift" mention with no known preset -> Custom, labeled from the transcript.
  return { shiftType: "Custom", customLabel: text.trim().slice(0, 60) };
}
