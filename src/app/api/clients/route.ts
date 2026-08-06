import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "client";
  let candidate = base;
  let attempt = 1;
  while (await db.client.findUnique({ where: { slug: candidate } })) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
  return candidate;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clients = await db.client.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { properties: true } },
      metaConnections: { where: { deletedAt: null }, select: { platform: true, status: true } },
      conversations: { where: { status: "ESCALATED", deletedAt: null }, select: { id: true } },
    },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      status: c.status,
      aiEnabled: c.aiEnabled,
      propertyCount: c._count.properties,
      connections: c.metaConnections,
      openEscalationCount: c.conversations.length,
    })),
  });
}

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
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const notificationEmail = typeof b.notificationEmail === "string" ? b.notificationEmail.trim() : "";

  if (!name || !notificationEmail) {
    return NextResponse.json({ error: "name and notificationEmail are required" }, { status: 400 });
  }

  const client = await db.client.create({
    data: { name, notificationEmail, slug: await uniqueSlug(name) },
  });

  return NextResponse.json({ client }, { status: 201 });
}
