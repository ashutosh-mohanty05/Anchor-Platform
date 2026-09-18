"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sun, Sunset, Moon, CalendarOff, Loader2, Wand2, Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateLong, formatTime12h, todayInIndia } from "@/lib/utils";
import { OFFICE_SHIFT_PRESETS, OFFICE_SHIFT_CUSTOM_COLORS } from "@/lib/constants";
import type { IOfficeShift, OfficeShiftType } from "@/models/OfficeShift";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

type ShiftLite = IOfficeShift & { _id: string };

const DEFAULT_CUSTOM_COLOR = OFFICE_SHIFT_CUSTOM_COLORS[0].value;

// Every shift type gets its own distinct color. "Custom" shifts also carry
// their own per-shift hex color (shift.color) chosen in the edit dialog,
// which always takes priority over this fallback swatch.
//
// NOTE: `dotClass` values are written out in full ("bg-amber-500", not
// built by string-splicing a "text-amber-500" class at runtime). Tailwind
// only generates CSS for class names it can find literally in the source —
// a class assembled at runtime (e.g. via .replace("text-", "bg-")) is
// invisible to it and silently produces no styles at all. That's why
// Afternoon and Night previously showed no color: "bg-orange-500" and
// "bg-indigo-500" never appeared anywhere as literal text, so Tailwind
// never generated them, while Morning/Off happened to work only because
// "bg-amber-500"/"bg-emerald-500" happen to appear verbatim elsewhere in
// the app.
const SHIFT_META: Record<OfficeShiftType, { icon: React.ElementType; color: string; dotClass: string; label: string }> = {
  Morning: { icon: Sun, color: "text-amber-500 bg-amber-50", dotClass: "bg-amber-500", label: "Morning Shift" },
  Afternoon: { icon: Sunset, color: "text-orange-500 bg-orange-50", dotClass: "bg-orange-500", label: "Afternoon Shift" },
  Night: { icon: Moon, color: "text-indigo-500 bg-indigo-50", dotClass: "bg-indigo-500", label: "Night Shift" },
  Custom: { icon: Palette, color: "text-teal-600 bg-teal-50", dotClass: "bg-teal-500", label: "Custom Shift" },
  Off: { icon: CalendarOff, color: "text-emerald-500 bg-emerald-50", dotClass: "bg-emerald-500", label: "Off Day" },
};

/** Resolve the display label + dot color for one shift, honoring a custom shift's own name/color. */
function shiftDisplay(shift: ShiftLite | null | undefined): { label: string; dotStyle: React.CSSProperties; dotClass: string } {
  if (!shift) return { label: "", dotStyle: {}, dotClass: "" };
  const meta = SHIFT_META[shift.shiftType];
  if (shift.shiftType === "Custom") {
    const color = shift.color || DEFAULT_CUSTOM_COLOR;
    return {
      label: shift.customLabel || meta.label,
      dotStyle: { backgroundColor: color },
      dotClass: "",
    };
  }
  return { label: meta.label, dotStyle: {}, dotClass: meta.dotClass };
}

function addDays(date: string, delta: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(date: string): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}

