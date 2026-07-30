import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const collectionId = params.get("collectionId");
  const classification = params.get("classification");
  const includeExcluded = params.get("includeExcluded") === "true";
  const hasEmail = params.get("hasEmail") === "true";

  const where: Prisma.LeadWhereInput = {};
  if (!includeExcluded) where.excluded = false;
  if (collectionId) where.collectionId = collectionId;
  if (classification) where.classification = classification as Prisma.EnumLeadClassificationFilter["equals"];
  if (hasEmail) where.email = { not: null };

  const leads = await db.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    // No pager UI yet -- same bounded-read pattern as Enquiries, keeps this
    // endpoint from silently fetching an unbounded result set as volume grows.
    take: 500,
  });

  const total = await db.lead.count({ where });

  return NextResponse.json({ leads, total });
}
