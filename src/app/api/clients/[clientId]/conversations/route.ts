import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Prisma.DmConversationWhereInput = { clientId, deletedAt: null };
  if (status) where.status = status as Prisma.EnumDmConversationStatusFilter["equals"];

  const conversations = await db.dmConversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    include: { property: { select: { name: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    take: 200,
  });

  return NextResponse.json({ conversations });
}
