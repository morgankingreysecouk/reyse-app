import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await db.mailAccount.findUnique({ where: { id: "singleton" } });
  if (!account) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    email: account.email,
    connectedAt: account.connectedAt,
    lastSyncedAt: account.lastSyncedAt,
    lastSyncError: account.lastSyncError,
    backfillStatus: account.backfillStatus,
  });
}
