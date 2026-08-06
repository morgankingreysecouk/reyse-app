"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DownloadLink } from "./download-link";
import { LOGO_STYLES, LOGO_VARIANTS, LOGO_PNG_SIZES } from "@/lib/brand/constants";
import type { LogoStyle, LogoVariant } from "@/lib/brand/logoRenderer";

// Ids come from constants.ts (shared with the /api/brand/logo route's own
// validation) so this UI can never offer a combination the API would reject.
const STYLE_LABELS: Record<LogoStyle, string> = {
  icon: "Icon only",
  lockup: "Icon + wordmark",
};
const VARIANT_LABELS: Record<LogoVariant, string> = {
  colour: "Colour — light backgrounds",
  white: "White — dark backgrounds",
};

export function LogoSection() {
  const [style, setStyle] = useState<LogoStyle>("icon");
  const [variant, setVariant] = useState<LogoVariant>("colour");

  const query = `style=${style}&variant=${variant}`;
  const previewBg = variant === "white" ? "#1e1b4b" : "transparent";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon size={16} /> Logo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Style</p>
            <div className="flex gap-2">
              {LOGO_STYLES.map((s) => (
                <Button key={s} size="sm" variant={style === s ? "primary" : "secondary"} onClick={() => setStyle(s)}>
                  {STYLE_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Colour</p>
            <div className="flex gap-2">
              {LOGO_VARIANTS.map((v) => (
                <Button key={v} size="sm" variant={variant === v ? "primary" : "secondary"} onClick={() => setVariant(v)}>
                  {VARIANT_LABELS[v]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="rounded-lg border border-border-strong flex items-center justify-center h-40"
          style={{ backgroundColor: previewBg }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/brand/logo?format=png&${query}&size=512`} alt="Logo preview" className="h-24" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">
              Vector — any size, print-ready
            </p>
            <div className="flex flex-wrap gap-2">
              <DownloadLink href={`/api/brand/logo?format=svg&${query}`}>SVG</DownloadLink>
              <DownloadLink href={`/api/brand/logo?format=pdf&${query}`}>PDF</DownloadLink>
            </div>
            {style === "lockup" && (
              <p className="text-[11px] text-ink-muted mt-1.5">
                The SVG/PDF wordmark needs Space Grotesk Bold installed to render as designed &mdash; the PNG below is
                always accurate since it&apos;s rendered with the font baked in.
              </p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">PNG — pick a size</p>
            <div className="flex flex-wrap gap-2">
              {LOGO_PNG_SIZES.map((size) => (
                <DownloadLink key={size} href={`/api/brand/logo?format=png&${query}&size=${size}`}>
                  {size}px
                </DownloadLink>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
