import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { renderLogoSvg, renderLogoPng, type LogoStyle, type LogoVariant } from "@/lib/brand/logoRenderer";
import { renderLogoPdf } from "@/lib/brand/logoPdf";
import { LOGO_STYLES, LOGO_VARIANTS, LOGO_PNG_SIZES } from "@/lib/brand/constants";

// Session-protected: not under /api/public/, so src/proxy.ts already covers this
// route, matching every other download endpoint in the app (e.g. leads/export).
// Allow-lists shared with components/brand/logo-section.tsx via constants.ts so
// the UI's buttons and this route's validation can't drift apart.
const STYLES: readonly LogoStyle[] = LOGO_STYLES;
const VARIANTS: readonly LogoVariant[] = LOGO_VARIANTS;
const PNG_SIZES: readonly number[] = LOGO_PNG_SIZES;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const format = params.get("format") ?? "svg";
  const style = params.get("style") ?? "icon";
  const variant = params.get("variant") ?? "colour";

  if (!STYLES.includes(style as LogoStyle)) {
    return NextResponse.json({ error: `Invalid style, expected one of: ${STYLES.join(", ")}` }, { status: 400 });
  }
  if (!VARIANTS.includes(variant as LogoVariant)) {
    return NextResponse.json({ error: `Invalid variant, expected one of: ${VARIANTS.join(", ")}` }, { status: 400 });
  }

  const filenameBase = `reyse-logo-${style}-${variant}`;

  if (format === "svg") {
    const svg = renderLogoSvg(style as LogoStyle, variant as LogoVariant);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="${filenameBase}.svg"`,
      },
    });
  }

  if (format === "png") {
    const size = Number(params.get("size") ?? 512);
    if (!PNG_SIZES.includes(size)) {
      return NextResponse.json({ error: `Invalid size, expected one of: ${PNG_SIZES.join(", ")}` }, { status: 400 });
    }
    const png = await renderLogoPng({ style: style as LogoStyle, variant: variant as LogoVariant, size });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filenameBase}-${size}.png"`,
      },
    });
  }

  if (format === "pdf") {
    const pdf = await renderLogoPdf(style as LogoStyle, variant as LogoVariant);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format, expected svg, png, or pdf" }, { status: 400 });
}
