import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import MessageTemplate from "@/models/MessageTemplate";
import { templateSchema } from "@/lib/validations";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";

export async function GET() {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const count = await MessageTemplate.countDocuments({ userId });
  if (count === 0) {
    await MessageTemplate.insertMany(
      DEFAULT_TEMPLATES.map((t) => ({ ...t, userId, isDefault: true }))
    );
  }

  const templates = await MessageTemplate.find({ userId }).sort({ category: 1 }).lean();
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const body = await req.json();
  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await MessageTemplate.create({ ...parsed.data, userId, isDefault: false });
  return NextResponse.json({ template }, { status: 201 });
}
