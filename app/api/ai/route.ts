import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Event from "@/models/Event";
import Settings from "@/models/Settings";
import OfficeShift from "@/models/OfficeShift";
import { todayInIndia, formatDateLong, formatTime12h } from "@/lib/utils";
import { checkTimeAvailability } from "@/lib/availability";
import { checkSchedule, type ScheduleEventLike } from "@/lib/scheduling";
import { syncEventToGoogle } from "@/lib/google-calendar";
import { EVENT_STATUSES, EVENT_TYPES, OFFICE_SHIFT_PRESETS, OFFICE_SHIFT_TYPES } from "@/lib/constants";
import {
  parseDateFromText, parseTimeRangeFromText, detectEventType, detectOfficeShift, detectEventStatus,
} from "@/lib/voice-parser";
import { z } from "zod";

/**
 * "Ask Vaishnavi's Stage" voice/text assistant.
 *
 * Two engines:
 *  - "fallback": the default, always-on engine. Fully offline, rule-based,
 *    and genuinely free forever -- no API key, no account, no paid tier,
 *    not even a "free tier" of someone else's service. It understands a
 *    wide range of everyday phrasing (dates, times, day-parts, shift talk,
 *    status words like "confirmed"/"tentative") and can save events
 *    directly as Confirmed when she says so, not just Tentative. This is
 *    what she gets with zero setup and zero ongoing cost.
 *  - "ai": an optional upgrade to a real conversational assistant
 *    (Anthropic's Claude, with tool calling) that can hold a looser
 *    back-and-forth ("what's confirmed this month?" phrased any which
 *    way). Only used if she chooses to add her own ANTHROPIC_API_KEY --
 *    that's a paid, opt-in extra, never required for voice control to
 *    work.
 *
 * Vaishnavi is the only person who ever talks to this assistant (there's
 * no client-facing voice chat), so when she asks it to add an event or set
 * a shift, it saves it directly. Destructive actions (delete/cancel/
 * approve/payment changes) are still left for her to do from the relevant
 * screen -- this assistant only ever adds/updates schedule data or reads
 * it back, never deletes.
 */

const requestSchema = z.object({
  transcript: z.string().min(1).max(500).optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getOwnerUserId();

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Accept either the old single-shot { transcript } shape or a full
  // { messages } chat history -- the voice assistant UI now sends history
  // so the AI engine can hold a real conversation.
  const messages: { role: "user" | "assistant"; content: string }[] =
    parsed.data.messages && parsed.data.messages.length > 0
      ? parsed.data.messages
      : parsed.data.transcript
        ? [{ role: "user", content: parsed.data.transcript }]
        : [];

  if (messages.length === 0) {
    return NextResponse.json({ error: "Say or type something first." }, { status: 400 });
  }

  await connectToDatabase();

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const reply = await handleWithClaude(messages, userId);
      return NextResponse.json({ reply, requiresConfirmation: false, engine: "ai" });
    } catch (err) {
      console.error("Claude assistant error, falling back to offline parser:", err);
      // Fall through to the offline parser below rather than failing the
      // whole request -- she should never lose voice control just because
      // the AI call had a bad moment.
    }
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const result = await handleOffline(lastUserMessage, userId);
  return NextResponse.json({ ...result, engine: "fallback" });
}

// ---------------------------------------------------------------------
// AI engine: Claude with tool calling
// ---------------------------------------------------------------------

const ANTHROPIC_MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

