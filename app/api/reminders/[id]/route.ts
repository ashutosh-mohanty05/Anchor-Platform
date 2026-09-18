import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Reminder from "@/models/Reminder";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const reminder = await Reminder.findOneAndUpdate(
    { _id: id, userId },
    { $set: { acknowledged: true } },
    { new: true }
  );
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ reminder });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const deleted = await Reminder.findOneAndDelete({ _id: id, userId });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
