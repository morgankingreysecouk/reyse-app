import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getKnowledge } from "@/lib/chatKnowledge";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const knowledge = await getKnowledge();
  return NextResponse.json({ knowledge });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = (body as Record<string, unknown>).content;
  if (typeof content !== "string" || content.trim().length === 0 || content.length > 20000) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }

  const existing = await getKnowledge();
  const knowledge = await db.chatKnowledge.update({
    where: { id: existing.id },
    data: { content: content.trim(), updatedBy: session.user?.email ?? null },
  });
  return NextResponse.json({ knowledge });
}
