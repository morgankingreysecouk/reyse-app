import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cancelBooking } from "@/lib/dm/calendar/availability";

// Only action today is cancel -- Morgan-initiated only (see
// cancelBooking's own doc comment for why this never gets called from the
// AI reply path).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string; bookingId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId, bookingId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if ((body as Record<string, unknown>).action !== "cancel") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result = await cancelBooking(bookingId, clientId);
  if (!result.ok) return NextResponse.json({ error: result.reason ?? "Cancel failed" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
