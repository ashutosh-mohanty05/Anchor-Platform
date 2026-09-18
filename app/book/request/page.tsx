"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import BookingForm from "@/components/booking-form";
import AvailabilityCalendar from "@/components/availability-calendar";
import { todayInIndia } from "@/lib/utils";
import type { PublicDayAvailability } from "@/lib/availability";

export default function BookRequestPage() {
  const [availability, setAvailability] = useState<PublicDayAvailability[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayInIndia());
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    fetch("/api/availability")
      .then((r) => (r.ok ? r.json() : { availability: [] }))
      .then((data) => setAvailability(data.availability ?? []));
  }, []);

  return (
    <div className="min-h-screen" data-theme="rose">
      <div className="mx-auto max-w-lg px-4 pb-12 pt-6">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/book" className="rounded-full p-2 hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold">Book an Event</h1>
            <p className="text-xs text-muted-foreground">Tell us about your event</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card>
            <button
              type="button"
              onClick={() => setShowCalendar((s) => !s)}
              className="mb-4 flex w-full items-center justify-between rounded-xl bg-secondary px-3 py-2.5 text-left text-xs font-semibold text-secondary-foreground"
            >
              <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Check date availability first</span>
              <span>{showCalendar ? "Hide" : "View"}</span>
            </button>
            {showCalendar && (
              <div className="mb-5">
                <AvailabilityCalendar
                  availability={availability}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </div>
            )}
            <BookingForm key={selectedDate} initialDate={selectedDate} />
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
