"use client";

import { useState } from "react";
import {
  MoreVertical, Pencil, Copy, Trash2, Download, CheckCircle2, XCircle, Clock3, BellRing,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime12h, formatINR } from "@/lib/utils";
import { googleCalendarAddLink } from "@/lib/calendar";
import type { IEvent } from "@/models/Event";

type EventLite = IEvent & { _id: string };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  Enquiry: "secondary",
  Tentative: "warning",
  Confirmed: "success",
  Completed: "default",
  Cancelled: "destructive",
};

export default function EventCard({
  event, onEdit, onChanged,
}: { event: EventLite; onEdit: () => void; onChanged: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setStatus(status: string) {
    setBusy(true);
    await fetch(`/api/events/${event._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    setMenuOpen(false);
    onChanged();
  }

  async function duplicate() {
    setBusy(true);
    await fetch(`/api/events/${event._id}/duplicate`, { method: "POST" });
    setBusy(false);
    setMenuOpen(false);
    onChanged();
  }

  async function addReminder(offset: "1_week_before" | "2_days_before" | "1_day_before" | "2_hours_before") {
    setBusy(true);
    await fetch(`/api/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event._id, offset }),
    });
    setBusy(false);
    setMenuOpen(false);
  }

  async function remove() {
    if (!confirm(`Delete "${event.title}"? This can't be undone.`)) return;
    setBusy(true);
    await fetch(`/api/events/${event._id}`, { method: "DELETE" });
    setBusy(false);
    setMenuOpen(false);
    onChanged();
  }

  return (
    <Card className="relative">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h4 className="font-display text-base font-semibold">{event.title}</h4>
            <Badge variant={STATUS_VARIANT[event.status] ?? "secondary"}>{event.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{event.eventType} • {event.slot}</p>
          <p className="mt-1 flex items-center gap-1 text-sm">
            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
            {formatTime12h(event.startTime)}–{formatTime12h(event.endTime)}
          </p>
          {event.venueName && <p className="text-xs text-muted-foreground">{event.venueName}</p>}
          {event.fee ? <p className="mt-1 text-sm font-semibold">{formatINR(event.fee)}</p> : null}
        </div>

        <div className="relative">
          <button
            className="rounded-full p-1.5 hover:bg-secondary"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Event options"
            disabled={busy}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
              <MenuItem icon={Pencil} label="Edit" onClick={() => { setMenuOpen(false); onEdit(); }} />
              <MenuItem icon={Copy} label="Duplicate" onClick={duplicate} />
              {event.status !== "Tentative" && (
                <MenuItem icon={Clock3} label="Mark Tentative" onClick={() => setStatus("Tentative")} />
              )}
              {event.status !== "Confirmed" && (
                <MenuItem icon={CheckCircle2} label="Confirm" onClick={() => setStatus("Confirmed")} />
              )}
              {event.status !== "Completed" && (
                <MenuItem icon={CheckCircle2} label="Mark Completed" onClick={() => setStatus("Completed")} />
              )}
              {event.status !== "Cancelled" && (
                <MenuItem icon={XCircle} label="Cancel Event" onClick={() => setStatus("Cancelled")} />
              )}
              <a
                href={`/api/events/${event._id}/ics`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"
              >
                <Download className="h-4 w-4" /> Export to Calendar
              </a>
              <a
                href={googleCalendarAddLink(event)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary"
              >
                <Download className="h-4 w-4" /> Add to Google Calendar
              </a>
              <MenuItem icon={BellRing} label="Remind Me 1 Day Before" onClick={() => addReminder("1_day_before")} />
              <MenuItem icon={Trash2} label="Delete" onClick={remove} destructive />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function MenuItem({
  icon: Icon, label, onClick, destructive,
}: { icon: React.ElementType; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary ${destructive ? "text-destructive" : ""}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
