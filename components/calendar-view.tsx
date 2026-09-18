"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Briefcase } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import EventCard from "@/components/event-card";
import EventFormDialog from "@/components/event-form";
import { EVENT_TYPES, EVENT_STATUSES } from "@/lib/constants";
import type { IEvent } from "@/models/Event";
import { todayInIndia, formatDateLong, formatTime12h } from "@/lib/utils";
import type { OfficeBlock } from "@/lib/office-schedule";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

type EventLite = IEvent & { _id: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView() {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const t = new Date(todayInIndia() + "T00:00:00Z");
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  });
  const [selectedDate, setSelectedDate] = useState(todayInIndia());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventLite | null>(null);
  const [officeBlocks, setOfficeBlocks] = useState<OfficeBlock[]>([]);

  async function load() {
    const res = await fetch(`/api/events`).then((r) => r.json());
    setEvents(res.events ?? []);
  }

  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  useEffect(() => {
    fetch(`/api/office-shifts?date=${selectedDate}`)
      .then((r) => r.json())
      .then((data) => setOfficeBlocks(data.blocks ?? []))
      .catch(() => setOfficeBlocks([]));
  }, [selectedDate]);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (statusFilter === "all" || e.status === statusFilter) &&
          (typeFilter === "all" || e.eventType === typeFilter)
      ),
    [events, statusFilter, typeFilter]
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventLite[]>();
    for (const e of filtered) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [filtered]);

  const monthDays = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const selectedDayEvents = (eventsByDate.get(selectedDate) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));

  function openAddFor(date: string) {
    setEditingEvent(null);
    setSelectedDate(date);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Calendar</h1>
        <Button size="sm" onClick={() => openAddFor(selectedDate)}>
          <Plus className="h-4 w-4" /> Add Event
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EVENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Event type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">Monthly</TabsTrigger>
          <TabsTrigger value="week">Weekly</TabsTrigger>
          <TabsTrigger value="day">Daily</TabsTrigger>
        </TabsList>

        <TabsContent value="month" className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setMonthCursor(addMonths(monthCursor, -1))} className="rounded-full p-2 hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="font-display text-lg font-semibold">
              {monthCursor.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}
            </p>
            <button onClick={() => setMonthCursor(addMonths(monthCursor, 1))} className="rounded-full p-2 hover:bg-secondary">
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
              const dayEvents = eventsByDate.get(dateStr) ?? [];
              const isToday = dateStr === todayInIndia();
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-xs transition-colors ${
                    inMonth ? "" : "opacity-30"
                  } ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-secondary" : "hover:bg-secondary"}`}
                >
                  <span className="font-semibold">{day.getUTCDate()}</span>
                  {dayEvents.length > 0 && (
                    <span className="mt-0.5 flex gap-0.5">
                      {dayEvents.slice(0, 3).map((e, i) => (
                        <span
                          key={i}
                          className={`h-1.5 w-1.5 rounded-full ${
                            isSelected ? "bg-primary-foreground" : e.status === "Confirmed" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-sm font-semibold">{formatDateLong(selectedDate)}</p>
            {officeBlocks.map((b, i) => <OfficeBlockCard key={i} block={b} />)}
            {selectedDayEvents.length === 0 ? (
              <button
                onClick={() => openAddFor(selectedDate)}
                className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-secondary"
              >
                No events yet — tap to add one for this date
              </button>
            ) : (
              selectedDayEvents.map((e) => (
                <EventCard key={e._id} event={e} onChanged={load} onEdit={() => { setEditingEvent(e); setFormOpen(true); }} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="week" className="mt-4 space-y-2">
          {buildWeekDays(selectedDate).map((dateStr) => {
            const dayEvents = (eventsByDate.get(dateStr) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
            return (
              <div key={dateStr}>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">{formatDateLong(dateStr)}</p>
                {dayEvents.length === 0 ? (
                  <p className="mb-3 text-xs text-muted-foreground/70">No events</p>
                ) : (
                  <div className="mb-3 space-y-2">
                    {dayEvents.map((e) => (
                      <EventCard key={e._id} event={e} onChanged={load} onEdit={() => { setEditingEvent(e); setFormOpen(true); }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="day" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} className="rounded-full p-2 hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold">{formatDateLong(selectedDate)}</p>
            <button onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} className="rounded-full p-2 hover:bg-secondary">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {officeBlocks.map((b, i) => <OfficeBlockCard key={i} block={b} />)}
          {selectedDayEvents.length === 0 ? (
            <button
              onClick={() => openAddFor(selectedDate)}
              className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-secondary"
            >
              No events yet — tap to add one for this date
            </button>
          ) : (
            selectedDayEvents.map((e) => (
              <EventCard key={e._id} event={e} onChanged={load} onEdit={() => { setEditingEvent(e); setFormOpen(true); }} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <EventFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingEvent(null); }}
        onSaved={load}
        event={editingEvent}
        initialDate={selectedDate}
      />
    </div>
  );
}

function OfficeBlockCard({ block }: { block: OfficeBlock }) {
  return (
    <Card className="flex items-center justify-between border-dashed bg-secondary/50 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-muted-foreground">
          <Briefcase className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{block.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatTime12h(block.startTime)} – {formatTime12h(block.endTime)} • Unavailable for events
          </p>
        </div>
      </div>
    </Card>
  );
}

function buildMonthGrid(monthStart: Date): Date[] {
  const start = new Date(monthStart);
  const startWeekday = start.getUTCDay();
  const gridStart = new Date(start);
  gridStart.setUTCDate(gridStart.getUTCDate() - startWeekday);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setUTCDate(gridStart.getUTCDate() + i);
    days.push(d);
  }
  return days;
}

function addMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function buildWeekDays(dateStr: string): string[] {
  const d = new Date(dateStr + "T00:00:00Z");
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}

function shiftDate(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
