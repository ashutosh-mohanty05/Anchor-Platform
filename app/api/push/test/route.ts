import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import connectToDatabase from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import { getOwnerUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    const queryParam = new URL(req.url).searchParams.get("secret");
    if (secret && queryParam !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || "mailto:hello@vaishnavisstage.local";
    if (!publicKey || !privateKey) {
      return NextResponse.json({ error: "VAPID keys not set on server" }, { status: 500 });
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const userId = await getOwnerUserId();
    await connectToDatabase();
    const subs = await PushSubscription.find({ userId }).lean();

    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify({ title: "Test push", body: "If you see this, push works!", url: "/" })
          );
          return { endpoint: sub.endpoint.slice(-16), ok: true };
        } catch (err: unknown) {
          return {
            endpoint: sub.endpoint.slice(-16),
            ok: false,
            statusCode: (err as { statusCode?: number })?.statusCode,
            message: (err as Error)?.message,
          };
        }
      })
    );

    return NextResponse.json({ subscriptionCount: subs.length, results });
  } catch (err: unknown) {
    return NextResponse.json(
      { crashed: true, message: (err as Error)?.message, stack: (err as Error)?.stack },
      { status: 500 }
    );
  }
}