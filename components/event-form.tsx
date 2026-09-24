"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { EVENT_TYPES, EVENT_STATUSES, PAYMENT_STATUSES, SLOTS } from "@/lib/constants";
import type { IEvent } from "@/models/Event";
import type { ScheduleCheckResult } from "@/lib/scheduling";

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  eventType: z.enum(EVENT_TYPES),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  slot: z.enum(SLOTS),
  venueName: z.string().optional(),
  location: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().optional(),
  fee: z.coerce.number().min(0).optional(),
  advancePaid: z.coerce.number().min(0).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES),
  status: z.enum(EVENT_STATUSES),
  travelMinutes: z.coerce.number().min(0),
  preparationMinutes: z.coerce.number().min(0),
  safetyBufferMinutes: z.coerce.number().min(0),
  notes: z.string().optional(),
  privateNotes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULTS: FormValues = {
  title: "",
  eventType: "Wedding",
  date: "",
  startTime: "18:00",
  endTime: "21:00",
  slot: "Evening",
  venueName: "",
  location: "",
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  fee: 0,
  advancePaid: 0,
  paymentStatus: "Not discussed",
  status: "Enquiry",
  travelMinutes: 30,
  preparationMinutes: 120,
  safetyBufferMinutes: 30,
  notes: "",
  privateNotes: "",
};

export default function EventFormDialog({
  open, onOpenChange, onSaved, event, initialDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  event?: (IEvent & { _id: string }) | null;
  initialDate?: string;
}) {
  const {
    register, handleSubmit, reset, watch, setValue, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: DEFAULTS });

  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleCheckResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (event) {
        reset({ ...DEFAULTS, ...event, fee: event.fee ?? 0, advancePaid: event.advancePaid ?? 0 });
      } else {
        reset({ ...DEFAULTS, date: initialDate ?? "" });
      }
      setSchedule(null);
      setApiError(null);
    }
  }, [open, event, initialDate, reset]);

    const feeVal = Number(watch("fee") || 0);
  const advanceVal = Number(watch("advancePaid") || 0);

  useEffect(() => {
    if (advanceVal > 0 && feeVal > 0 && advanceVal >= feeVal) {
      setValue("paymentStatus", "Fully paid");
    } else if (advanceVal > 0) {
      setValue("paymentStatus", "Advance received");
    }
  }, [advanceVal, feeVal, setValue]);

  async function onSubmit(values: FormValues, forceSaveWithWarning = false) {
    setSaving(true);
    setApiError(null);
    try {
      const url = event ? `/api/events/${event._id}` : "/api/events";
      const method = event ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, forceSaveWithWarning }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setSchedule(data.schedule);
        setApiError("This clashes directly with another event. Please adjust the time.");
        return;
      }
      if (res.status === 422) {
        setSchedule(data.schedule);
        return; // show warning, let user confirm
      }
      if (!res.ok) {
        setApiError(typeof data.error === "string" ? data.error : "Could not save the event.");
        return;
      }

      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const slot = watch("slot");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "Add Event"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => onSubmit(v))} className="space-y-4">
          <div>
            <Label htmlFor="title">Event Name</Label>
            <Input id="title" {...register("title")} placeholder="Sangeet Ceremony" className="mt-1.5" />
            {errors.title && <p className="mt-1 text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...register("date")} className="mt-1.5" />
            </div>
            <div>
              <Label>Event Type</Label>
              <Select value={watch("eventType")} onValueChange={(v) => setValue("eventType", v as FormValues["eventType"])}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="time" {...register("startTime")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="time" {...register("endTime")} className="mt-1.5" />
            </div>
            <div>
              <Label>Slot</Label>
              <Select value={slot} onValueChange={(v) => setValue("slot", v as FormValues["slot"])}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="venueName">Venue</Label>
              <Input id="venueName" {...register("venueName")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register("location")} className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="clientName">Client Name</Label>
              <Input id="clientName" {...register("clientName")} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="clientPhone">Client Phone</Label>
              <Input id="clientPhone" {...register("clientPhone")} className="mt-1.5" />
            </div>
          </div>

                    <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fee">Event Fee (₹)</Label>
              <Input id="fee" type="number" {...register("fee")} className="mt-1.5" />
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={watch("paymentStatus")} onValueChange={(v) => setValue("paymentStatus", v as FormValues["paymentStatus"])}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {["Advance received", "Fully paid"].includes(watch("paymentStatus")) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="advancePaid">Advance Paid (₹)</Label>
                <Input id="advancePaid" type="number" {...register("advancePaid")} className="mt-1.5" />
              </div>
              <div>
                <Label>Balance Due</Label>
                <p className="mt-1.5 flex h-10 items-center rounded-xl bg-secondary px-3 text-sm font-semibold">
                  ₹{Math.max(feeVal - advanceVal, 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          )}

          <div>
            <Label>Event Status</Label>
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as FormValues["status"])}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <details className="rounded-xl bg-secondary p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Travel, preparation & buffer time</summary>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="travelMinutes" className="text-xs">Travel (min)</Label>
                <Input id="travelMinutes" type="number" {...register("travelMinutes")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="preparationMinutes" className="text-xs">Prep (min)</Label>
                <Input id="preparationMinutes" type="number" {...register("preparationMinutes")} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="safetyBufferMinutes" className="text-xs">Buffer (min)</Label>
                <Input id="safetyBufferMinutes" type="number" {...register("safetyBufferMinutes")} className="mt-1" />
              </div>
            </div>
          </details>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} className="mt-1.5" />
          </div>

          {apiError && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" /> {apiError}
            </p>
          )}

          {schedule && !schedule.ok === false && schedule.issues.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
              {schedule.issues.map((issue, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {issue.message}
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {schedule && schedule.ok && !schedule.comfortable ? (
              <>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setSchedule(null)}>
                  Go Back
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={saving}
                  onClick={handleSubmit((v) => onSubmit(v, true))}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Anyway
                </Button>
              </>
            ) : (
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save Event
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
