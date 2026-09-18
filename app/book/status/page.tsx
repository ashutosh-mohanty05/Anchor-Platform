"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, CalendarClock, XCircle, Loader2,
  MessageCircle, CalendarPlus, Ticket, CalendarDays, MapPin, Heart,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateLong, formatTime12h, waLink } from "@/lib/utils";

interface TrackedBooking {
  referenceId: string;
  clientName: string;
  eventType: string;
  preferredDate: string;
  preferredSlot: string;
  status: string;
  suggestedDate: string;
  suggestedNote: string;
}
interface TrackedEvent {
  venueName: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
}

const STEPS = [
  { key: "Pending", icon: Clock, title: "Pending", desc: "Your request is under review." },
  { key: "Approved", icon: CheckCircle2, title: "Approved", desc: "Your event is confirmed!" },
  { key: "Rescheduled", icon: CalendarClock, title: "Reschedule Requested", desc: "A new date has been suggested." },
  { key: "Rejected", icon: XCircle, title: "Rejected", desc: "Sorry, we are unable to accommodate this request." },
] as const;

function displayStep(status: string): (typeof STEPS)[number]["key"] {
  if (status === "Approved") return "Approved";
  if (status === "Rescheduled") return "Rescheduled";
  if (status === "Rejected") return "Rejected";
  return "Pending"; // New, Reviewing, Tentative
}

function StatusContent() {
  const params = useSearchParams();
  const router = useRouter();
  const initialRef = params.get("ref") ?? "";

  const [refInput, setRefInput] = useState(initialRef);
  const [phoneInput, setPhoneInput] = useState("");
  const [booking, setBooking] = useState<TrackedBooking | null>(null);
  const [event, setEvent] = useState<TrackedEvent | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [displayName, setDisplayName] = useState("Vaishnavi");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(ref: string, phone?: string) {
    if (!ref.trim()) return;
    setLoading(true);
    setError(null);
    setBooking(null);
    try {
      const qs = new URLSearchParams({ ref: ref.trim() });
      if (phone) qs.set("phone", phone);
      const res = await fetch(`/api/bookings/track?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setBooking(data.booking);
      setEvent(data.event);
      setWhatsappNumber(data.contact?.whatsappNumber ?? "");
      setDisplayName(data.contact?.displayName ?? "Vaishnavi");
      router.replace(`/book/status?ref=${data.booking.referenceId}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialRef) lookup(initialRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function icsUrl() {
    if (!event) return "#";
    const start = `${event.date.replace(/-/g, "")}T${event.startTime.replace(":", "")}00`;
    const end = `${event.date.replace(/-/g, "")}T${event.endTime.replace(":", "")}00`;
    const details = encodeURIComponent(`${booking?.eventType ?? "Event"} with ${displayName}`);
    const location = encodeURIComponent(`${event.venueName} ${event.location}`.trim());
    const text = encodeURIComponent(`${booking?.eventType ?? "Event"} - ${displayName}`);
    return `data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ADTSTART:${start}%0ADTEND:${end}%0ASUMMARY:${text}%0ADESCRIPTION:${details}%0ALOCATION:${location}%0AEND:VEVENT%0AEND:VCALENDAR`;
  }

  return (
    <div className="min-h-screen" data-theme="rose">
      <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/book" className="rounded-full p-2 hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-semibold">Your Booking Status</h1>
        </div>

        {!booking && (
          <Card>
            <h2 className="mb-1 font-display text-base font-semibold">Find your request</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Enter the reference ID you received after submitting your request.
            </p>
            <div className="space-y-3">
              <div>
                <Label>Reference ID</Label>
                <Input value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="VS-7K2N9QX" className="mt-1" />
              </div>
              <div>
                <Label>Phone Number (optional)</Label>
                <Input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder="98765 43210" className="mt-1" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" onClick={() => lookup(refInput, phoneInput)} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Check Status
              </Button>
            </div>
          </Card>
        )}

        {loading && !booking && (
          <div className="mt-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        )}

        {booking && booking.status === "Approved" && (
          <ConfirmedDetails booking={booking} event={event} whatsappNumber={whatsappNumber} displayName={displayName} icsUrl={icsUrl()} />
        )}

        {booking && booking.status !== "Approved" && (
          <StatusStepper booking={booking} />
        )}

        {booking && (
          <button
            onClick={() => { setBooking(null); setError(null); }}
            className="mt-4 block w-full text-center text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
          >
            Check a different reference ID
          </button>
        )}
      </div>
    </div>
  );
}

function StatusStepper({ booking }: { booking: TrackedBooking }) {
  const current = displayStep(booking.status);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card>
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Ticket className="h-3.5 w-3.5" /> Ref: {booking.referenceId} • {booking.eventType} • {formatDateLong(booking.preferredDate)}
        </div>
        <div className="space-y-0">
          {STEPS.map((step, i) => {
            const isCurrent = step.key === current;
            const isRejectedRow = step.key === "Rejected";
            const Icon = step.icon;
            return (
              <div key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
                {i < STEPS.length - 1 && (
                  <span className="absolute left-[15px] top-8 h-full w-px bg-border" />
                )}
                <div
                  className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isCurrent
                      ? isRejectedRow
                        ? "bg-destructive text-destructive-foreground"
                        : "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className={isCurrent ? "" : "opacity-50"}>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.key === "Rescheduled" && isCurrent && booking.suggestedDate
                      ? `Suggested date: ${formatDateLong(booking.suggestedDate)}${booking.suggestedNote ? ` — ${booking.suggestedNote}` : ""}`
                      : step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Heart className="h-3.5 w-3.5 text-primary" /> We&apos;ll notify you via WhatsApp or email with an update.
      </p>
    </motion.div>
  );
}

function ConfirmedDetails({
  booking, event, whatsappNumber, displayName, icsUrl,
}: {
  booking: TrackedBooking; event: TrackedEvent | null; whatsappNumber: string; displayName: string; icsUrl: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100"
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </motion.div>
        <h1 className="font-display text-xl font-semibold">Booking Confirmed!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;re excited to be part of your special day!
        </p>

        <div className="mt-5 space-y-3 text-left">
          <DetailRow icon={Ticket} label="Event" value={booking.eventType} />
          {event && <DetailRow icon={CalendarDays} label="Date" value={formatDateLong(event.date)} />}
          {event && <DetailRow icon={Clock} label="Time" value={`${formatTime12h(event.startTime)} - ${formatTime12h(event.endTime)}`} />}
          {event?.venueName && <DetailRow icon={MapPin} label="Venue" value={`${event.venueName}${event.location ? `, ${event.location}` : ""}`} />}
        </div>

        <div className="mt-5 space-y-2">
          {whatsappNumber && (
            <a href={waLink(whatsappNumber, `Hi ${displayName}! Excited about our confirmed event (${booking.referenceId}).`)} target="_blank" rel="noreferrer">
              <Button className="w-full bg-emerald-500 text-white hover:bg-emerald-600">
                <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
              </Button>
            </a>
          )}
          {event && (
            <a href={icsUrl} download={`${booking.eventType}-${booking.referenceId}.ics`}>
              <Button variant="outline" className="w-full">
                <CalendarPlus className="h-4 w-4" /> Add to Calendar
              </Button>
            </a>
          )}
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          Looking forward to creating beautiful memories together! <Heart className="inline h-3 w-3 text-primary" />
        </p>
      </Card>
    </motion.div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function BookingStatusPage() {
  return (
    <Suspense>
      <StatusContent />
    </Suspense>
  );
}
