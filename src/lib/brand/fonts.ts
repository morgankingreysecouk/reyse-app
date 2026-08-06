// Same bundled-fonts approach as social/fonts.ts (no runtime Google Fonts fetch --
// see that file's comment for why), reused here so bannerRenderer.tsx doesn't
// duplicate the font-loading dance for every banner it renders.
import { loadFont } from "@/lib/social/fonts";

export interface LoadedBannerFonts {
  fonts: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[];
  displayFont: string;
  bodyFont: string;
}

export async function loadBannerFonts(): Promise<LoadedBannerFonts> {
  const [spaceGroteskBold, interRegular] = await Promise.all([
    loadFont("spaceGroteskBold"),
    loadFont("interRegular"),
  ]);

  const fonts = [
    spaceGroteskBold && { name: "Space Grotesk", data: spaceGroteskBold, weight: 700 as const, style: "normal" as const },
    interRegular && { name: "Inter", data: interRegular, weight: 400 as const, style: "normal" as const },
  ].filter((f): f is NonNullable<typeof f> => Boolean(f));

  return {
    fonts,
    displayFont: spaceGroteskBold ? "Space Grotesk" : "sans-serif",
    bodyFont: interRegular ? "Inter" : "sans-serif",
  };
}
