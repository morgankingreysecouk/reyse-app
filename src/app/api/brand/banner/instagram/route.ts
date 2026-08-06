import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renderInstagramBannerTile, type InstagramTile } from "@/lib/brand/bannerRenderer";

const VALID_TILES = [1, 2, 3];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tile = Number(request.nextUrl.searchParams.get("tile"));
  if (!VALID_TILES.includes(tile)) {
    return NextResponse.json({ error: "Invalid tile, expected 1, 2, or 3" }, { status: 400 });
  }

  const png = await renderInstagramBannerTile(tile as InstagramTile);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="reyse-instagram-tile-${tile}.png"`,
    },
  });
}
