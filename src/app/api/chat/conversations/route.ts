import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const topic = searchParams.get("topic");
  const includeDeleted = searchParams.get("trash") === "true";

  const where: Prisma.ChatConversationWhereInput = {
    deletedAt: includeDeleted ? { not: null } : null,
  };
  if (status) where.status = status as Prisma.EnumChatConversationStatusFilter["equals"];
  if (topic) where.topic = topic as Prisma.EnumChatTopicFilter["equals"];

  const conversations = await db.chatConversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 1 },
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({ conversations });
}
