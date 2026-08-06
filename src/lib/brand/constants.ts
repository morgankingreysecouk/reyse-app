// Single source of truth for every brand-asset renderer (logo, Facebook/LinkedIn/
// Instagram banners). Same palette as src/lib/social/templateRenderer.tsx, which is
// itself Reyse-Website's src/index.css tokens -- one brand across every surface.
export const BRAND = {
  bg: "#faf9f5",
  surface: "#ffffff",
  indigo: "#312e81",
  indigoDeep: "#1e1b4b",
  accent: "#f59e0b",
  ink: "#1c1b2e",
  white: "#ffffff",
} as const;

// The admin dashboard's sidebar/login glyph (src/components/shell/logo.tsx),
// now the one logo mark used everywhere -- admin, website, and every asset here.
export const LOGO_PATH = "M4 20V4h9a5 5 0 0 1 0 10h-5l7 6";
export const LOGO_VIEWBOX = 24;

// Lockup (icon + "REYSE" wordmark) proportions -- one shared definition so the SVG,
// PNG, and PDF renderers, plus the admin page's own size options, can never drift
// out of sync with each other (a real bug caught in build-review: the PDF page size
// used to hardcode its own stale copy of this ratio). Width has a bit of margin
// beyond the PNG's actual (Space Grotesk) text extent -- the SVG/PDF versions render
// "REYSE" with a browser/pdfkit-substituted fallback font, which measured visibly
// wider in testing and left almost no right-hand margin at a tighter width.
export const LOCKUP_VIEWBOX_WIDTH = 145;
export const LOCKUP_VIEWBOX_HEIGHT = 32;
export const LOCKUP_ICON_RATIO = 24 / 32;
export const LOCKUP_GAP_RATIO = 18 / 32;
export const LOCKUP_FONT_SIZE_RATIO = 26 / 32;
export const LOCKUP_LETTER_SPACING_RATIO = 1 / 32;

export const LOGO_STYLES = ["icon", "lockup"] as const;
export const LOGO_VARIANTS = ["colour", "white"] as const;
export const LOGO_PNG_SIZES = [128, 256, 512, 1024, 2048] as const;

// Confirmed with Morgan 6 Aug 2026: problem-led over tagline-led, "enquiry" not
// "message". Used on the Facebook and LinkedIn banners.
export const BANNER_HEADLINE = "Missed an enquiry at 2am? Reyse didn't.";
export const BANNER_SUBLINE = "24/7 AI guest answers across every channel your holiday let uses.";

// The Instagram top-of-profile banner is brand identity, not an ad -- it uses the
// site's own hero tagline (Reyse-Website's index.html) rather than the problem-led
// banner copy above.
export const BRAND_TAGLINE = "AI That Answers Your Guests, Everywhere";
