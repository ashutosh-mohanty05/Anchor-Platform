"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, PlusCircle, CalendarDays, MessageSquareText, ClipboardList, Share2, Mic,
  Sun, Moon, Clock, IndianRupee, CalendarClock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  greetingForNow, todayInIndia, formatTime12h, formatDateLong, formatINR,
} from "@/lib/utils";
import { checkSchedule, type ScheduleEventLike } from "@/lib/scheduling";
import type { IEvent } from "@/models/Event";
import type { IBookingRequest } from "@/models/BookingRequest";
import EventFormDialog from "@/components/event-form";
import RemindersWidget from "@/components/reminders-widget";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

type EventLite = IEvent & { _id: string };

export default function Dashboard({ displayName, image }: { displayName: string; image?: string }) {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [bookings, setBookings] = useState<(IBookingRequest & { _id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const today = todayInIndia();

  async function load() {
    setLoading(true);
    const [evRes, bkRes] = await Promise.all([
      fetch(`/api/events?from=${today}`).then((r) => r.json()),
      fetch(`/api/bookings?status=New`).then((r) => r.json()),
    ]);
    setEvents(evRes.events ?? []);
    setBookings(bkRes.bookings ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useAutoRefresh(load);

  const upcoming = useMemo(
    () => events.filter((e) => e.status !== "Cancelled").sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime)),
    [events]
  );
  const nextShow = upcoming[0];
  const todaysEvents = upcoming.filter((e) => e.date === today);
  const morningEvent = todaysEvents.find((e) => e.slot === "Morning") ?? todaysEvents[0];
  const eveningEvent = todaysEvents.find((e) => e.slot === "Evening" && e._id !== morningEvent?._id);
  const next7Days = upcoming.filter((e) => e.date !== today).slice(0, 6);
  const pendingPayments = events.filter((e) =>
    ["Pending", "Advance received"].includes(e.paymentStatus) && e.status !== "Cancelled"
  );

  const todayScheduleNote = useMemo(() => {
    if (todaysEvents.length < 2) return null;
    const [a, b] = [...todaysEvents].sort((x, y) => x.startTime.localeCompare(y.startTime));
    const result = checkSchedule(a as unknown as ScheduleEventLike, [b as unknown as ScheduleEventLike]);
    return result;
  }, [todaysEvents]);

  const countdown = useCountdown(nextShow);

  return (
    <div className="space-y-5 pb-6">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-muted-foreground">{greetingForNow()},</p>
          <h1 className="font-display text-2xl font-semibold">{displayName.split(" ")[0]}! <span className="align-middle text-primary">♡</span></h1>
        </div>
        <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-primary/30 bg-secondary">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-lg text-primary">
              {displayName[0]}
            </div>
          )}
        </div>
      </motion.header>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        <QuickAction icon={PlusCircle} label="Add Show" onClick={() => setAddOpen(true)} />
        <QuickAction icon={CalendarDays} label="Calendar" href="/calendar" />
        <QuickAction icon={CalendarClock} label="Office" href="/office" />
        <QuickAction icon={MessageSquareText} label="Template" href="/templates" />
        <QuickAction icon={ClipboardList} label="Bookings" href="/bookings" />
        <QuickAction icon={Share2} label="Share Link" href="/settings" />
        <QuickAction icon={Mic} label="Ask AI" onClick={() => document.dispatchEvent(new Event("open-voice"))} />
      </div>

      {nextShow && (
        <Card className="bg-gradient-to-br from-primary/10 to-transparent">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Next Show</p>
          <h2 className="font-display text-lg font-semibold">{nextShow.title}</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateLong(nextShow.date)} • {formatTime12h(nextShow.startTime)}–{formatTime12h(nextShow.endTime)}
          </p>
          <p className="text-sm text-muted-foreground">{nextShow.venueName}</p>
          {countdown && (
            <Badge className="mt-3" variant="default">{countdown}</Badge>
          )}
        </Card>
      )}

      <div>
        <h3 className="mb-2 font-display text-base font-semibold">Today&apos;s Schedule</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SlotCard icon={Sun} label="Morning" event={morningEvent?.slot === "Morning" ? morningEvent : todaysEvents.find(e=>e.slot==='Morning')} />
          <SlotCard icon={Moon} label="Evening" event={eveningEvent ?? todaysEvents.find(e=>e.slot==='Evening')} />
        </div>
        {todayScheduleNote && (
          <p className={`mt-2 text-xs ${todayScheduleNote.comfortable ? "text-emerald-600" : "text-amber-600"}`}>
            {todayScheduleNote.comfortable
              ? "You have enough time between your events for travel and preparation."
              : "Warning: the gap between these events may not be enough for travel and preparation."}
          </p>
        )}
      </div>

      {next7Days.length > 0 && (
        <div>
          <h3 className="mb-2 font-display text-base font-semibold">Upcoming (Next 7 Days)</h3>
          <div className="space-y-2">
            {next7Days.map((e) => (
              <Card key={e._id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDateLong(e.date)} • {formatTime12h(e.startTime)}</p>
                </div>
                <Badge variant={e.status === "Confirmed" ? "success" : "secondary"}>{e.status}</Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      <RemindersWidget />

      {bookings.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-base font-semibold">Pending Booking Requests</h3>
            <Link href="/bookings" className="text-xs font-semibold text-primary">View all</Link>
          </div>
          <div className="space-y-2">
            {bookings.slice(0, 3).map((b) => (
              <div key={b._id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                <div>
                  <p className="text-sm font-semibold">{b.clientName}</p>
                  <p className="text-xs text-muted-foreground">{b.eventType} • {formatDateLong(b.preferredDate)}</p>
                </div>
                <Badge variant="warning">New</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pendingPayments.length > 0 && (
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">Pending Payments</h3>
          </div>
          <div className="space-y-2">
            {pendingPayments.slice(0, 4).map((e) => (
              <div key={e._id} className="flex items-center justify-between text-sm">
                <span>{e.title}</span>
                <span className="font-semibold">
                  {formatINR(Math.max((e.fee ?? 0) - (e.advancePaid ?? 0), 0))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!loading && upcoming.length === 0 && (
        <Card className="text-center">
          <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
          <p className="text-sm text-muted-foreground">No upcoming shows yet. Tap &quot;Add Show&quot; to get started!</p>
        </Card>
      )}

      <EventFormDialog open={addOpen} onOpenChange={setAddOpen} onSaved={load} />
    </div>
  );
}

function QuickAction({
  icon: Icon, label, href, onClick,
}: { icon: React.ElementType; label: string; href?: string; onClick?: () => void }) {
  const content = (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 text-center shadow-sm border border-border transition-transform hover:-translate-y-0.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
        <Icon className="h-4.5 w-4.5 text-primary" />
      </div>
      <span className="text-[11px] font-semibold leading-tight">{label}</span>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return <button onClick={onClick} className="w-full">{content}</button>;
}

function SlotCard({ icon: Icon, label, event }: { icon: React.ElementType; label: string; event?: EventLite }) {
  return (
    <Card>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      {event ? (
        <>
          <p className="text-sm font-semibold">{event.title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {formatTime12h(event.startTime)}–{formatTime12h(event.endTime)}
          </p>
          <Badge className="mt-2" variant={event.status === "Confirmed" ? "success" : "secondary"}>
            {event.status}
          </Badge>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No {label.toLowerCase()} event today</p>
      )}
    </Card>
  );
}

function useCountdown(nextShow?: EventLite) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!nextShow) return setText(null);
    function tick() {
      const target = new Date(`${nextShow!.date}T${nextShow!.startTime}:00+05:30`).getTime();
      const diff = target - Date.now();
      if (diff <= 0) return setText("Happening now");
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      if (days > 0) setText(`${days} day${days > 1 ? "s" : ""} to go`);
      else setText(`${hours} hour${hours !== 1 ? "s" : ""} to go`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [nextShow]);
  return text;
}
