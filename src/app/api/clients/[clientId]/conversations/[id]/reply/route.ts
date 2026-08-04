import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/dm/crypto";
import { sendInstagramMessage } from "@/lib/dm/graphApi";
import { publish } from "@/lib/dm/dmStream";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Morgan replying live to a guest from the dashboard, taking over from the
// AI. Inside Meta's 24h window this is a normal reply; outside it, the
// only way to reach the guest at all is the HUMAN_AGENT message tag --
// which Meta's policy restricts to genuine human replies for support
// purposes, never an automated one. This route (a real person clicking
// Send in the dashboard) is the ONLY caller anywhere in this codebase
// allowed to pass humanAgentTag -- src/lib/dm/replyEngine.ts's AI-authored
// sends never do.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, id: conversationId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const content = (body as Record<string, unknown>).content;
  if (typeof content !== "string" || content.trim().length === 0 || content.length > 4000) {
    return NextResponse.json({ error: "Invalid content" }, { status: 400 });
  }
  const text = content.trim();

  const conversation = await db.dmConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.deletedAt || conversation.clientId !== clientId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const connection = await db.clientMetaConnection.findUnique({
    where: { clientId_platform: { clientId, platform: conversation.platform } },
  });
  if (!connection || connection.deletedAt) {
    return NextResponse.json({ error: "No Meta connection for this client" }, { status: 409 });
  }

  const withinWindow =
    conversation.lastInboundAt != null && Date.now() - conversation.lastInboundAt.getTime() <= TWENTY_FOUR_HOURS_MS;

  try {
    const accessToken = decryptToken({
      ciphertext: connection.accessTokenCiphertext,
      iv: connection.accessTokenIv,
      authTag: connection.accessTokenAuthTag,
    });
    const sent = await sendInstagramMessage({
      instagramAccountId: connection.externalAccountId,
      accessToken,
      recipientId: conversation.externalUserId,
      text,
      humanAgentTag: !withinWindow,
    });

    await db.dmMessage.create({
      data: { conversationId, role: "OPERATOR", content: text, externalMessageId: sent.externalMessageId },
    });

    const wasHumanActive = conversation.status === "HUMAN_ACTIVE";
    await db.dmConversation.update({
      where: { id: conversationId },
      data: { status: "HUMAN_ACTIVE", lastOutboundAt: new Date(), lastMessageAt: new Date() },
    });
    if (!wasHumanActive) {
      await db.dmActivityLog.create({
        data: { clientId, conversationId, action: "TAKEN_OVER_BY_OPERATOR", summary: "Morgan replied directly and took over from the AI" },
      });
    }

    publish(conversationId, { role: "OPERATOR", content: text });

    return NextResponse.json({ sentOutsideWindow: !withinWindow }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reply" },
      { status: 502 },
    );
  }
}
