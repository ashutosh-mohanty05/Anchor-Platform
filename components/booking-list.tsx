"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, Eye, MessageCircle, AlertTriangle, Loader2, Clock, User, CalendarClock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateLong, formatTime12h, waLink } from "@/lib/utils";
import { BOOKING_STATUSES } from "@/lib/constants";
import type { IBookingRequest } from "@/models/BookingRequest";
import type { ScheduleCheckResult } from "@/lib/scheduling";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

type BookingLite = IBookingRequest & { _id: string };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  New: "warning",
  Reviewing: "secondary",
  Tentative: "default",
  Rescheduled: "default",
  Approved: "success",
  Rejected: "destructive",
};

export default function BookingList() {
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<BookingLite | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/bookings").then((r) => r.json());
    setBookings(res.bookings ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  const filtered = useMemo(
    () => (filter === "all" ? bookings : bookings.filter((b) => b.status === filter)),
    [bookings, filter]
  );

  return (
    <div className="space-y-4 pb-6">
      <h1 className="font-display text-2xl font-semibold">Booking Requests</h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          {BOOKING_STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!loading && filtered.length === 0 && (
        <Card className="text-center text-sm text-muted-foreground">No booking requests here yet.</Card>
      )}

      <div className="space-y-3">
        {filtered.map((b) => (
          <Card key={b._id}>
            <div className="flex items-start justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="font-display text-base font-semibold">{b.clientName}</h4>
                  <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{b.eventType}</p>
                <p className="mt-1 flex items-center gap-1 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDateLong(b.preferredDate)} • {b.preferredSlot}
                  {b.preferredStartTime ? ` (${formatTime12h(b.preferredStartTime)})` : ""}
                </p>
                <p className="text-xs text-muted-foreground">Ref: {b.referenceId}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(b)}>
                <Eye className="h-3.5 w-3.5" /> View
              </Button>
              {b.phone && (
                <a href={waLink(b.phone, `Hi ${b.clientName}! Thanks for your booking request (${b.referenceId}). `)} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="secondary" type="button">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      <BookingDetailDialog
        booking={selected}
        onClose={() => setSelected(null)}
        onChanged={() => { load(); setSelected(null); }}
      />
    </div>
  );
}

function BookingDetailDialog({
  booking, onClose, onChanged,
}: { booking: BookingLite | null; onClose: () => void; onChanged: () => void }) {
  const [schedule, setSchedule] = useState<ScheduleCheckResult | null>(null);
  const [notes, setNotes] = useState("");
  const [suggestedDate, setSuggestedDate] = useState("");
  const [suggestedNote, setSuggestedNote] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchedule(null);
    setError(null);
    setShowReschedule(false);
    setNotes(booking?.privateNotes ?? "");
    setSuggestedDate(booking?.suggestedDate ?? "");
    setSuggestedNote(booking?.suggestedNote ?? "");
    if (booking) {
      fetch(`/api/bookings/${booking._id}`)
        .then((r) => r.json())
        .then((data) => setSchedule(data.schedule ?? null));
    }
  }, [booking]);

  async function updateStatus(status: string, confirmDespiteConflict = false) {
    if (!booking) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${booking._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          privateNotes: notes,
          confirmDespiteConflict,
          ...(status === "Rescheduled" ? { suggestedDate, suggestedNote } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setSchedule(data.schedule);
        setError("There's a scheduling conflict. Review it below, then confirm if you'd like to approve anyway.");
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return null;

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="h-4 w-4" /> {booking.clientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Row label="Event type" value={booking.eventType} />
          <Row label="Preferred date" value={formatDateLong(booking.preferredDate)} />
          <Row label="Preferred slot" value={booking.preferredSlot} />
          {booking.preferredStartTime && (
            <Row label="Time" value={`${formatTime12h(booking.preferredStartTime)} – ${booking.preferredEndTime ? formatTime12h(booking.preferredEndTime) : ""}`} />
          )}
          <Row label="Location" value={booking.location || "—"} />
          <Row label="Phone" value={booking.phone} />
          {booking.email && <Row label="Email" value={booking.email} />}
          {booking.audienceSize ? <Row label="Audience size" value={String(booking.audienceSize)} /> : null}
          {booking.message && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Message</p>
              <p className="mt-0.5 whitespace-pre-line">{booking.message}</p>
            </div>
          )}

          {schedule && (
            <div className={`rounded-xl p-3 text-xs ${schedule.comfortable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {schedule.issues.map((issue, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {issue.message}
                </p>
              ))}
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Private notes</p>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {showReschedule && (
            <div className="space-y-2 rounded-xl bg-secondary/60 p-3">
              <div>
                <Label className="text-xs">Suggest a new date</Label>
                <Input type="date" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Note to client (optional)</Label>
                <Textarea
                  value={suggestedNote}
                  onChange={(e) => setSuggestedNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. Your original date clashes with an office shift — would this date work instead?"
                  className="mt-1"
                />
              </div>
              <Button size="sm" disabled={busy || !suggestedDate} onClick={() => updateStatus("Rescheduled")}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send Reschedule Suggestion
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            {booking.status !== "Reviewing" && booking.status !== "Approved" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateStatus("Reviewing")}>Mark Reviewing</Button>
            )}
            {booking.status !== "Approved" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setShowReschedule((s) => !s)}>
                <CalendarClock className="h-3.5 w-3.5" /> Suggest Reschedule
              </Button>
            )}
            {booking.status !== "Approved" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => updateStatus("Approved", !!(schedule && !schedule.comfortable))}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {schedule && !schedule.comfortable ? "Approve Anyway" : "Approve"}
              </Button>
            )}
            {booking.status !== "Rejected" && (
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => updateStatus("Rejected")}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
