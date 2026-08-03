import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientFromWidgetKey } from "@/lib/widgetAuth";

// Branding only -- assistantName, colour, logo, proactive settings, starter
// questions. Never returns structured property info; that stays server-side
// and is only ever used to build the system prompt for an actual message.
export async function GET(request: NextRequest, { params }: { params: Promise<{ widgetKey: string }> }) {
  const { widgetKey } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  if (!client) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const logo = await db.clientLogo.findUnique({ where: { clientId: client.id }, select: { id: true } });

  return NextResponse.json({
    enabled: true,
    assistantName: client.assistantName,
    themeColor: client.themeColor,
    hasLogo: Boolean(logo),
    proactiveEnabled: client.proactiveEnabled,
    proactiveDelaySeconds: client.proactiveDelaySeconds,
    proactiveMessage: client.proactiveMessage,
    starterQuestions: client.starterQuestions,
  });
}
