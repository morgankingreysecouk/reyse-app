import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStarterQuestions } from "@/lib/starterQuestions";

// Explicitly triggered only (end of onboarding wizard + this manual
// button) -- never run on every property-info save, so a paid Claude call
// never fires as a side effect of routine editing.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const client = await db.client.findUnique({ where: { id } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const properties = await db.property.findMany({ where: { clientId: id, deletedAt: null } });

  try {
    const questions = await generateStarterQuestions(client, properties);
    const updated = await db.client.update({ where: { id }, data: { starterQuestions: questions } });
    return NextResponse.json({ client: updated });
  } catch (error) {
    console.error(`Failed to generate starter questions for client ${id}:`, error);
    return NextResponse.json({ error: "Failed to generate starter questions" }, { status: 500 });
  }
}
