import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renderLinkedInBanner } from "@/lib/brand/bannerRenderer";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const png = await renderLinkedInBanner();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'attachment; filename="reyse-linkedin-banner.png"',
    },
  });
}
