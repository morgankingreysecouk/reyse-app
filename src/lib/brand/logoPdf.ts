import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { renderLogoSvg, type LogoStyle, type LogoVariant } from "./logoRenderer";
import { LOCKUP_VIEWBOX_WIDTH, LOCKUP_VIEWBOX_HEIGHT } from "./constants";

const ICON_PDF_SIZE = 200; // points; vector, so this is just the artboard -- prints/scales losslessly at any size
// Derived from the same lockup viewBox ratio the SVG/PNG renderers use, not a
// separate hardcoded copy -- a stale duplicate of this ratio (caught in build
// review) left the lockup PDF page much wider than its actual content.
const LOCKUP_PDF_WIDTH = 200 * (LOCKUP_VIEWBOX_WIDTH / LOCKUP_VIEWBOX_HEIGHT);
const LOCKUP_PDF_HEIGHT = 200;

// Vector PDF for print/design-tool use -- pdfkit draws the page, svg-to-pdfkit
// converts the same hand-authored SVG markup used for the .svg download so every
// format traces back to one definition of the logo.
export function renderLogoPdf(style: LogoStyle, variant: LogoVariant): Promise<Buffer> {
  const svg = renderLogoSvg(style, variant);
  const width = style === "icon" ? ICON_PDF_SIZE : LOCKUP_PDF_WIDTH;
  const height = style === "icon" ? ICON_PDF_SIZE : LOCKUP_PDF_HEIGHT;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, height], margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    SVGtoPDF(doc, svg, 0, 0, { width, height, preserveAspectRatio: "xMidYMid meet" });
    doc.end();
  });
}
