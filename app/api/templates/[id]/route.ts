import { NextRequest, NextResponse } from "next/server";
import { getOwnerUserId } from "@/lib/auth";
import connectToDatabase from "@/lib/mongodb";
import MessageTemplate from "@/models/MessageTemplate";
import { templateSchema } from "@/lib/validations";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const body = await req.json();

  if (body.action === "reset") {
    const existing = await MessageTemplate.findOne({ _id: id, userId });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const original = DEFAULT_TEMPLATES.find((t) => t.category === existing.category);
    if (!original) {
      return NextResponse.json({ error: "No default exists for this template" }, { status: 400 });
    }
    existing.title = original.title;
    existing.body = original.body;
    await existing.save();
    return NextResponse.json({ template: existing });
  }

  if (body.action === "duplicate") {
    const existing = await MessageTemplate.findOne({ _id: id, userId }).lean();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const copy = await MessageTemplate.create({
      userId,
      category: existing.category,
      title: `${existing.title} (Copy)`,
      body: existing.body,
      isDefault: false,
    });
    return NextResponse.json({ template: copy }, { status: 201 });
  }

  const parsed = templateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const template = await MessageTemplate.findOneAndUpdate(
    { _id: id, userId },
    { $set: parsed.data },
    { new: true }
  );
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getOwnerUserId();

  await connectToDatabase();
  const existing = await MessageTemplate.findOne({ _id: id, userId });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.isDefault) {
    return NextResponse.json(
      { error: "Default templates can't be deleted -- you can edit or reset them instead." },
      { status: 400 }
    );
  }
  await existing.deleteOne();
  return NextResponse.json({ ok: true });
}
