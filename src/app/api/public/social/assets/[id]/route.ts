import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public, unauthenticated, on purpose: Meta's Graph API fetches images by
// plain HTTPS URL when publishing a post, so this has to be reachable with
// no secret -- same trust model as the live-chat SSE stream (an
// unguessable cuid is the access boundary, like an unlisted share link).
// Assets are immutable once created, so this can be cached hard.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const asset = await db.socialAsset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(asset.data), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
