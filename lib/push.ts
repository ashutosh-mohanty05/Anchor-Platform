import webpush from "web-push";
import connectToDatabase from "./mongodb";
import PushSubscription from "@/models/PushSubscription";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hello@vaishnavisstage.local";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Sends a real mobile/desktop push notification (via the Web Push
 * standard) to every device Vaishnavi has subscribed on this app. Silently
 * does nothing if VAPID keys aren't configured yet -- see .env.example --
 * so the rest of the app keeps working even before push is set up.
 * Automatically forgets subscriptions the browser has revoked (410/404).
 */
export async function sendPushToOwner(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) {
    console.error("Push skipped: VAPID keys not configured");
    return;
  }

  await connectToDatabase();
  const subs = await PushSubscription.find({ userId }).lean();
  console.log(`Push: found ${subs.length} subscription(s) for userId ${userId}`);
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          body
        );
        console.log(`Push sent OK to endpoint ending in ...${sub.endpoint.slice(-12)}`);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          console.error(`Push subscription expired (${statusCode}), removing it`);
          await PushSubscription.deleteOne({ _id: sub._id });
        } else {
          console.error("Push send failed:", statusCode, (err as Error)?.message);
        }
      }
    })
  );
}
