import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// Every field here originates from a scraped website, not a trusted human --
// a business name or personalisation line beginning with =, +, -, or @ would
// be interpreted as a formula by Excel/Sheets on open ("CSV injection"). A
// leading tab defuses that (invisible in the rendered cell, but stops the
// leading character being read as a formula prefix) before the normal
// quote/comma/newline escaping runs.
function csvEscape(value: string | null | undefined): string {
  let v = value ?? "";
  if (/^[=+\-@]/.test(v)) v = `\t${v}`;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const COLUMNS = [
  "name",
  "url",
  "location",
  "phone",
  "email",
  "emailVerification",
  "instagram",
  "instagramVerification",
  "linkedin",
  "facebook",
  "contactName",
  "personalisationLine",
] as const;

// Excludes `excluded` leads unconditionally -- this is the exact bug the old
// backend had (its "blocked contacts" list promised exclusion from exports
// but the export code never actually checked it). Here there's only one
// flag and only one code path reads it, so that drift can't happen again.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const collectionId = params.get("collectionId");
  const requireEmail = params.get("requireEmail") === "true";

  const where: Prisma.LeadWhereInput = { excluded: false, classification: "INDEPENDENT" };
  if (collectionId) where.collectionId = collectionId;
  if (requireEmail) where.email = { not: null };

  const leads = await db.lead.findMany({ where, orderBy: { createdAt: "desc" } });

  const rows = [
    COLUMNS.join(","),
    ...leads.map((lead) => COLUMNS.map((col) => csvEscape(lead[col] as string | null)).join(",")),
  ];

  await db.lead.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, data: { exportedAt: new Date() } });

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="reyse-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
