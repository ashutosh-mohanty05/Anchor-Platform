import { z } from "zod";
import { EVENT_TYPES, EVENT_STATUSES, PAYMENT_STATUSES, SLOTS, TEMPLATE_CATEGORIES, BOOKING_STATUSES, THEMES, OFFICE_SHIFT_TYPES } from "@/lib/constants";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Kept as a plain ZodObject (no .refine() yet) so both the full schema and
// the partial/update schema below can each derive from it — z.partial()
// is not available on a ZodEffects (the type .refine() returns), which
// previously made eventUpdateSchema fail to type-check.
const eventBaseSchema = z.object({
  title: z.string().min(2, "Title is required").max(120),
  eventType: z.enum(EVENT_TYPES),
  date: z.string().regex(dateRegex, "Use YYYY-MM-DD"),
  startTime: z.string().regex(timeRegex, "Use 24h HH:mm"),
  endTime: z.string().regex(timeRegex, "Use 24h HH:mm"),
  slot: z.enum(SLOTS).default("Custom"),
  venueName: z.string().max(200).optional().default(""),
  location: z.string().max(300).optional().default(""),
  clientName: z.string().max(120).optional().default(""),
  clientPhone: z.string().max(20).optional().default(""),
  clientEmail: z.string().email().optional().or(z.literal("")).default(""),
  fee: z.coerce.number().min(0).optional().default(0),
  advancePaid: z.coerce.number().min(0).optional().default(0),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("Not discussed"),
  status: z.enum(EVENT_STATUSES).default("Enquiry"),
  travelMinutes: z.coerce.number().min(0).max(600).default(30),
  preparationMinutes: z.coerce.number().min(0).max(600).default(120),
  safetyBufferMinutes: z.coerce.number().min(0).max(600).default(30),
  notes: z.string().max(2000).optional().default(""),
  privateNotes: z.string().max(2000).optional().default(""),
  forceSaveWithWarning: z.boolean().optional().default(false),
});

export const eventSchema = eventBaseSchema.refine(
  (data) => data.endTime > data.startTime,
  {
    message: "End time must be after start time",
    path: ["endTime"],
  }
);

export type EventInput = z.infer<typeof eventSchema>;

export const eventUpdateSchema = eventBaseSchema.partial().extend({
  forceSaveWithWarning: z.boolean().optional().default(false),
});

export const bookingRequestSchema = z.object({
  clientName: z.string().min(2, "Name is required").max(120),
  phone: z.string().min(7, "Enter a valid phone number").max(20),
  email: z.string().email().optional().or(z.literal("")),
  eventType: z.string().min(2),
  preferredDate: z.string().regex(dateRegex, "Use YYYY-MM-DD"),
  preferredSlot: z.enum(["Morning", "Evening", "Flexible"]),
  preferredStartTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  preferredEndTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  location: z.string().max(300).optional().default(""),
  audienceSize: z.coerce.number({ invalid_type_error: "Audience size is required" }).min(1, "Audience size is required").max(1000000),
  message: z.string().max(2000).optional().default(""),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Please confirm you understand this is just a request" }),
  }),
  // Honeypot: real users never fill this in. Bots often do.
  website: z.string().max(0, "Spam detected").optional().or(z.literal("")),
});

export type BookingRequestInput = z.infer<typeof bookingRequestSchema>;

export const bookingStatusUpdateSchema = z.object({
  status: z.enum(BOOKING_STATUSES),
  privateNotes: z.string().max(2000).optional(),
  suggestedDate: z.string().regex(dateRegex).optional().or(z.literal("")),
  suggestedNote: z.string().max(500).optional().or(z.literal("")),
  confirmDespiteConflict: z.boolean().optional().default(false),
});

export const templateSchema = z.object({
  category: z.enum(TEMPLATE_CATEGORIES),
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(4000),
});

export const settingsSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  bio: z.string().max(500).optional(),
  // Data URL (base64) or a hosted image URL -- generous limit so a
  // client-side-resized photo fits comfortably.
  profileImage: z.string().max(4_000_000).optional().or(z.literal("")),
  instagramUrl: z.string().max(300).optional(),
  whatsappNumber: z.string().max(20).optional(),
  theme: z.enum(THEMES).optional(),
  publicBookingEnabled: z.boolean().optional(),
  maxEventsPerDay: z.coerce.number().min(1).max(10).optional(),
  defaultPreparationMinutes: z.coerce.number().min(0).max(600).optional(),
  defaultTravelMinutes: z.coerce.number().min(0).max(600).optional(),
  defaultSafetyBufferMinutes: z.coerce.number().min(0).max(600).optional(),
});

export const officeShiftSchema = z.object({
  date: z.string().regex(dateRegex, "Use YYYY-MM-DD"),
  shiftType: z.enum(OFFICE_SHIFT_TYPES),
  startTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  endTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  note: z.string().max(200).optional().or(z.literal("")),
  color: z.string().max(20).optional().or(z.literal("")),
  customLabel: z.string().max(60).optional().or(z.literal("")),
});

export const availabilityCheckSchema = z.object({
  date: z.string().regex(dateRegex, "Use YYYY-MM-DD"),
  startTime: z.string().regex(timeRegex).optional().or(z.literal("")),
  endTime: z.string().regex(timeRegex).optional().or(z.literal("")),
});

export const reminderSchema = z.object({
  eventId: z.string().min(1),
  offset: z.enum(["1_week_before", "2_days_before", "1_day_before", "2_hours_before", "custom"]),
  customMinutesBefore: z.coerce.number().min(0).optional(),
  note: z.string().max(300).optional(),
});

// Voice-assistant / Gemini function-calling argument schemas.
// Every one of these is validated server-side before anything touches
// the database — Gemini's output is never trusted directly.
export const aiCreateEventArgsSchema = eventBaseSchema.partial({
  slot: true,
  paymentStatus: true,
  status: true,
  travelMinutes: true,
  preparationMinutes: true,
  safetyBufferMinutes: true,
});

export const aiQueryArgsSchema = z.object({
  intent: z.enum([
    "list_events_this_week",
    "check_availability",
    "list_pending_payments",
    "unknown",
  ]),
  date: z.string().regex(dateRegex).optional(),
  slot: z.enum(["Morning", "Evening", "Flexible"]).optional(),
});