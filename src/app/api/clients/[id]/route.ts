import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      properties: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      logo: { select: { id: true, mimeType: true } },
    },
  });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ client });
}

interface ClientPatchBody {
  businessName?: string;
  contactName?: string | null;
  notificationEmail?: string;
  contactPhone?: string | null;
  assistantName?: string;
  themeColor?: string;
  allowedDomains?: string[];
  additionalNotes?: string | null;
  proactiveEnabled?: boolean;
  proactiveDelaySeconds?: number;
  proactiveMessage?: string | null;
  enabled?: boolean;
}

const STRING_FIELDS: (keyof ClientPatchBody)[] = ["businessName", "notificationEmail", "assistantName", "themeColor"];
const NULLABLE_STRING_FIELDS: (keyof ClientPatchBody)[] = ["contactName", "contactPhone", "additionalNotes", "proactiveMessage"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as ClientPatchBody;

  const existing = await db.client.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  for (const field of STRING_FIELDS) {
    if (b[field] !== undefined) {
      if (typeof b[field] !== "string" || (b[field] as string).trim().length === 0) {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = (b[field] as string).trim();
    }
  }
  for (const field of NULLABLE_STRING_FIELDS) {
    if (b[field] !== undefined) {
      if (b[field] !== null && typeof b[field] !== "string") {
        return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
      }
      data[field] = typeof b[field] === "string" ? (b[field] as string).trim() || null : null;
    }
  }
  if (b.allowedDomains !== undefined) {
    if (!Array.isArray(b.allowedDomains) || !b.allowedDomains.every((d) => typeof d === "string")) {
      return NextResponse.json({ error: "Invalid allowedDomains" }, { status: 400 });
    }
    data.allowedDomains = b.allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean);
  }
  if (b.proactiveEnabled !== undefined) {
    if (typeof b.proactiveEnabled !== "boolean") {
      return NextResponse.json({ error: "Invalid proactiveEnabled" }, { status: 400 });
    }
    data.proactiveEnabled = b.proactiveEnabled;
  }
  if (b.proactiveDelaySeconds !== undefined) {
    if (typeof b.proactiveDelaySeconds !== "number" || b.proactiveDelaySeconds < 0) {
      return NextResponse.json({ error: "Invalid proactiveDelaySeconds" }, { status: 400 });
    }
    data.proactiveDelaySeconds = Math.round(b.proactiveDelaySeconds);
  }
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid enabled" }, { status: 400 });
    }
    data.enabled = b.enabled;
  }

  const client = await db.client.update({ where: { id }, data });
  return NextResponse.json({ client });
}

// Soft delete only, same convention as Enquiry/ChatConversation/SocialPost --
// never a hard delete, always recoverable via restore. Existing
// conversations/enquiries keep their clientId (the FK is ON DELETE
// RESTRICT, but a soft delete never triggers a real DB delete anyway).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.client.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = await db.client.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ client });
}