export default function OfficeSchedule() {
  const [shifts, setShifts] = useState<ShiftLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayInIndia()));
  const [monthCursor, setMonthCursor] = useState(() => {
    const t = new Date(todayInIndia() + "T00:00:00Z");
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  });
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [quickFillOpen, setQuickFillOpen] = useState(false);

  const rangeStart = useMemo(() => {
    const s = new Date(monthCursor);
    s.setUTCDate(s.getUTCDate() - 7);
    return s.toISOString().slice(0, 10);
  }, [monthCursor]);
  const rangeEnd = useMemo(() => {
    const e = new Date(Date.UTC(monthCursor.getUTCFullYear(), monthCursor.getUTCMonth() + 1, 7));
    return e.toISOString().slice(0, 10);
  }, [monthCursor]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/office-shifts?from=${rangeStart}&to=${rangeEnd}`).then((r) => r.json());
    setShifts(res.shifts ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [rangeStart, rangeEnd]); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresh(load);

  const byDate = useMemo(() => {
    const map = new Map<string, ShiftLite>();
    for (const s of shifts) map.set(s.date, s);
    return map;
  }, [shifts]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Office Schedule</h1>
        <Button size="sm" variant="secondary" onClick={() => setQuickFillOpen(true)}>
          <Wand2 className="h-3.5 w-3.5" /> Quick Fill
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Set your day-job shifts here — Vaishnavi&apos;s Stage will automatically block those hours
        from bookings so clients never see you as available while you&apos;re at office.
      </p>

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="rounded-full p-2 hover:bg-secondary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold">
              {formatDateLong(weekStart).split(",")[1]} – {formatDateLong(addDays(weekStart, 6)).split(",")[1]}
            </p>
            <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="rounded-full p-2 hover:bg-secondary">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {weekDays.map((date) => {
                const shift = byDate.get(date);
                const meta = shift ? SHIFT_META[shift.shiftType] : null;
                const Icon = meta?.icon ?? CalendarOff;
                const isToday = date === todayInIndia();
                const display = shiftDisplay(shift);
                const isCustom = shift?.shiftType === "Custom";
                return (
                  <Card
                    key={date}
                    className={`flex cursor-pointer items-center justify-between py-3 ${isToday ? "ring-2 ring-primary/40" : ""}`}
                    onClick={() => setEditingDate(date)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 shrink-0">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", timeZone: "UTC" })}
                        </p>
                        <p className="font-display text-base font-semibold">
                          {new Date(date + "T00:00:00Z").getUTCDate()}{" "}
                          {new Date(date + "T00:00:00Z").toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
                        </p>
                      </div>
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${isCustom ? "" : meta?.color ?? "bg-secondary text-muted-foreground"}`}
                        style={isCustom ? { backgroundColor: `${display.dotStyle.backgroundColor}20`, color: display.dotStyle.backgroundColor as string } : undefined}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        {shift ? (
                          <>
                            <p className="text-sm font-semibold">{display.label}</p>
                            {shift.shiftType !== "Off" && (
                              <p className="text-xs text-muted-foreground">
                                {formatTime12h(shift.startTime)} – {formatTime12h(shift.endTime)}
                                {shift.spansNextDay ? " (next day)" : ""}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not set — tap to add</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
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
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {buildMonthGrid(monthCursor).map((day) => {
              const dateStr = day.toISOString().slice(0, 10);
              const inMonth = day.getUTCMonth() === monthCursor.getUTCMonth();
              const shift = byDate.get(dateStr);
              const display = shiftDisplay(shift);
              return (
                <button
                  key={dateStr}
                  onClick={() => setEditingDate(dateStr)}
                  className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-xs transition-colors hover:bg-secondary ${
                    inMonth ? "" : "opacity-30"
                  }`}
                >
                  <span className="font-semibold">{day.getUTCDate()}</span>
                  {shift && (
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${display.dotClass}`}
                      style={display.dotStyle}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {(Object.keys(SHIFT_META) as OfficeShiftType[])
              .filter((k) => k !== "Custom")
              .map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${SHIFT_META[k].dotClass}`} /> {SHIFT_META[k].label}
                </span>
              ))}
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DEFAULT_CUSTOM_COLOR }} /> Custom (own color)
            </span>
          </div>
        </TabsContent>
      </Tabs>

      <ShiftEditDialog
        date={editingDate}
        shift={editingDate ? byDate.get(editingDate) ?? null : null}
        onClose={() => setEditingDate(null)}
        onSaved={() => { load(); setEditingDate(null); }}
      />

      <QuickFillDialog open={quickFillOpen} onOpenChange={setQuickFillOpen} onSaved={load} />
    </div>
  );
}

function ShiftEditDialog({
  date, shift, onClose, onSaved,
}: { date: string | null; shift: ShiftLite | null; onClose: () => void; onSaved: () => void }) {
  const [shiftType, setShiftType] = useState<OfficeShiftType>("Morning");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_CUSTOM_COLOR);
  const [customLabel, setCustomLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShiftType(shift?.shiftType ?? "Morning");
    setStartTime(shift?.startTime ?? "");
    setEndTime(shift?.endTime ?? "");
    setNote(shift?.note ?? "");
    setColor(shift?.color || DEFAULT_CUSTOM_COLOR);
    setCustomLabel(shift?.customLabel ?? "");
  }, [shift, date]);

  async function save() {
    if (!date) return;
    setSaving(true);
    await fetch("/api/office-shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        shiftType,
        startTime,
        endTime,
        note,
        color: shiftType === "Custom" ? color : "",
        customLabel: shiftType === "Custom" ? customLabel : "",
      }),
    });
    setSaving(false);
    onSaved();
  }

  async function remove() {
    if (!date) return;
    setSaving(true);
    await fetch(`/api/office-shifts?date=${date}`, { method: "DELETE" });
    setSaving(false);
    onSaved();
  }

  if (!date) return null;

  return (
    <Dialog open={!!date} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{formatDateLong(date)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SHIFT_META) as OfficeShiftType[]).map((k) => {
              const meta = SHIFT_META[k];
              const Icon = meta.icon;
              const active = shiftType === k;
              const preset = k === "Off" || k === "Custom" ? null : OFFICE_SHIFT_PRESETS[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setShiftType(k);
                    if (preset) {
                      setStartTime(preset.startTime);
                      setEndTime(preset.endTime);
                    } else if (k === "Off") {
                      setStartTime("");
                      setEndTime("");
                    }
                    // Custom: leave whatever time was already typed as-is.
                  }}
                  className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs font-semibold transition-colors ${
                    active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {meta.label}
                  {preset && (
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {preset.startTime}–{preset.endTime}
                    </span>
                  )}
                  {k === "Custom" && (
                    <span className="text-[10px] font-normal text-muted-foreground">Pick your own time</span>
                  )}
                </button>
              );
            })}
          </div>

          {shiftType === "Custom" && (
            <div className="space-y-3 rounded-xl bg-secondary/60 p-3">
              <div>
                <Label className="text-xs">Shift name</Label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="e.g. Salon appointment"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {OFFICE_SHIFT_CUSTOM_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      aria-label={c.name}
                      className={`h-7 w-7 rounded-full border-2 transition-transform ${
                        color === c.value ? "scale-110 border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {shiftType !== "Off" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start time</Label>
                <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">End time</Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Note (optional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" placeholder="e.g. Covering for a colleague" />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </Button>
            {shift && (
              <Button variant="outline" onClick={remove} disabled={saving}>Clear</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuickFillDialog({
  open, onOpenChange, onSaved,
}: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const [shiftType, setShiftType] = useState<OfficeShiftType>("Morning");
  const [from, setFrom] = useState(todayInIndia());
  const [to, setTo] = useState(todayInIndia());
  const [weekdaysOnly, setWeekdaysOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  async function apply() {
    setSaving(true);
    let cursor = from;
    const requests: Promise<Response>[] = [];
    while (cursor <= to) {
      const day = new Date(cursor + "T00:00:00Z").getUTCDay();
      const skip = weekdaysOnly && (day === 0 || day === 6);
      if (!skip) {
        const preset =
          shiftType === "Off" || shiftType === "Custom"
            ? { startTime: "", endTime: "" }
            : OFFICE_SHIFT_PRESETS[shiftType];
        requests.push(
          fetch("/api/office-shifts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: cursor, shiftType, ...preset }),
          })
        );
      }
      cursor = addDays(cursor, 1);
    }
    await Promise.all(requests);
    setSaving(false);
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Fill Office Schedule</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Apply one shift pattern across a whole date range at once — handy for setting up a full month.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SHIFT_META) as OfficeShiftType[])
              .filter((k) => k !== "Custom")
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setShiftType(k)}
                  className={`rounded-2xl border p-2 text-xs font-semibold transition-colors ${
                    shiftType === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                  }`}
                >
                  {SHIFT_META[k].label}
                </button>
              ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Custom shifts aren&apos;t available in Quick Fill — add those one date at a time from the calendar
            so each can have its own name and color.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={weekdaysOnly} onChange={(e) => setWeekdaysOnly(e.target.checked)} />
            Weekdays only (skip Sat &amp; Sun)
          </label>
          <Button className="w-full" onClick={apply} disabled={saving || from > to}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apply to Range
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
