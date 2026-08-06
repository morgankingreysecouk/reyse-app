"use client";

import { useState } from "react";
import { Palette, Check, Copy } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BRAND } from "@/lib/brand/constants";

// The site's actual brand tokens (Reyse-Website's src/index.css), not a separate
// admin-app palette -- same source templateRenderer.tsx and bannerRenderer.tsx render
// against, so this page can never drift from what's actually shipping.
const SWATCHES = [
  { name: "Indigo", hex: BRAND.indigo, cssVar: "--color-brand-indigo" },
  { name: "Indigo deep", hex: BRAND.indigoDeep, cssVar: "--color-brand-indigo-deep" },
  { name: "Accent (amber)", hex: BRAND.accent, cssVar: "--color-brand-accent" },
  { name: "Background", hex: BRAND.bg, cssVar: "--color-brand-bg" },
  { name: "Surface", hex: BRAND.surface, cssVar: "--color-brand-surface" },
  { name: "Ink", hex: BRAND.ink, cssVar: "--color-brand-ink" },
];

function Swatch({ name, hex, cssVar }: { name: string; hex: string; cssVar: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(hex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex flex-col items-start gap-2 rounded-lg border border-border-strong p-3 text-left hover:border-ink-faint transition-colors"
    >
      <div
        className="w-full h-14 rounded-md border border-border-strong"
        style={{ backgroundColor: hex }}
      />
      <div className="flex items-center justify-between w-full">
        <div>
          <p className="text-xs font-medium text-ink">{name}</p>
          <p className="text-[11px] text-ink-muted font-mono">{hex}</p>
        </div>
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} className="text-ink-faint" />}
      </div>
      <p className="text-[10px] text-ink-faint font-mono truncate w-full">{cssVar}</p>
    </button>
  );
}

export function PaletteSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette size={16} /> Colour &amp; typography
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-2">Palette (click to copy hex)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SWATCHES.map((s) => (
              <Swatch key={s.name} {...s} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-2">Fonts</p>
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border-strong p-3">
              <p className="font-display font-bold text-xl text-ink">Space Grotesk</p>
              <p className="text-[11px] text-ink-muted mt-0.5">Headings &amp; the REYSE wordmark. Weight used: 700 (Bold).</p>
            </div>
            <div className="rounded-lg border border-border-strong p-3">
              <p className="font-sans text-xl text-ink">Inter</p>
              <p className="text-[11px] text-ink-muted mt-0.5">Body copy. Weights used: 400 (Regular), 700 (Bold), 900 (Black).</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
