/**
 * Plain, framework-agnostic constant arrays shared between the Mongoose
 * models (server-only) and client components (browser).
 *
 * These must NEVER live only inside a models/*.ts file: those files also
 * define Mongoose schemas and call mongoose.model(...), which depends on
 * Node-only APIs. If a "use client" component imports a *value* (not a
 * `import type`) from a models/*.ts file, Next.js has to bundle that whole
 * module for the browser -- where Mongoose doesn't work -- and the model
 * registry silently comes back undefined at runtime. Keeping these arrays
 * here means both sides can safely import just the plain data they need.
 */

export const EVENT_TYPES = [
  "Baby Shower",
  "Wedding",
  "Corporate",
  "College",
  "Cultural",
  "Social",
  "Brand event",
  "Birthday",
  "Award function",
  "Other",
] as const;

export const EVENT_STATUSES = [
  "Enquiry",
  "Tentative",
  "Confirmed",
  "Completed",
  "Cancelled",
] as const;

export const PAYMENT_STATUSES = [
  "Not discussed",
  "Pending",
  "Advance received",
  "Fully paid",
] as const;

export const SLOTS = ["Morning", "Evening", "Custom"] as const;

export const TEMPLATE_CATEGORIES = [
  "Introduction",
  "Quotation",
  "Booking Confirmation",
  "Availability Reply",
  "Payment Reminder",
  "Event Details Request",
  "Thank You",
  "Collaboration",
  "Follow-up",
  "Custom",
] as const;

export const BOOKING_STATUSES = [
  "New",
  "Reviewing",
  "Tentative",
  "Rescheduled",
  "Approved",
  "Rejected",
] as const;

export const THEMES = ["rose", "lavender", "sky", "cream", "midnight"] as const;

export const REMINDER_OFFSETS = [
  "1_week_before",
  "2_days_before",
  "1_day_before",
  "2_hours_before",
  "custom",
] as const;

/**
 * Vaishnavi's day-job office shifts. Each date can have at most one shift.
 * A shift blocks her from taking events during (and slightly around) those
 * hours -- it is not itself a bookable "event".
 */
export const OFFICE_SHIFT_TYPES = ["Morning", "Afternoon", "Night", "Custom", "Off"] as const;

/**
 * Default clock times for each preset shift type. Night wraps past midnight.
 * "Custom" intentionally has no preset -- its start/end time (and label,
 * and color) are always typed in by hand for that specific date.
 */
export const OFFICE_SHIFT_PRESETS: Record<
  Exclude<(typeof OFFICE_SHIFT_TYPES)[number], "Off" | "Custom">,
  { startTime: string; endTime: string; spansNextDay: boolean; label: string }
> = {
  Morning: { startTime: "06:00", endTime: "15:00", spansNextDay: false, label: "Morning Shift" },
  Afternoon: { startTime: "14:00", endTime: "23:00", spansNextDay: false, label: "Afternoon Shift" },
  Night: { startTime: "22:00", endTime: "07:00", spansNextDay: true, label: "Night Shift" },
};

/**
 * Preset color swatches offered when Vaishnavi sets a "Custom" shift, so
 * every custom shift can still get its own distinct color on the calendar
 * (on top of the fixed colors Morning/Afternoon/Night/Off already have).
 */
export const OFFICE_SHIFT_CUSTOM_COLORS = [
  { name: "Teal", value: "#0d9488" },
  { name: "Blue", value: "#2563eb" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Pink", value: "#db2777" },
  { name: "Amber", value: "#d97706" },
  { name: "Rose", value: "#e11d48" },
  { name: "Slate", value: "#475569" },
] as const;
