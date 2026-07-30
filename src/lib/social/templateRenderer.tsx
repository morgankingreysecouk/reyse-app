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

export interface PhotoOverlayInput {
  photo: Buffer;
  headline: string;
  slideIndex: number;
  totalSlides: number;
}

// Composites a headline over a real AI photo instead of leaving the photo
// bare -- research-backed (22 July 2026 research pass, reinforced 30 July
// after Morgan asked for it directly): posts with text overlays get 40-50%
// more engagement than image-only posts, with bold high-contrast text in
// the upper third performing best. Applied to single AI-photo posts and a
// carousel's photo cover slide, never to the plain template slides behind
// it (those already carry their own headline/body layout).
export async function renderPhotoOverlaySlide(input: PhotoOverlayInput): Promise<Buffer> {
  const [spaceGroteskBold] = await Promise.all([loadFont("spaceGroteskBold")]);
  const photoDataUri = `data:image/png;base64,${input.photo.toString("base64")}`;
  const isCarousel = input.totalSlides > 1;

  const fonts = [
    spaceGroteskBold && { name: "Space Grotesk", data: spaceGroteskBold, weight: 700 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundImage: `url(${photoDataUri})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "48%",
            padding: "64px 64px 0",
            background: "linear-gradient(to bottom, rgba(20,18,40,0.75) 0%, rgba(20,18,40,0.35) 55%, rgba(20,18,40,0) 100%)",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                display: "flex",
                fontFamily: spaceGroteskBold ? "Space Grotesk" : "sans-serif",
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: 2,
                color: "#ffffff",
              }}
            >
              REYSE
            </div>
            {isCarousel && (
              <div style={{ display: "flex", fontSize: 22, color: "#ffffff", opacity: 0.85 }}>
                {input.slideIndex + 1} / {input.totalSlides}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: spaceGroteskBold ? "Space Grotesk" : "sans-serif",
              fontWeight: 700,
              fontSize: input.headline.length > 40 ? 52 : 62,
              lineHeight: 1.15,
              color: "#ffffff",
              paddingBottom: 40,
              textShadow: "0 2px 24px rgba(0,0,0,0.45)",
            }}
          >
            {input.headline}
          </div>
        </div>
        <div style={{ display: "flex", flex: 1 }} />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "0 32px 28px",
            background: "linear-gradient(to top, rgba(20,18,40,0.5) 0%, rgba(20,18,40,0) 100%)",
          }}
        >
          <div style={{ display: "flex", fontSize: 20, color: "#ffffff", opacity: 0.8 }}>reyse.co.uk</div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts },
  );

  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
