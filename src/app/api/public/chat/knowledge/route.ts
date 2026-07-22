import { NextRequest, NextResponse } from "next/server";
import { getKnowledge } from "@/lib/chatKnowledge";

// Called server-to-server by Reyse-Website's api/chat.ts on every request,
// to ground the AI's system prompt in whatever Morgan last edited in the
// admin knowledge editor -- a pricing change no longer needs a code deploy.
// Same secret pattern as the other public routes.
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    console.error("INTERNAL_API_SECRET is not set -- refusing public knowledge reads.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }
  if (apiKey !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const knowledge = await getKnowledge();
    return NextResponse.json({ content: knowledge.content });
  } catch (error) {
    console.error("Failed to load chat knowledge:", error);
    return NextResponse.json({ error: "Failed to load knowledge" }, { status: 500 });
  }
}
