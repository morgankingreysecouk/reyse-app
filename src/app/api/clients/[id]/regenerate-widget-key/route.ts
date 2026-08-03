import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// A rotation safety valve -- standard practice for any public key that
// might end up embedded somewhere it shouldn't (a staging site, a
// screenshot, a support ticket). The old key stops resolving immediately;
// the client just needs the new embed snippet re-pasted.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await db.client.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const client = await db.client.update({ where: { id }, data: { widgetKey: crypto.randomUUID() } });
  return NextResponse.json({ client });
}
