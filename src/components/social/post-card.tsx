import { Images } from "lucide-react";
import { PillarBadge, PlatformBadge, StatusBadge } from "./badges";
import type { SocialPost, SocialPostImage } from "@/generated/prisma/client";

type PostWithImages = SocialPost & { images: Pick<SocialPostImage, "id" | "assetId" | "order" | "altText" | "source">[] };

// A card represents one cross-posted GROUP (1-2 rows sharing a groupId,
// same images/pillar, one Instagram version and one Facebook version) --
// shown as a single card with a badge per platform, not two near-identical
// cards, since that read as accidental duplication.
export function PostCard({ posts, onClick }: { posts: PostWithImages[]; onClick: () => void }) {
  const cover = posts[0].images[0];

  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-border bg-surface overflow-hidden flex flex-col transition-all duration-200 hover:border-indigo/50 hover:shadow-[0_8px_30px_-8px_rgba(99,102,241,0.35)] hover:-translate-y-0.5"
    >
      <div className="relative aspect-[4/5] bg-surface-raised overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- served from our own DB-backed route, not next/image-optimizable remote content worth the config
          <img
            src={`/api/public/social/assets/${cover.assetId}`}
            alt={cover.altText}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">No image</div>
        )}

        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between gap-1.5">
          <div className="flex flex-col gap-1">
            {posts.map((post) => (
              <span key={post.id} className="inline-flex items-center gap-1 backdrop-blur-sm bg-black/40 rounded-full px-1 py-0.5 w-fit">
                <PlatformBadge platform={post.platform} />
                <StatusBadge status={post.status} />
              </span>
            ))}
          </div>
          {posts[0].images.length > 1 && (
            <div className="shrink-0 bg-black/50 backdrop-blur-sm text-white text-[11px] px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Images size={11} /> {posts[0].images.length}
            </div>
          )}
        </div>
      </div>
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <PillarBadge pillar={posts[0].pillar} />
        <p className="text-xs text-ink-muted leading-relaxed line-clamp-3">{posts[0].caption}</p>
      </div>
    </button>
  );
}
