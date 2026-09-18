"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Copy, Check, Instagram, MessageCircle, Loader2, Share2, Camera, CalendarClock, ChevronRight, Bell, BellOff,
  CalendarPlus, CalendarX, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import ThemeSwitcher from "@/components/theme-switcher";
import type { ISettings, ThemeName } from "@/models/Settings";
import { waLink } from "@/lib/utils";
import { whatsappShareAvailabilityLink } from "@/lib/whatsapp";
import { fileToDataUrl } from "@/lib/image";
import { pushSupported, getExistingSubscription, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";
import ImageCropper from "@/components/image-cropper";

type SettingsLite = ISettings & { _id: string };

export default function SettingsPanel() {
  const [settings, setSettings] = useState<SettingsLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<"unsupported" | "off" | "on" | "checking" | "working">("checking");
  const [google, setGoogle] = useState<{ configured: boolean; connected: boolean; googleEmail?: string } | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  function loadGoogleStatus() {
    fetch("/api/integrations/google")
      .then((r) => r.json())
      .then(setGoogle)
      .catch(() => setGoogle({ configured: false, connected: false }));
  }

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/book`);
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data.settings))
      .finally(() => setLoading(false));

    loadGoogleStatus();

    const params = new URLSearchParams(window.location.search);
    const googleResult = params.get("google");
    if (googleResult === "connected") {
      loadGoogleStatus();
    } else if (googleResult === "error") {
      setGoogleError(params.get("reason") || "Couldn't connect Google Calendar. Please try again.");
    }
    if (googleResult) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function disconnectGoogle() {
    setGoogleBusy(true);
    setGoogleError(null);
    try {
      await fetch("/api/integrations/google", { method: "DELETE" });
      loadGoogleStatus();
    } finally {
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    if (!pushSupported()) {
      setNotifStatus("unsupported");
      return;
    }
    getExistingSubscription().then((sub) => setNotifStatus(sub ? "on" : "off"));
  }, []);

  async function toggleNotifications() {
    setNotifStatus("working");
    if (notifStatus === "on") {
      await unsubscribeFromPush();
      setNotifStatus("off");
    } else {
      const result = await subscribeToPush();
      setNotifStatus(result.ok ? "on" : "off");
    }
  }

  async function save(partial: Partial<ISettings>) {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    const data = await res.json();
    setSettings(data.settings);
    setSaving(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Picking a file just opens the crop dialog -- nothing is uploaded until
  // she confirms the crop, so a photo can always be repositioned/zoomed
  // before it's saved rather than getting stuck with an auto-crop.
  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setCropSource(dataUrl);
  }

  async function onCropConfirm(croppedDataUrl: string) {
    setCropSource(null);
    setUploadingPhoto(true);
    try {
      await save({ profileImage: croppedDataUrl });
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading || !settings) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 pb-6">
      <h1 className="font-display text-2xl font-semibold">Profile & Settings</h1>

      <Card>
        <h3 className="mb-3 font-display text-base font-semibold">Profile</h3>
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group relative h-24 w-24 overflow-hidden rounded-full border-4 border-primary/20 bg-secondary"
            aria-label="Change profile picture"
          >
            {settings.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.profileImage} alt={settings.displayName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-display text-3xl text-primary">
                {(settings.displayName || "V")[0]}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              {uploadingPhoto ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
              <Camera className="h-3.5 w-3.5" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
        </div>
        <ImageCropper
          open={!!cropSource}
          imageDataUrl={cropSource}
          onCancel={() => setCropSource(null)}
          onConfirm={onCropConfirm}
        />
        <div className="space-y-3">
          <div>
            <Label>Display Name</Label>
            <Input
              defaultValue={settings.displayName}
              onBlur={(e) => save({ displayName: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Bio / Tagline</Label>
            <Textarea
              defaultValue={settings.bio}
              onBlur={(e) => save({ bio: e.target.value })}
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-base font-semibold">Public Booking Page</h3>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Accepting booking requests</p>
            <p className="text-xs text-muted-foreground">Toggle off to temporarily pause new requests.</p>
          </div>
          <Switch
            checked={settings.publicBookingEnabled}
            onCheckedChange={(v) => save({ publicBookingEnabled: v })}
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-secondary p-3">
          <span className="flex-1 truncate text-sm">{publicUrl}</span>
          <Button size="sm" variant="secondary" onClick={copyLink}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {settings.whatsappNumber && (
          <a href={whatsappShareAvailabilityLink(settings.whatsappNumber, publicUrl)} target="_blank" rel="noreferrer" className="mt-2 inline-block">
            <Button size="sm" variant="outline"><Share2 className="h-3.5 w-3.5" /> Share via WhatsApp</Button>
          </a>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Add this link to your Instagram bio, or share it in Stories, Highlights, or DMs. It always shows only
          safe availability — never client details, fees, or private notes.
        </p>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-base font-semibold">Connect</h3>
        <div className="space-y-3">
          <div>
            <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram URL</Label>
            <Input
              defaultValue={settings.instagramUrl}
              placeholder="https://instagram.com/yourhandle"
              onBlur={(e) => save({ instagramUrl: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp Number</Label>
            <Input
              defaultValue={settings.whatsappNumber}
              placeholder="+91 98765 43210"
              onBlur={(e) => save({ whatsappNumber: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-base font-semibold">Scheduling Defaults</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Max events / day</Label>
            <Input type="number" defaultValue={settings.maxEventsPerDay} onBlur={(e) => save({ maxEventsPerDay: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Default travel (min)</Label>
            <Input type="number" defaultValue={settings.defaultTravelMinutes} onBlur={(e) => save({ defaultTravelMinutes: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Default prep (min)</Label>
            <Input type="number" defaultValue={settings.defaultPreparationMinutes} onBlur={(e) => save({ defaultPreparationMinutes: Number(e.target.value) })} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Safety buffer (min)</Label>
            <Input type="number" defaultValue={settings.defaultSafetyBufferMinutes} onBlur={(e) => save({ defaultSafetyBufferMinutes: Number(e.target.value) })} className="mt-1" />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-display text-base font-semibold">Theme</h3>
        <ThemeSwitcher initialTheme={settings.theme as ThemeName} />
      </Card>

      <Link href="/office">
        <Card className="flex items-center justify-between transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">Office Schedule</h3>
              <p className="text-xs text-muted-foreground">Set your day-job shifts so events never clash</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Card>
      </Link>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              {notifStatus === "on" ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">Notifications</h3>
              <p className="text-xs text-muted-foreground">
                {notifStatus === "unsupported"
                  ? "Not supported in this browser."
                  : "Get a mobile alert the moment a client sends a booking request, and reminders before your shows."}
              </p>
            </div>
          </div>
          <Switch
            checked={notifStatus === "on"}
            disabled={notifStatus === "unsupported" || notifStatus === "checking" || notifStatus === "working"}
            onCheckedChange={toggleNotifications}
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              {google?.connected ? (
                <CalendarPlus className="h-5 w-5 text-primary" />
              ) : (
                <CalendarX className="h-5 w-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">Google Calendar</h3>
              <p className="text-xs text-muted-foreground">
                {!google
                  ? "Checking…"
                  : !google.configured
                    ? "Not set up yet — ask your developer to add the Google credentials."
                    : google.connected
                      ? `Connected${google.googleEmail ? ` as ${google.googleEmail}` : ""}. Confirmed events sync automatically.`
                      : "Connect to auto-add every Confirmed event to your Google Calendar, with reminders on all your devices."}
              </p>
            </div>
          </div>
          {google?.configured && (
            google.connected ? (
              <Button size="sm" variant="outline" disabled={googleBusy} onClick={disconnectGoogle}>
                {googleBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Disconnect
              </Button>
            ) : (
              <a href="/api/integrations/google/auth">
                <Button size="sm">Connect</Button>
              </a>
            )
          )}
        </div>
        {googleError && (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {googleError}
          </p>
        )}
      </Card>

      <Card>
        <h3 className="mb-1 font-display text-base font-semibold">Voice Assistant (Ask AI)</h3>
        <p className="text-xs text-muted-foreground">
          Tap the mic anywhere in the app and talk naturally — add shows, mark one as Confirmed on
          the spot, ask what&apos;s confirmed this month, check your week, or find pending payments.
          This runs entirely free, forever, with no account and no API key required. If you ever want
          looser free-form conversation on top of it, you can optionally connect your own AI key (see
          setup guide) — but it&apos;s never needed for voice control to work.
        </p>
      </Card>

      {saving && <p className="text-center text-xs text-muted-foreground">Saving…</p>}
    </div>
  );
}
