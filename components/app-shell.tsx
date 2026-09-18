"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Home, CalendarDays, MessageSquareText, ClipboardList, Settings, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import VoiceAssistant from "./voice-assistant";
import SplashScreen from "./splash-screen";
import { registerServiceWorker } from "@/lib/push-client";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    const openVoice = () => setVoiceOpen(true);
    document.addEventListener("open-voice", openVoice);
    return () => document.removeEventListener("open-voice", openVoice);
  }, []);

  useEffect(() => {
    // Register early (idempotent) so the service worker is ready the
    // moment Vaishnavi taps "Enable notifications" in Settings -- no
    // extra wait the first time she turns it on.
    registerServiceWorker();
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col pb-24 md:pb-8">
      <SplashScreen />

      <main className="flex-1 px-4 pt-5 md:px-8">{children}</main>

      <button
        onClick={() => setVoiceOpen(true)}
        className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform hover:scale-105 md:bottom-8 md:right-8"
        aria-label="Ask Vaishnavi's Stage"
      >
        <Mic className="h-5 w-5" />
        <span className="hidden text-sm font-semibold sm:inline">Ask Vaishnavi&apos;s Stage</span>
        <Sparkles className="h-4 w-4 opacity-80" />
      </button>

      <AnimatePresence>
        {voiceOpen && <VoiceAssistant onClose={() => setVoiceOpen(false)} />}
      </AnimatePresence>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:relative md:mx-auto md:mt-auto md:max-w-3xl md:rounded-full md:border">
        <ul className="mx-auto flex max-w-3xl items-center justify-between px-2 py-2 md:justify-center md:gap-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="flex-1 md:flex-none">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition-colors md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active && "fill-primary/15")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
