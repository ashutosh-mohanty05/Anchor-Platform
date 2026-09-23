"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EVENT_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type CheckState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; reason?: string }
  | { state: "error" };

export default function BookingForm({ initialDate }: { initialDate?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [flexibleTime, setFlexibleTime] = useState(false);
  const [check, setCheck] = useState<CheckState>({ state: "idle" });
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    clientName: "",
    phone: "",
    email: "",
    eventType: "Wedding",
    preferredDate: initialDate ?? "",
    preferredStartTime: "18:00",
    preferredEndTime: "21:00",
    location: "",
    audienceSize: "",
    message: "",
    consent: false,
    website: "", // honeypot -- left empty by real users
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Live "is she free then?" check -- this is the single source of truth
  // clients see, so there's nothing to interpret or get confused by.
  // Debounced so it doesn't fire on every keystroke.
  useEffect(() => {
    if (checkTimer.current) clearTimeout(checkTimer.current);
    if (!form.preferredDate) {
      setCheck({ state: "idle" });
      return;
    }
    if (!flexibleTime && (!form.preferredStartTime || !form.preferredEndTime)) {
      setCheck({ state: "idle" });
      return;
    }
    checkTimer.current = setTimeout(async () => {
      setCheck({ state: "checking" });
      try {
        const res = await fetch("/api/availability/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: form.preferredDate,
            startTime: flexibleTime ? "" : form.preferredStartTime,
            endTime: flexibleTime ? "" : form.preferredEndTime,
          }),
        });
        if (!res.ok) {
          setCheck({ state: "error" });
          return;
        }
        const data = await res.json();
        setCheck(data.available ? { state: "available" } : { state: "unavailable", reason: data.reason });
      } catch {
        setCheck({ state: "error" });
      }
    }, 500);
    return () => {
      if (checkTimer.current) clearTimeout(checkTimer.current);
    };
  }, [form.preferredDate, form.preferredStartTime, form.preferredEndTime, flexibleTime]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.consent) {
      setError("Please confirm you understand this is a request, not a confirmed booking.");
      return;
    }
    setLoading(true);
    try {
      const preferredStartTime = flexibleTime ? "" : form.preferredStartTime;
      const preferredEndTime = flexibleTime ? "" : form.preferredEndTime;
      // preferredSlot is inferred automatically from the actual time chosen
      // so the client never has to pick between confusing labels themselves.
      const preferredSlot = flexibleTime
        ? "Flexible"
        : Number(preferredStartTime.split(":")[0]) < 15
        ? "Morning"
        : "Evening";

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          preferredStartTime,
          preferredEndTime,
          preferredSlot,
          audienceSize: form.audienceSize ? Number(form.audienceSize) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Please check the form and try again.");
        return;
      }
      router.push(`/book/success?ref=${data.referenceId}`);
    } catch {
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Honeypot field -- hidden from real users, visible to bots */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="website">Website</Label>
        <Input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => update("website", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Your Name</Label>
        <Input required value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="Rohan Mehta" />
      </div>

      <div className="space-y-1.5">
        <Label>Phone Number</Label>
        <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="98765 43210" />
      </div>

      <div className="space-y-1.5">
        <Label>Event Type</Label>
        <Select value={form.eventType} onValueChange={(v) => update("eventType", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Event Date</Label>
        <Input type="date" required value={form.preferredDate} onChange={(e) => update("preferredDate", e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Event Time</Label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox checked={flexibleTime} onCheckedChange={(v) => setFlexibleTime(v === true)} />
            I don&apos;t have an exact time yet
          </label>
        </div>
        {!flexibleTime && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Start</Label>
              <Input type="time" required={!flexibleTime} value={form.preferredStartTime} onChange={(e) => update("preferredStartTime", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End</Label>
              <Input type="time" required={!flexibleTime} value={form.preferredEndTime} onChange={(e) => update("preferredEndTime", e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {/* One clear, unambiguous answer -- never two slots to interpret. */}
        {check.state === "checking" && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking if Vaishnavi is free then...
          </p>
        )}
        {check.state === "available" && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Vaishnavi looks available at this time!
          </p>
        )}
        {check.state === "unavailable" && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {check.reason ?? "Vaishnavi may already be booked then."} You can still send a request —
            she&apos;ll get back to you.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Location / City</Label>
        <Input value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="Pune" />
      </div>

      <div className="space-y-1.5">
  <Label>Expected Audience Size</Label>
  <Input type="number" required min={1} value={form.audienceSize} onChange={(e) => update("audienceSize", e.target.value)} />
</div>

      <div className="space-y-1.5">
        <Label>Your Message</Label>
        <Textarea
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          placeholder="We are looking for an anchor for our sangeet ceremony. Please share details."
          rows={3}
        />
      </div>

      <button
        type="button"
        onClick={() => setShowMore((s) => !s)}
        className="flex items-center gap-1 text-xs font-semibold text-primary"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showMore && "rotate-180")} />
        {showMore ? "Hide extra details" : "Add more details (optional)"}
      </button>


      <label className="flex items-start gap-3 text-xs text-muted-foreground">
        <Checkbox checked={form.consent} onCheckedChange={(v) => update("consent", v === true)} />
        I agree that this is a booking request and not a confirmed booking.
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Submit Request
      </Button>
    </form>
  );
}
