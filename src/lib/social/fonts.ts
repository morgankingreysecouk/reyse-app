import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Bundled font files (via @fontsource, already used elsewhere in the Reyse
// ecosystem) instead of a runtime fetch to Google Fonts -- a network call
// on every image render is one more thing that can fail unattended in
// production, and Satori refuses to render at all with zero fonts loaded
// (confirmed the hard way: a first version of this fetched fonts.googleapis.com
// at runtime, which silently failed in this sandbox and crashed every
// render with "No fonts are loaded"). Reading a file that ships in
// node_modules can't have that failure mode.
const FONT_PATHS = {
  interRegular: "@fontsource/inter/files/inter-latin-400-normal.woff",
  spaceGroteskBold: "@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff",
} as const;

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();

async function readBundledFont(pkgRelativePath: string): Promise<ArrayBuffer | null> {
  try {
    const absolutePath = join(process.cwd(), "node_modules", pkgRelativePath);
    const buffer = await readFile(absolutePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  } catch (error) {
    console.error(`Failed to read bundled font ${pkgRelativePath}:`, error);
    return null;
  }
}

// Returns null (never throws) on failure so a template render can decide
// how to degrade rather than crash outright.
export function loadFont(which: keyof typeof FONT_PATHS): Promise<ArrayBuffer | null> {
  if (!fontCache.has(which)) {
    fontCache.set(which, readBundledFont(FONT_PATHS[which]));
  }
  return fontCache.get(which)!;
}
