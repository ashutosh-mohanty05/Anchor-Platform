import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import Event from "@/models/Event";
import { eventToIcs } from "@/lib/calendar";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const event = await Event.findOne({ _id: id, userId }).lean();
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { filename, contents } = eventToIcs(event);

  return new NextResponse(contents, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
