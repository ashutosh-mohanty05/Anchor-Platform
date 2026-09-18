
"use client";

import { useEffect, useState } from "react";
import { BellRing, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDateLong, formatTime12h } from "@/lib/utils";

interface ReminderLite {
  _id: string;
  remindAt: string;
  note?: string;
  eventId?: { title: string; date: string; startTime: string } | null;
}

export default function RemindersWidget() {
  const [reminders, setReminders] = useState<ReminderLite[]>([]);

  async function load() {
    const res = await fetch("/api/reminders").then((r) => r.json());
    setReminders(res.reminders ?? []);
  }

  useEffect(() => { load(); }, []);

  async function acknowledge(id: string) {
    await fetch(`/api/reminders/${id}`, { method: "PATCH" });
    setReminders((r) => r.filter((x) => x._id !== id));
  }

  if (reminders.length === 0) return null;

  return (
    <Card>
      <div className="mb-2 flex items-center gap-2">
        <BellRing className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">Upcoming Reminders</h3>
      </div>
      <div className="space-y-2">
        {reminders.map((r) => (
          <div key={r._id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
            <div>
              <p className="text-sm font-semibold">{r.eventId?.title ?? "Event"}</p>
              <p className="text-xs text-muted-foreground">
                {r.eventId ? `${formatDateLong(r.eventId.date)} • ${formatTime12h(r.eventId.startTime)}` : ""}
              </p>
            </div>
            <button
              onClick={() => acknowledge(r._id)}
              className="rounded-full bg-card p-1.5 text-muted-foreground hover:text-primary"
              aria-label="Acknowledge reminder"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
