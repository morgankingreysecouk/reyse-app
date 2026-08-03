import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB -- this is an icon-sized image, not a photo library
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const client = await db.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type -- use PNG, JPEG, WebP, or SVG" }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo is too large -- 2MB maximum" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await db.clientLogo.upsert({
    where: { clientId: id },
    create: { clientId: id, data: buffer, mimeType: file.type },
    update: { data: buffer, mimeType: file.type },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.clientLogo.deleteMany({ where: { clientId: id } });
  return NextResponse.json({ success: true });
}
