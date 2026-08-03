import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Session check here is belt-and-braces, not the only line of defence --
// proxy.ts already blocks unauthenticated requests before they reach this
// handler (same pattern as every other admin route in this app).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get("trash") === "true";

  const clients = await db.client.findMany({
    where: { deletedAt: includeDeleted ? { not: null } : null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { conversations: true, properties: { where: { deletedAt: null } } } },
    },
  });

  return NextResponse.json({ clients });
}

// Creates a draft client row with just the required minimum (business info)
// -- the onboarding wizard PATCHes it through the remaining steps
// (properties, branding, domains) rather than holding all state until a
// final submit, since Morgan runs this live with a client on a call and a
// stray tab-close shouldn't lose everything.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (typeof b.businessName !== "string" || b.businessName.trim().length === 0) {
    return NextResponse.json({ error: "Missing or invalid businessName" }, { status: 400 });
  }
  if (typeof b.notificationEmail !== "string" || b.notificationEmail.trim().length === 0) {
    return NextResponse.json({ error: "Missing or invalid notificationEmail" }, { status: 400 });
  }

  const client = await db.client.create({
    data: {
      businessName: b.businessName.trim(),
      notificationEmail: b.notificationEmail.trim(),
      contactName: typeof b.contactName === "string" ? b.contactName.trim() || null : null,
      contactPhone: typeof b.contactPhone === "string" ? b.contactPhone.trim() || null : null,
    },
  });

  return NextResponse.json({ client }, { status: 201 });
}
