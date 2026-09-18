import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import { z } from "zod";

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

/** Saves (or refreshes) this device's push subscription for Vaishnavi. */
export async function POST(req: NextRequest) {
  const userId = await getOwnerUserId();
  await connectToDatabase();

  const body = await req.json();
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await PushSubscription.findOneAndUpdate(
    { endpoint: parsed.data.endpoint },
    { $set: { userId, keys: parsed.data.keys } },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}

/** Removes a device's push subscription (e.g. when notifications are turned off). */
export async function DELETE(req: NextRequest) {
  await connectToDatabase();
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint");
  if (!endpoint) return NextResponse.json({ error: "endpoint is required" }, { status: 400 });

  await PushSubscription.deleteOne({ endpoint });
  return NextResponse.json({ ok: true });
}
