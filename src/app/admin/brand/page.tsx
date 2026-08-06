import { LogoSection } from "@/components/brand/logo-section";
import { PaletteSection } from "@/components/brand/palette-section";
import { BannersSection } from "@/components/brand/banners-section";

export default function BrandPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="font-display text-xl font-semibold text-ink">Brand Assets</h1>
        <p className="text-sm text-ink-muted mt-1">
          The logo, colours, fonts, and ready-made social banners &mdash; everything generated here comes straight
          from the same brand tokens the website and social posts use, so nothing drifts out of sync.
        </p>
      </div>
      <LogoSection />
      <PaletteSection />
      <BannersSection />
    </div>
  );
}