const TOOLS = [
  {
    name: "create_or_update_event",
    description:
      "Save a show/event on the calendar. Defaults to Tentative unless she says it's confirmed (or otherwise names a status), in which case pass that status directly -- e.g. 'add a confirmed wedding on 28 September' saves it as Confirmed immediately, no extra step. If an event already exists on the same date at the same start time, this overwrites it instead of creating a duplicate (mirrors saying the same thing twice out loud).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        startTime: { type: "string", description: "24h HH:mm" },
        endTime: { type: "string", description: "24h HH:mm" },
        eventType: { type: "string", enum: [...EVENT_TYPES] },
        title: { type: "string", description: "Optional custom title; defaults to the event type." },
        status: {
          type: "string",
          enum: [...EVENT_STATUSES],
          description: "Defaults to 'Tentative' if she doesn't say. Use 'Confirmed' when she says the booking is confirmed/finalized.",
        },
      },
      required: ["date", "startTime", "endTime", "eventType"],
    },
  },
  {
    name: "set_office_shift",
    description: "Set or overwrite Vaishnavi's day-job office shift for one date (blocks bookings during it).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        shiftType: { type: "string", enum: [...OFFICE_SHIFT_TYPES] },
        startTime: { type: "string", description: "24h HH:mm, only for Custom shifts" },
        endTime: { type: "string", description: "24h HH:mm, only for Custom shifts" },
        customLabel: { type: "string" },
      },
      required: ["date", "shiftType"],
    },
  },
  {
    name: "check_availability",
    description: "Check whether Vaishnavi is free on a date (optionally a specific time window). Only Confirmed events and office shifts block time.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        startTime: { type: "string", description: "24h HH:mm, optional" },
        endTime: { type: "string", description: "24h HH:mm, optional" },
      },
      required: ["date"],
    },
  },
  {
    name: "list_events",
    description:
      "Look up her events, optionally filtered by status (e.g. Confirmed) and/or a date range. Use this for anything like \"what's confirmed this month\", \"my events this week\", \"anything tentative in October\".",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...EVENT_STATUSES, "all"], description: "Defaults to 'all' if omitted." },
        from: { type: "string", description: "YYYY-MM-DD, inclusive. Omit for no lower bound." },
        to: { type: "string", description: "YYYY-MM-DD, inclusive. Omit for no upper bound." },
        limit: { type: "number", description: "Max results, default 25." },
      },
    },
  },
  {
    name: "list_pending_payments",
    description: "List events with an outstanding payment (Pending or Advance received, not yet Fully paid).",
    input_schema: { type: "object", properties: {} },
  },
] as const;

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[] | { type: "tool_result"; tool_use_id: string; content: string }[];
}

async function callAnthropic(messages: AnthropicMessage[], system: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY as string,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools: TOOLS,
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<{ content: AnthropicContentBlock[]; stop_reason: string }>;
}

