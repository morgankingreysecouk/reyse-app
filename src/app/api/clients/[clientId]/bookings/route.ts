import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

// Lists every booking across all of this client's properties -- one flat
// list rather than nested under each property, since a host with a
// handful of properties still wants one place to see everything coming
// up. Newest check-in first.
export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await params;
  const bookings = await db.booking.findMany({
    where: { property: { clientId } },
    include: { property: { select: { name: true } } },
    orderBy: { startDate: "desc" },
    take: 200,
  });
  return NextResponse.json({ bookings });
}
