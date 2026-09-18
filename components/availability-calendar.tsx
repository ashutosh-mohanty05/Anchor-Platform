"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateLong, todayInIndia } from "@/lib/utils";
import type { PublicDayAvailability } from "@/lib/availability";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// One dot, one meaning -- no separate morning/evening dots to interpret.
const STATUS_DOT: Record<string, string> = {
  available: "bg-emerald-500",
  booked: "bg-rose-500",
};

export default function AvailabilityCalendar({
  availability, selectedDate, onSelectDate,
}: {
  availability: PublicDayAvailability[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const t = new Date(todayInIndia() + "T00:00:00Z");
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  });

  const byDate = useMemo(() => {
    const map = new Map<string, PublicDayAvailability>();
    for (const d of availability) map.set(d.date, d);
    return map;
  }, [availability]);

  const monthDays = useMemo(() => {
    const start = new Date(monthCursor);
    const startWeekday = start.getUTCDay();
    const gridStart = new Date(start);
    gridStart.setUTCDate(gridStart.getUTCDate() - startWeekday);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setUTCDate(gridStart.getUTCDate() + i);
      return d;
    });
  }, [monthCursor]);

  const selectedInfo = byDate.get(selectedDate);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => setMonthCursor(new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() - 1, 1)))}
          className="rounded-full p-2 hover:bg-secondary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-lg font-semibold">
          {monthCursor.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
        </p>
        <button
          onClick={() => setMonthCursor(new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 1)))}
          className="rounded-full p-2 hover:bg-secondary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {WEEKDAYS.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthDays.map((day) => {
          const dateStr = day.toISOString().slice(0, 10);
          const inMonth = day.getUTCMonth() === monthCursor.getUTCMonth();
          const info = byDate.get(dateStr);
          const isPast = dateStr < todayInIndia();
          const isSelected = dateStr === selectedDate;
          const disabled = !info || isPast;
          return (
            <button
              key={dateStr}
              disabled={disabled}
              onClick={() => onSelectDate(dateStr)}
              className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-xs transition-colors disabled:opacity-30 ${
                inMonth ? "" : "opacity-30"
              } ${isSelected ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
            >
              <span className="font-semibold">{day.getUTCDate()}</span>
              {info && (
                <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : STATUS_DOT[info.status]}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Likely available</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" /> Already booked</span>
      </div>

      {selectedInfo && (
        <div className="mt-4 rounded-xl bg-secondary p-3 text-sm">
          <p className="font-semibold">{formatDateLong(selectedDate)}</p>
          <p className="mt-1 text-xs">
            {selectedInfo.status === "available"
              ? "Looks open on this date — pick your exact time below and we'll double-check it for you."
              : "This date already has something on it, but every event has a specific time — enter yours below and we'll check the exact window."}
          </p>
        </div>
      )}
    </div>
  );
}
