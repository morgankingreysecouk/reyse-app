import { ImageResponse } from "next/og";
import { loadFont } from "./fonts";

// 4:5 portrait -- the research-backed sweet spot for carousels, and used
// for single template posts too so the whole feed stays visually
// consistent. Reuses reyse.co.uk's actual brand tokens (Reyse-Website's
// src/index.css), not a bespoke admin-app palette, since this graphic is
// going out under the same brand as the website.
const WIDTH = 1080;
const HEIGHT = 1350;
const BRAND = {
  bg: "#faf9f5",
  surface: "#ffffff",
  indigo: "#312e81",
  indigoDeep: "#1e1b4b",
  accent: "#f59e0b",
  ink: "#1c1b2e",
};

export interface SlideRenderInput {
  headline: string;
  body: string;
  slideIndex: number; // 0-based
  totalSlides: number;
}

export async function renderTemplateSlide(input: SlideRenderInput): Promise<Buffer> {
  const [spaceGroteskBold, interRegular] = await Promise.all([
    loadFont("spaceGroteskBold"),
    loadFont("interRegular"),
  ]);

  const fonts = [
    spaceGroteskBold && { name: "Space Grotesk", data: spaceGroteskBold, weight: 700 as const, style: "normal" as const },
    interRegular && { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  const isCarousel = input.totalSlides > 1;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: BRAND.bg,
          padding: "80px 72px",
          fontFamily: interRegular ? "Inter" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              fontFamily: spaceGroteskBold ? "Space Grotesk" : "sans-serif",
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: 2,
              color: BRAND.indigo,
            }}
          >
            REYSE
          </div>
          {isCarousel && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: BRAND.ink,
                opacity: 0.55,
              }}
            >
              {input.slideIndex + 1} / {input.totalSlides}
            </div>
          )}
        </div>

        <div style={{ display: "flex", width: 64, height: 6, backgroundColor: BRAND.accent, marginTop: 48, borderRadius: 3 }} />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-start", paddingTop: 64 }}>
          <div
            style={{
              display: "flex",
              fontFamily: spaceGroteskBold ? "Space Grotesk" : "sans-serif",
              fontWeight: 700,
              fontSize: input.headline.length > 40 ? 56 : 68,
              lineHeight: 1.15,
              color: BRAND.indigoDeep,
              marginTop: 32,
              marginBottom: 40,
            }}
          >
            {input.headline}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              lineHeight: 1.5,
              color: BRAND.ink,
              opacity: 0.85,
            }}
          >
            {input.body}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 22, color: BRAND.ink, opacity: 0.45 }}>reyse.co.uk</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts },
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
