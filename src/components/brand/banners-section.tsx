import { Image as ImageIcon, PanelTop, Grid3x3 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DownloadLink } from "./download-link";

export function BannersSection() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon size={16} /> Facebook cover photo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted">
            851 &times; 315px, Meta&apos;s current recommended cover size. Facebook overlays your profile picture on
            the bottom-left corner, so the design keeps that corner clear.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/brand/banner/facebook"
            alt="Facebook cover preview"
            className="rounded-lg border border-border-strong w-full"
          />
          <div>
            <DownloadLink href="/api/brand/banner/facebook">Download PNG</DownloadLink>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PanelTop size={16} /> LinkedIn company banner
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted">
            4200 &times; 700px (6:1) &mdash; LinkedIn&apos;s recommended upload size for a sharp result, though it
            displays at roughly 1128 &times; 191px on the page.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/brand/banner/linkedin"
            alt="LinkedIn banner preview"
            className="rounded-lg border border-border-strong w-full"
          />
          <div>
            <DownloadLink href="/api/brand/banner/linkedin">Download PNG</DownloadLink>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 size={16} /> Instagram top-of-profile banner
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-ink-muted">
            One wide image, cut into 3 posts (1080 &times; 1350px each) so it reads as a single continuous banner
            across the top row of your profile grid.
          </p>
          <div className="flex w-full rounded-lg border border-border-strong overflow-hidden">
            {[1, 2, 3].map((tile) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={tile}
                src={`/api/brand/banner/instagram?tile=${tile}`}
                alt={`Instagram tile ${tile}`}
                className="w-1/3 block"
              />
            ))}
          </div>
          <div className="rounded-lg border border-border-strong bg-surface-raised p-3">
            <p className="text-xs font-medium text-ink mb-1">Post in this order</p>
            <p className="text-[11px] text-ink-muted leading-relaxed">
              Instagram puts your newest post top-left, so upload right tile first and left tile last: Tile 3, then
              Tile 2, then Tile 1. Once all three are up they&apos;ll display left-to-right in the order shown above.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <DownloadLink href="/api/brand/banner/instagram?tile=1">Tile 1 (post last)</DownloadLink>
            <DownloadLink href="/api/brand/banner/instagram?tile=2">Tile 2 (post 2nd)</DownloadLink>
            <DownloadLink href="/api/brand/banner/instagram?tile=3">Tile 3 (post first)</DownloadLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
