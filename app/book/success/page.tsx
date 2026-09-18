"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get("ref");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-10" data-theme="rose">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-sm">
        <Card className="text-center">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10"
          >
            <Mail className="h-9 w-9 text-primary" />
          </motion.div>
          <h1 className="font-display text-xl font-semibold">Request Submitted!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thank you for reaching out! Your booking request has been received. Vaishnavi will
            review it and get back to you soon.
          </p>
          {ref && (
            <p className="mt-3 rounded-full bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground">
              Reference: {ref}
            </p>
          )}
          {ref && (
            <Link href={`/book/status?ref=${ref}`} className="mt-2 block text-xs font-semibold text-primary underline-offset-2 hover:underline">
              Track your request status
            </Link>
          )}
          <Link href="/book">
            <Button className="mt-5 w-full" variant="outline">Back to Home</Button>
          </Link>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          Good events take conversations. You&apos;re one step closer! <Heart className="h-3.5 w-3.5 text-primary" />
        </p>
      </motion.div>
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
