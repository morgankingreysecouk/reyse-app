// No published types for this package -- minimal ambient declaration for the
// one call shape src/lib/brand/logoPdf.ts actually uses.
declare module "svg-to-pdfkit" {
  import type PDFDocument from "pdfkit";

  function SVGtoPDF(
    doc: PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: Record<string, unknown>
  ): void;

  export default SVGtoPDF;
}
