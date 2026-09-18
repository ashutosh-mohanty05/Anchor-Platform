import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Settings from "@/models/Settings";
import { settingsSchema } from "@/lib/validations";

export async function GET() {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  let settings = await Settings.findOne({ userId });
  if (!settings) {
    settings = await Settings.create({ userId });
  }
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $set: parsed.data },
    { new: true, upsert: true }
  );
  return NextResponse.json({ settings });
}
