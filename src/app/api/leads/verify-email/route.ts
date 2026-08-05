import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyEmail } from "@/lib/leadgen/verifyEmail";

export const runtime = "nodejs";

// Manual re-check -- enrichment already auto-verifies any email it finds,
// so this exists for after a manual edit to the email field, or to re-check
// one that came back RISKY a while ago.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { leadId, email } = body as { leadId?: string; email?: string };
  if (!leadId || !email) return NextResponse.json({ error: "leadId and email required" }, { status: 400 });

  const result = await verifyEmail(email);

  const lead = await db.lead.update({
    where: { id: leadId },
    data: { emailVerification: result.verification, emailVerifiedAt: new Date() },
  });

  return NextResponse.json({ lead, reason: result.reason });
}
