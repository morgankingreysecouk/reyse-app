import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateEnquiryInput } from "@/lib/enquiries";
import type { Prisma } from "@/generated/prisma/client";

// Session check here is belt-and-braces, not the only line of defence --
// proxy.ts already blocks unauthenticated requests before they reach this
// handler. Kept explicit anyway since a route file should be safe to read
// on its own without having to trust the middleware silently did its job.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const channel = searchParams.get("channel");
  const includeDeleted = searchParams.get("trash") === "true";
  const includeTest = searchParams.get("includeTest") === "true";

  const where: Prisma.EnquiryWhereInput = {
    deletedAt: includeDeleted ? { not: null } : null,
  };
  if (status) where.status = status as Prisma.EnumEnquiryStatusFilter["equals"];
  if (channel) where.channel = channel as Prisma.EnumEnquiryChannelFilter["equals"];
  if (!includeTest) where.isTest = false;

  const enquiries = await db.enquiry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    // No pager UI yet -- a hard cap keeps this endpoint bounded as volume
    // grows rather than silently fetching an unbounded result set.
    take: 200,
  });

  return NextResponse.json({ enquiries });
}

// Manual add from the dashboard -- also used for "Add test enquiry" when
// the request body includes isTest: true. Distinct from
// /api/public/enquiries, which is the unauthenticated, API-key-protected
// path the website itself calls.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateEnquiryInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const isTest = typeof (body as Record<string, unknown>).isTest === "boolean"
    ? (body as Record<string, unknown>).isTest as boolean
    : false;

  const enquiry = await db.enquiry.create({
    data: { ...validated.data, channel: "MANUAL", isTest },
  });

  return NextResponse.json({ enquiry }, { status: 201 });
}
