import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveClientFromWidgetKey } from "@/lib/widgetAuth";

// Public, unauthenticated, on purpose -- the widget iframe renders this
// directly in an <img> tag. Same trust model as
// /api/public/social/assets/[id]: nothing sensitive lives here, and the
// widgetKey itself is already the access boundary for which client's logo
// this is. Cacheable hard once a client sets their logo (re-uploading
// creates a fresh row via upsert, so a cached stale image only lingers for
// the CDN's TTL, not forever).
export async function GET(request: NextRequest, { params }: { params: Promise<{ widgetKey: string }> }) {
  const { widgetKey } = await params;
  const client = await resolveClientFromWidgetKey(widgetKey);
  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const logo = await db.clientLogo.findUnique({ where: { clientId: client.id } });
  if (!logo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(logo.data), {
    status: 200,
    headers: {
      "Content-Type": logo.mimeType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
