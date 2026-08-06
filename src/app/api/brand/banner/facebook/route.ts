import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renderFacebookBanner } from "@/lib/brand/bannerRenderer";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const png = await renderFacebookBanner();
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": 'attachment; filename="reyse-facebook-cover.png"',
    },
  });
}
