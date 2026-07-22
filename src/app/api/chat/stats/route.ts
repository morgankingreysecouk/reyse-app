import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

const REAL_FILTER = { deletedAt: null } as const;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [totalCount, last7DaysCount, convertedCount, topicCounts, recentMessages] = await Promise.all([
    db.chatConversation.count({ where: REAL_FILTER }),
    db.chatConversation.count({ where: { ...REAL_FILTER, createdAt: { gte: sevenDaysAgo } } }),
    db.chatConversation.count({ where: { ...REAL_FILTER, convertedToEnquiry: true } }),
    db.chatConversation.groupBy({ by: ["topic"], where: REAL_FILTER, _count: true }),
    db.chatMessage.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        role: { in: ["USER", "ASSISTANT"] },
        conversation: REAL_FILTER,
      },
      select: { conversationId: true, role: true, createdAt: true },
      orderBy: [{ conversationId: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  // Average AI response time: pair each USER message with the next
  // ASSISTANT message in the same conversation. Computed in application
  // code (same approach as the Enquiries stats route) rather than a SQL
  // window function -- fine at current volume, revisit if this grows large.
  const gaps: number[] = [];
  let pendingUserAt: Date | null = null;
  let pendingConversationId: string | null = null;
  for (const m of recentMessages) {
    if (m.conversationId !== pendingConversationId) {
      pendingUserAt = null;
      pendingConversationId = m.conversationId;
    }
    if (m.role === "USER") {
      pendingUserAt = m.createdAt;
    } else if (m.role === "ASSISTANT" && pendingUserAt) {
      gaps.push(m.createdAt.getTime() - pendingUserAt.getTime());
      pendingUserAt = null;
    }
  }
  const avgResponseSeconds =
    gaps.length > 0 ? Math.round((gaps.reduce((sum, g) => sum + g, 0) / gaps.length / 1000) * 10) / 10 : null;

  const topicMap: Record<string, number> = {};
  for (const row of topicCounts) topicMap[row.topic] = row._count;

  return NextResponse.json({
    totalCount,
    last7DaysCount,
    conversionRate: totalCount > 0 ? Math.round((convertedCount / totalCount) * 1000) / 10 : null,
    convertedCount,
    avgResponseSeconds,
    topicCounts: topicMap,
  });
}
