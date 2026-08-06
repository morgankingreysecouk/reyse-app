import { ImageResponse } from "next/og";
import { loadBannerFonts } from "./fonts";
import { BRAND, LOGO_PATH, LOGO_VIEWBOX, BANNER_HEADLINE, BANNER_SUBLINE, BRAND_TAGLINE } from "./constants";

function LogoMark({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`} fill="none">
      <path d={LOGO_PATH} stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Facebook's circular profile picture and LinkedIn's square page logo both overlap
// the bottom-left corner of their cover/banner images, so every layout below keeps
// all text in a right-hand column and confines the logo lockup to a left column --
// safe regardless of exact vertical position, rather than tuning padding per-platform.
function TwoColumnBanner({
  width,
  height,
  leftWidth,
  displayFont,
  bodyFont,
  logoSize,
  wordmarkSize,
  headlineSize,
  sublineSize,
  gap,
}: {
  width: number;
  height: number;
  leftWidth: number;
  displayFont: string;
  bodyFont: string;
  logoSize: number;
  wordmarkSize: number;
  headlineSize: number;
  sublineSize: number;
  gap: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        backgroundColor: BRAND.indigoDeep,
        fontFamily: bodyFont,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: logoSize * 0.4,
          width: leftWidth,
          height: "100%",
          paddingLeft: gap,
        }}
      >
        <LogoMark size={logoSize} color={BRAND.white} />
        <div style={{ display: "flex", fontFamily: displayFont, fontWeight: 700, fontSize: wordmarkSize, letterSpacing: 2, color: BRAND.white }}>
          REYSE
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: width - leftWidth,
          height: "100%",
          paddingRight: gap,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: displayFont,
            fontWeight: 700,
            fontSize: headlineSize,
            lineHeight: 1.1,
            color: BRAND.white,
          }}
        >
          {BANNER_HEADLINE}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: sublineSize,
            lineHeight: 1.4,
            color: BRAND.white,
            opacity: 0.75,
            marginTop: gap * 0.4,
          }}
        >
          {BANNER_SUBLINE}
        </div>
      </div>
    </div>
  );
}

// 851x315 -- Meta's current recommended cover-photo size (desktop displays it at
// 850x312). Profile picture overlaps the bottom-left; see TwoColumnBanner above.
export async function renderFacebookBanner(): Promise<Buffer> {
  const { fonts, displayFont, bodyFont } = await loadBannerFonts();
  const width = 851;
  const height = 315;

  const image = new ImageResponse(
    (
      <TwoColumnBanner
        width={width}
        height={height}
        leftWidth={260}
        displayFont={displayFont}
        bodyFont={bodyFont}
        logoSize={34}
        wordmarkSize={26}
        headlineSize={40}
        sublineSize={18}
        gap={40}
      />
    ),
    { width, height, fonts }
  );
  return Buffer.from(await image.arrayBuffer());
}

// 4200x700 -- LinkedIn's recommended company-page banner upload size (6:1, displays
// at ~1128x191), so text has to read at a fraction of this canvas's actual size.
export async function renderLinkedInBanner(): Promise<Buffer> {
  const { fonts, displayFont, bodyFont } = await loadBannerFonts();
  const width = 4200;
  const height = 700;

  const image = new ImageResponse(
    (
      <TwoColumnBanner
        width={width}
        height={height}
        leftWidth={1150}
        displayFont={displayFont}
        bodyFont={bodyFont}
        logoSize={140}
        wordmarkSize={100}
        headlineSize={130}
        sublineSize={52}
        gap={110}
      />
    ),
    { width, height, fonts }
  );
  return Buffer.from(await image.arrayBuffer());
}

// One 3240x1350 artboard, windowed into three 1080x1350 tiles via an
// overflow-hidden clipping container shifted left per tile -- no image-cropping
// dependency (e.g. sharp) needed, satori/resvg already supports position:absolute
// and overflow:hidden. Upload order on Instagram must be tile 3, then 2, then 1
// (newest post lands top-left of the grid), documented on the admin page.
const IG_ARTBOARD_WIDTH = 3240;
const IG_TILE_WIDTH = 1080;
const IG_TILE_HEIGHT = 1350;

// A centred column of logo+wordmark+tagline only ever fills the middle tile,
// leaving tiles 1 and 3 blank -- not a "continuous banner" at all. Laying the
// three elements out in a row with justify-content: space-around instead lands
// their centres close to 1/6, 3/6, 5/6 of the artboard width, i.e. roughly the
// visual centre of tile 1, tile 2, and tile 3, so each tile carries a real piece
// of one connected design. (space-evenly would be the exact version of this but
// satori/next-og's CSS subset doesn't support it -- space-around is the closest
// supported value.)
function InstagramArtboard({
  displayFont,
  bodyFont,
}: {
  displayFont: string;
  bodyFont: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        width: IG_ARTBOARD_WIDTH,
        height: IG_TILE_HEIGHT,
        backgroundColor: BRAND.indigoDeep,
        fontFamily: bodyFont,
      }}
    >
      <LogoMark size={420} color={BRAND.white} />
      <div
        style={{
          display: "flex",
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: 300,
          letterSpacing: 10,
          color: BRAND.white,
        }}
      >
        REYSE
      </div>
      <div
        style={{
          display: "flex",
          width: 820,
          fontSize: 64,
          lineHeight: 1.3,
          color: BRAND.accent,
          textAlign: "center",
          justifyContent: "center",
        }}
      >
        {BRAND_TAGLINE}
      </div>
    </div>
  );
}

export type InstagramTile = 1 | 2 | 3;

export async function renderInstagramBannerTile(tile: InstagramTile): Promise<Buffer> {
  const { fonts, displayFont, bodyFont } = await loadBannerFonts();
  const tileIndex = tile - 1; // 0-based offset into the shared artboard

  const image = new ImageResponse(
    (
      <div style={{ display: "flex", width: IG_TILE_WIDTH, height: IG_TILE_HEIGHT, overflow: "hidden" }}>
        <div style={{ display: "flex", position: "relative", left: -tileIndex * IG_TILE_WIDTH, top: 0 }}>
          <InstagramArtboard displayFont={displayFont} bodyFont={bodyFont} />
        </div>
      </div>
    ),
    { width: IG_TILE_WIDTH, height: IG_TILE_HEIGHT, fonts }
  );
  return Buffer.from(await image.arrayBuffer());
}
