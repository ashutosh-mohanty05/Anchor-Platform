"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Sparkles } from "lucide-react";
import { SPLASH_ARTS, SplashArtSvg } from "@/lib/splash-art";

/**
 * Shown every time the app is opened (not just once per session) -- with a
 * different illustrated anchor each time, the way the reference design
 * rotates its splash art. Tapping anywhere skips straight to the home
 * screen; otherwise it auto-dismisses after a short moment.
 *
 * The art choice is random, but Math.random() must NEVER run during the
 * server-rendered pass -- the server and the client would each pick a
 * different piece and React would flag a hydration mismatch. So the very
 * first render (server AND client) always uses the same fixed art, and
 * only after mount -- purely on the client, in an effect -- do we swap in
 * a random pick. That swap is a normal post-hydration state update, so
 * there's nothing for React to reconcile against the server HTML.
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [art, setArt] = useState(SPLASH_ARTS[0]);

  useEffect(() => {
    setArt(SPLASH_ARTS[Math.floor(Math.random() * SPLASH_ARTS.length)]);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : 1600;
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center bg-background px-6 py-10"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => setVisible(false)}
          role="button"
          aria-label="Continue to home screen"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <SplashArtSvg art={art} />
          </motion.div>

          <motion.div
            className="mt-3 flex items-center gap-2 sm:mt-4 sm:gap-3 md:mt-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            <Mic className="h-5 w-5 text-primary sm:h-6 sm:w-6 md:h-7 md:w-7" />
            <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">
              Vaishnavi&apos;s Stage
            </h1>
            <Sparkles className="h-4 w-4 text-accent-foreground/70 sm:h-5 sm:w-5 md:h-6 md:w-6" />
          </motion.div>
          <motion.p
            className="mt-1 text-xs text-muted-foreground sm:mt-2 sm:text-sm md:text-base"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            Every show. Every booking. Every moment.
          </motion.p>
          <motion.p
            className="mt-6 text-[11px] text-muted-foreground/70 sm:text-xs md:text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            Tap to continue
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
