import { ImageResponse } from "next/og";
import { loadFont } from "@/lib/social/fonts";
import {
  BRAND,
  LOGO_PATH,
  LOGO_VIEWBOX,
  LOCKUP_VIEWBOX_WIDTH,
  LOCKUP_VIEWBOX_HEIGHT,
  LOCKUP_ICON_RATIO,
  LOCKUP_GAP_RATIO,
  LOCKUP_FONT_SIZE_RATIO,
  LOCKUP_LETTER_SPACING_RATIO,
} from "./constants";

export type LogoStyle = "icon" | "lockup";
export type LogoVariant = "colour" | "white";

function strokeColor(variant: LogoVariant): string {
  return variant === "white" ? BRAND.white : BRAND.indigo;
}

// Hand-authored raw SVG -- kept visually identical to the PNG renderer below
// (same path, same stroke width) so every downloadable format matches exactly.
// The wordmark uses <text font-family="Space Grotesk"> rather than embedding the
// font: an ordinary .svg download is opened in tools (Figma, Illustrator, a
// browser) that already substitute a fallback font sensibly, and the admin page
// tells Morgan the wordmark needs Space Grotesk Bold to render as designed.
export function renderLogoSvg(style: LogoStyle, variant: LogoVariant): string {
  const stroke = strokeColor(variant);
  const iconMarkup = `<path d="${LOGO_PATH}" fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;

  if (style === "icon") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}">\n  ${iconMarkup}\n</svg>\n`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LOCKUP_VIEWBOX_WIDTH} ${LOCKUP_VIEWBOX_HEIGHT}">
  <g transform="translate(4, 4)">${iconMarkup}</g>
  <text x="46" y="23" font-family="Space Grotesk, sans-serif" font-weight="700" font-size="26" letter-spacing="1" fill="${stroke}">REYSE</text>
</svg>
`;
}

export interface LogoPngInput {
  style: LogoStyle;
  variant: LogoVariant;
  /** Square canvas size for "icon"; the wordmark height for "lockup" (width follows the lockup aspect ratio). */
  size: number;
}

export async function renderLogoPng({ style, variant, size }: LogoPngInput): Promise<Buffer> {
  const stroke = strokeColor(variant);
  const spaceGroteskBold = await loadFont("spaceGroteskBold");
  const fonts = spaceGroteskBold
    ? [{ name: "Space Grotesk", data: spaceGroteskBold, weight: 700 as const, style: "normal" as const }]
    : [];

  const width = style === "icon" ? size : Math.round((size * LOCKUP_VIEWBOX_WIDTH) / LOCKUP_VIEWBOX_HEIGHT);
  const height = size;

  const jsx =
    style === "icon" ? (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <svg width={width} height={height} viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} fill="none">
          <path d={LOGO_PATH} stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ) : (
      <div style={{ display: "flex", alignItems: "center", width: "100%", height: "100%", gap: height * LOCKUP_GAP_RATIO }}>
        <svg width={height * LOCKUP_ICON_RATIO} height={height * LOCKUP_ICON_RATIO} viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} fill="none">
          <path d={LOGO_PATH} stroke={stroke} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div
          style={{
            display: "flex",
            fontFamily: spaceGroteskBold ? "Space Grotesk" : "sans-serif",
            fontWeight: 700,
            fontSize: height * LOCKUP_FONT_SIZE_RATIO,
            letterSpacing: height * LOCKUP_LETTER_SPACING_RATIO,
            color: stroke,
          }}
        >
          REYSE
        </div>
      </div>
    );

  const image = new ImageResponse(jsx, { width, height, fonts });
  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