async function executeTool(name: string, input: Record<string, unknown>, userId: string): Promise<string> {
  switch (name) {
    case "create_or_update_event": {
      const date = String(input.date);
      const startTime = String(input.startTime);
      const endTime = String(input.endTime);
      const eventType = String(input.eventType);
      const title = (input.title as string) || eventType;
      const status = (EVENT_STATUSES as readonly string[]).includes(input.status as string)
        ? (input.status as (typeof EVENT_STATUSES)[number])
        : "Tentative";

      const settings = await Settings.findOne({ userId }).lean();
      const travelMinutes = settings?.defaultTravelMinutes ?? 30;
      const preparationMinutes = settings?.defaultPreparationMinutes ?? 120;
      const safetyBufferMinutes = settings?.defaultSafetyBufferMinutes ?? 30;

      const existing = await Event.findOne({ userId, date, startTime });
      const sameDayEvents = (await Event.find({
        userId,
        date,
        ...(existing ? { _id: { $ne: existing._id } } : {}),
      }).lean()) as unknown as ScheduleEventLike[];

      const schedule = checkSchedule(
        { date, startTime, endTime, slot: "Custom", status, travelMinutes, preparationMinutes, safetyBufferMinutes },
        sameDayEvents,
        { maxEventsPerDay: settings?.maxEventsPerDay ?? 2 }
      );

      let savedEvent;
      if (existing) {
        existing.title = title;
        existing.eventType = eventType as (typeof EVENT_TYPES)[number];
        existing.endTime = endTime;
        existing.status = status;
        await existing.save();
        savedEvent = existing;
      } else {
        savedEvent = await Event.create({
          userId, title, eventType, date, startTime, endTime, slot: "Custom", status,
          travelMinutes, preparationMinutes, safetyBufferMinutes,
        });
      }

      // Same rule the event form follows: Confirmed events get pushed to
      // (or kept in sync on) her linked Google Calendar; anything else has
      // its Google copy removed if one existed. No-ops silently if she
      // hasn't connected Google.
      const googleSynced = await syncEventToGoogle(userId, savedEvent);

      const warning = schedule.issues.find((i) => i.level === "conflict" || i.level === "warning");
      return JSON.stringify({
        saved: true,
        overwritten: !!existing,
        date, startTime, endTime, title, status, googleSynced,
        warning: warning?.message ?? null,
      });
    }

    case "set_office_shift": {
      const date = String(input.date);
      const shiftType = String(input.shiftType) as (typeof OFFICE_SHIFT_TYPES)[number];
      const isPreset = shiftType !== "Off" && shiftType !== "Custom";
      const preset = isPreset ? OFFICE_SHIFT_PRESETS[shiftType as keyof typeof OFFICE_SHIFT_PRESETS] : null;
      const startTime = (input.startTime as string) || preset?.startTime || "";
      const endTime = (input.endTime as string) || preset?.endTime || "";
      const spansNextDay = shiftType === "Custom" && startTime && endTime ? endTime < startTime : preset?.spansNextDay ?? false;

      const existed = await OfficeShift.exists({ userId, date });
      await OfficeShift.findOneAndUpdate(
        { userId, date },
        { $set: { shiftType, startTime, endTime, spansNextDay, customLabel: shiftType === "Custom" ? (input.customLabel as string) || "" : "" } },
        { upsert: true }
      );
      return JSON.stringify({ saved: true, overwritten: !!existed, date, shiftType, startTime, endTime });
    }

    case "check_availability": {
      const date = String(input.date);
      const startTime = input.startTime as string | undefined;
      const endTime = input.endTime as string | undefined;
      const result = await checkTimeAvailability(userId, date, startTime, endTime);
      return JSON.stringify({ date, startTime, endTime, ...result });
    }

    case "list_events": {
      const status = input.status as string | undefined;
      const query: Record<string, unknown> = { userId };
      if (status && status !== "all") query.status = status;
      if (input.from || input.to) {
        query.date = {
          ...(input.from ? { $gte: input.from } : {}),
          ...(input.to ? { $lte: input.to } : {}),
        };
      }
      const limit = typeof input.limit === "number" ? Math.min(input.limit, 50) : 25;
      const events = await Event.find(query).sort({ date: 1, startTime: 1 }).limit(limit).lean();
      return JSON.stringify({
        count: events.length,
        events: events.map((e) => ({
          title: e.title,
          eventType: e.eventType,
          date: e.date,
          dateLabel: formatDateLong(e.date),
          startTime: e.startTime,
          endTime: e.endTime,
          timeLabel: `${formatTime12h(e.startTime)}–${formatTime12h(e.endTime)}`,
          status: e.status,
          venueName: e.venueName,
          clientName: e.clientName,
          fee: e.fee,
          paymentStatus: e.paymentStatus,
        })),
      });
    }

    case "list_pending_payments": {
      const events = await Event.find({ userId, paymentStatus: { $in: ["Pending", "Advance received"] } })
        .sort({ date: 1 })
        .lean();
      return JSON.stringify({
        count: events.length,
        events: events.map((e) => ({
          title: e.title, date: e.date, dateLabel: formatDateLong(e.date),
          fee: e.fee, paymentStatus: e.paymentStatus, clientName: e.clientName,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function handleWithClaude(
  history: { role: "user" | "assistant"; content: string }[],
  userId: string
): Promise<string> {
  const today = todayInIndia();
  const system = `You are the voice/text assistant built into Vaishnavi's Stage, a scheduling app for a professional event anchor/host/emcee. You're talking directly to Vaishnavi -- the app's only user -- so speak to her personally and casually, like a sharp assistant who knows her calendar.

Today's date is ${today} (Asia/Kolkata timezone). Always resolve relative dates ("tomorrow", "next Friday", "this month") against that before calling a tool.

Rules:
- Use the tools for anything involving her real schedule data -- don't guess or make up events, dates, or availability.
- She can ask about her schedule in any phrasing -- "what's confirmed this month", "am I free Friday evening", "anything pending payment" -- answer conversationally using list_events / list_pending_payments / check_availability.
- When she asks you to add or move something, just save it (via create_or_update_event or set_office_shift) -- don't ask for confirmation first, the same way telling Google Assistant "block off Friday evening" just does it. Do mention clearly what you saved.
- New events default to "Tentative" unless she says otherwise -- if she says the booking is confirmed/finalized ("add a confirmed wedding on...", "this one's confirmed"), pass status "Confirmed" directly so it's saved that way in one step, no separate confirm action needed. She can name any status this way (enquiry, tentative, confirmed, completed).
- create_or_update_event's result includes "googleSynced": true when the event was Confirmed and pushed to her linked Google Calendar. If true, briefly mention it ("...and it's on your Google Calendar too"). If she asked for Confirmed but googleSynced is false, she likely hasn't connected Google in Settings -- don't guess why out loud, just don't claim it synced.
- You can only add or update schedule data, never delete or cancel anything, and never change payment status or approve/reject bookings -- if she asks for one of those, tell her to do it from the relevant screen in the app.
- Keep replies short and spoken-friendly (a sentence or two) -- this is read aloud / shown in a small chat bubble, not a report.`;

  const messages: AnthropicMessage[] = history.map((m) => ({ role: m.role, content: m.content }));

  for (let turn = 0; turn < 5; turn++) {
    const response = await callAnthropic(messages, system);

    if (response.stop_reason !== "tool_use") {
      const text = response.content.find((b): b is Extract<AnthropicContentBlock, { type: "text" }> => b.type === "text");
      return text?.text?.trim() || "Done.";
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = await executeTool(block.name, block.input, userId);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return "I'm having trouble finishing that request right now -- please try again in a moment.";
}

// ---------------------------------------------------------------------
// Offline fallback engine: free, rule-based, no external API needed.
// ---------------------------------------------------------------------

async function handleOffline(transcript: string, userId: string) {
  const lower = transcript.toLowerCase();
  const today = todayInIndia();

  // 1. Office shift ("night shift tomorrow", "I'm off on the 5th")
  const shiftIntent = detectOfficeShift(transcript);
  if (shiftIntent) {
    const date = parseDateFromText(transcript, today) ?? today;
    const timeRange = parseTimeRangeFromText(transcript);
    const isPreset = shiftIntent.shiftType !== "Off" && shiftIntent.shiftType !== "Custom";
    const preset = isPreset
      ? OFFICE_SHIFT_PRESETS[shiftIntent.shiftType as keyof typeof OFFICE_SHIFT_PRESETS]
      : { startTime: "", endTime: "", spansNextDay: false };

    const startTime = timeRange?.startTime || preset.startTime;
    const endTime = timeRange?.endTime || preset.endTime;
    const spansNextDay =
      shiftIntent.shiftType === "Custom" && startTime && endTime ? endTime < startTime : preset.spansNextDay;

    const existing = await OfficeShift.findOne({ userId, date }).lean();
    await OfficeShift.findOneAndUpdate(
      { userId, date },
      {
        $set: {
          shiftType: shiftIntent.shiftType,
          startTime,
          endTime,
          spansNextDay,
          customLabel: shiftIntent.shiftType === "Custom" ? shiftIntent.customLabel ?? "" : "",
        },
      },
      { upsert: true }
    );

    const timeText = shiftIntent.shiftType === "Off" ? "" : startTime && endTime ? ` (${startTime}–${endTime})` : "";
    return {
      reply: existing
        ? `Updated your office schedule for ${date}: ${shiftIntent.shiftType}${timeText}. This replaced what was there before.`
        : `Saved: ${shiftIntent.shiftType} shift on ${date}${timeText}. Vaishnavi's Stage will keep bookings clear of this time.`,
      requiresConfirmation: false,
    };
  }

  // 2. Add / create an event
  if (/\b(add|create|new show|schedule|book me|new event)\b/.test(lower)) {
    const date = parseDateFromText(transcript, today);
    if (!date) {
      return {
        reply: "I heard you'd like to add an event, but I couldn't catch the date. Try again with a date, like \"add a wedding on 28 September at 7pm\".",
        requiresConfirmation: false,
      };
    }

    const eventType = detectEventType(transcript) ?? "Other";
    const timeRange = parseTimeRangeFromText(transcript) ?? { startTime: "18:00", endTime: "21:00" };
    const status = detectEventStatus(transcript) ?? "Tentative";
    const result = JSON.parse(
      await executeTool(
        "create_or_update_event",
        { date, startTime: timeRange.startTime, endTime: timeRange.endTime, eventType, status },
        userId
      )
    );

    const statusLine = status === "Tentative" ? "marked Tentative so you can confirm it later" : `marked ${status}`;
    const googleLine = result.googleSynced ? " It's on your Google Calendar too." : "";
    const savedLine = (result.overwritten
      ? `Updated your ${date} ${timeRange.startTime} event to "${eventType}" (${status}) — this replaced what was there before.`
      : `Saved "${eventType}" on ${date}, ${timeRange.startTime}–${timeRange.endTime}, ${statusLine}.`) + googleLine;

    return {
      reply: result.warning ? `${savedLine} Heads up: ${result.warning}` : savedLine,
      requiresConfirmation: false,
    };
  }

  // 3. Availability check with a real date/time, not just a hint to go look.
  if (lower.includes("available") || lower.includes("free on") || lower.includes("free at")) {
    const date = parseDateFromText(transcript, today);
    if (!date) {
      return { reply: "Which date would you like me to check?", requiresConfirmation: false };
    }
    const timeRange = parseTimeRangeFromText(transcript);
    const result = await checkTimeAvailability(userId, date, timeRange?.startTime, timeRange?.endTime);
    const windowText = timeRange ? ` between ${timeRange.startTime} and ${timeRange.endTime}` : "";
    return {
      reply: result.available
        ? `Yes — you're free on ${date}${windowText}.`
        : `No — ${result.reason ?? "you already have something then."} (${date}${windowText})`,
      requiresConfirmation: false,
    };
  }

  // 4. Read-only lookups, including status-specific ones like "confirmed events".
  const statusWord = EVENT_STATUSES.find((s) => lower.includes(s.toLowerCase()));
  if (statusWord && (lower.includes("event") || lower.includes("show") || lower.includes("booking"))) {
    const events = await Event.find({ userId, status: statusWord }).sort({ date: 1 }).limit(10).lean();
    const list = events.map((e) => `${formatDateLong(e.date)}: ${e.title}`).join("; ");
    return {
      reply: events.length
        ? `You have ${events.length} ${statusWord.toLowerCase()} event(s): ${list}.`
        : `No ${statusWord.toLowerCase()} events found.`,
      requiresConfirmation: false,
    };
  }

  if (lower.includes("this week") || lower.includes("my events")) {
    const weekAhead = new Date(today + "T00:00:00Z");
    weekAhead.setUTCDate(weekAhead.getUTCDate() + 7);
    const events = await Event.find({
      userId,
      date: { $gte: today, $lte: weekAhead.toISOString().slice(0, 10) },
      status: { $ne: "Cancelled" },
    })
      .sort({ date: 1 })
      .lean();
    return { reply: `Found ${events.length} event(s) in the next 7 days.`, requiresConfirmation: false };
  }

  if (lower.includes("pending payment")) {
    const events = await Event.find({ userId, paymentStatus: { $in: ["Pending", "Advance received"] } }).lean();
    return { reply: `Found ${events.length} event(s) with pending payment.`, requiresConfirmation: false };
  }

  return {
    reply:
      "I didn't quite catch a specific command. Try something like \"add a confirmed wedding on 28 September at 7pm\", \"add a tentative birthday tomorrow evening\", \"night shift tomorrow\", \"is 5 October evening free?\", or \"what's confirmed this month?\" — all free, no setup needed.",
    requiresConfirmation: false,
  };
}
