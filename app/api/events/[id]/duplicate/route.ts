import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Event from "@/models/Event";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const original = await Event.findOne({ _id: id, userId }).lean();
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { _id, createdAt, updatedAt, ...rest } = original as Record<string, unknown>;
  const duplicate = await Event.create({
    ...rest,
    title: `${(rest as { title: string }).title} (Copy)`,
    status: "Enquiry",
    userId,
  });

  return NextResponse.json({ event: duplicate }, { status: 201 });
}
