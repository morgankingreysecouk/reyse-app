import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientFromWidgetKey } from "@/lib/widgetAuth";

// Deliberately narrow -- a guest's browser can only ever set csatHelpful
// here, nothing else. No status, no notes, no delete: those stay
// session-protected admin-only actions.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ widgetKey: string; id: string }> },
) {
  const { widgetKey, id } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (typeof b.csatHelpful !== "boolean") {
    return NextResponse.json({ error: "Invalid csatHelpful" }, { status: 400 });
  }

  const conversation = await db.chatConversation.findUnique({ where: { id } });
  if (!conversation || conversation.deletedAt || conversation.clientId !== client.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.chatConversation.update({ where: { id }, data: { csatHelpful: b.csatHelpful } });
  return NextResponse.json({ success: true });
}
