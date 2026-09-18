import { createEvent, type EventAttributes, type DateArray } from "ics";
import type { IEvent } from "@/models/Event";

function toDateArray(date: string, time: string): DateArray {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return [y, m, d, h, min];
}

/** Generate a single .ics file's contents for one event. */
export function eventToIcs(event: Pick<IEvent,
  "title" | "date" | "startTime" | "endTime" | "venueName" | "location" | "notes" | "clientName"
>): { filename: string; contents: string } {
  const attributes: EventAttributes = {
    title: event.title,
    start: toDateArray(event.date, event.startTime),
    end: toDateArray(event.date, event.endTime),
    location: [event.venueName, event.location].filter(Boolean).join(", "),
    description: [
      event.notes || "",
      event.clientName ? `Client: ${event.clientName}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    startInputType: "local",
    startOutputType: "local",
    productId: "vaishnavis-stage/ics",
    alarms: [
      { action: "display", trigger: { hours: 24, before: true }, description: "Reminder: 1 day before" },
      { action: "display", trigger: { hours: 2, before: true }, description: "Reminder: 2 hours before" },
    ],
  };

  const { error, value } = createEvent(attributes);
  if (error || !value) {
    throw error ?? new Error("Failed to generate .ics file");
  }

  const safeTitle = event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return { filename: `${safeTitle || "event"}.ics`, contents: value };
}

/** Build a "Google Calendar: add event" deep link (no OAuth required). */
export function googleCalendarAddLink(event: Pick<IEvent,
  "title" | "date" | "startTime" | "endTime" | "venueName" | "location" | "notes"
>): string {
  const start = `${event.date.replace(/-/g, "")}T${event.startTime.replace(":", "")}00`;
  const end = `${event.date.replace(/-/g, "")}T${event.endTime.replace(":", "")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    location: [event.venueName, event.location].filter(Boolean).join(", "),
    details: event.notes || "",
    ctz: "Asia/Kolkata",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
