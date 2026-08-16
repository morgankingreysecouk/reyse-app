import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collections = await db.leadCollection.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { leads: { where: { excluded: false } } } } },
  });

  return NextResponse.json({
    collections: collections.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt, count: c._count.leads })),
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
  const { name } = body as { name?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const collection = await db.leadCollection.create({ data: { name: name.trim() } });
  return NextResponse.json({ collection }, { status: 201 });
}
