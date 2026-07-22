import { Images } from "lucide-react";
import { PillarBadge, PlatformBadge, StatusBadge } from "./badges";
import type { SocialPost, SocialPostImage } from "@/generated/prisma/client";

type PostWithImages = SocialPost & { images: Pick<SocialPostImage, "id" | "assetId" | "order" | "altText" | "source">[] };

export function PostCard({ post, onClick }: { post: PostWithImages; onClick: () => void }) {
  const cover = post.images[0];

  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-border bg-surface overflow-hidden hover:border-indigo/40 transition-colors flex flex-col"
    >
      <div className="relative aspect-[4/5] bg-surface-raised">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own DB-backed route, not next/image-optimizable remote content worth the config
          <img src={`/api/public/social/assets/${cover.assetId}`} alt={cover.altText} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">No image</div>
        )}
        {post.images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/60 text-white text-[11px] px-1.5 py-0.5 rounded-md flex items-center gap-1">
            <Images size={11} /> {post.images.length}
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PlatformBadge platform={post.platform} />
          <StatusBadge status={post.status} />
        </div>
        <PillarBadge pillar={post.pillar} />
        <p className="text-xs text-ink-muted line-clamp-3">{post.caption}</p>
      </div>
    </button>
  );
}
