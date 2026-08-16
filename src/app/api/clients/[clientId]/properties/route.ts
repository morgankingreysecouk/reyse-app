import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Creates a property with an empty knowledge base row alongside it, so the
// admin UI never has to special-case "property with no knowledge base
// yet" -- there's always exactly one to edit, same 1:1 shape as
// ChatKnowledge elsewhere in this app.
export async function POST(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client || client.deletedAt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const property = await db.property.create({
    data: {
      clientId,
      name,
      location: typeof b.location === "string" ? b.location.trim() : null,
      checkInTime: typeof b.checkInTime === "string" ? b.checkInTime.trim() : null,
      checkOutTime: typeof b.checkOutTime === "string" ? b.checkOutTime.trim() : null,
      timezone: typeof b.timezone === "string" && b.timezone.trim() ? b.timezone.trim() : "Europe/London",
      knowledgeBase: { create: { content: "" } },
    },
    include: { knowledgeBase: true },
  });

  return NextResponse.json({ property }, { status: 201 });
}
