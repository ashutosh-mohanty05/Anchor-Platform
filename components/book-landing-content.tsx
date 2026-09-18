"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile {
  displayName: string;
  bio: string;
  profileImage: string;
  instagramUrl: string;
  whatsappNumber: string;
}

const CATEGORY_LINE = "Weddings • Corporate Events • Parties • College Events • and more...";
const TRUST_BADGES = ["Professional", "Personalized", "Memorable"];

/**
 * Purely presentational -- all data now arrives as props, fetched
 * server-side by app/book/page.tsx before the page ever reaches the
 * browser. Kept as a client component only because it needs Framer Motion.
 */
export default function BookLandingContent({ profile }: { profile: Profile }) {
  return (
    <div className="relative min-h-screen overflow-hidden" data-theme="rose">
      {/* soft decorative background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/5" />
      <div className="pointer-events-none absolute -left-10 top-24 h-40 w-40 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -right-8 top-64 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />

      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-6 pb-10 pt-10">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15">
            <Mic className="h-4.5 w-4.5 text-primary" />
          </div>
          <span className="font-display text-lg font-semibold">Vaishnavi&apos;s Stage</span>
          <Heart className="h-3.5 w-3.5 text-primary" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-1 flex-col items-center justify-center text-center"
        >
          <div className="relative mb-6">
            <div className="absolute inset-0 -m-3 rounded-full border-2 border-dashed border-primary/25" />
            <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-white bg-secondary shadow-lg">
              {profile.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.profileImage} alt={profile.displayName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-5xl text-primary">
                  {(profile.displayName || "V")[0]}
                </div>
              )}
            </div>
            <span className="absolute -right-1 top-2 text-xl">🎤</span>
            <span className="absolute -left-2 bottom-4 text-lg">💕</span>
          </div>

          <h1 className="font-display text-2xl font-semibold leading-snug">
            Let&apos;s Make Your Event Memorable <Sparkles className="inline h-5 w-5 text-primary" />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{CATEGORY_LINE}</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {TRUST_BADGES.map((b) => (
              <span key={b} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
                ✓ {b}
              </span>
            ))}
          </div>

          <Link href="/book/request" className="mt-8 w-full max-w-xs">
            <Button size="lg" className="w-full shadow-lg">Book an Event</Button>
          </Link>

          <Link href="/book/status" className="mt-3 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
            Already sent a request? Check status
          </Link>
        </motion.div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Elegant Events. Engaging Moments. Vaishnavi&apos;s Stage.
        </p>
      </div>
    </div>
  );
}
