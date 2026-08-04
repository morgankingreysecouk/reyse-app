"use client";

import { useEffect, useRef, useState } from "react";
import { RatingInput } from "./rating-input";
import { PillarBadge, PlatformBadge, StatusBadge } from "./badges";
import type { SocialPost, SocialPostImage } from "@/generated/prisma/client";

type PostWithImages = SocialPost & { images: Pick<SocialPostImage, "id" | "order" | "assetId" | "altText">[] };

// Every field here saves itself -- no Save button anywhere in this row.
// Rating saves the instant a pip is clicked; the feedback textarea saves
// ~600ms after typing stops, with a small inline status word so it's
// obvious a save actually happened rather than being a silent promise.
export function HistoryRow({ post }: { post: PostWithImages }) {
  const [rating, setRating] = useState(post.rating);
  const [note, setNote] = useState(post.ratingNote ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cover = post.images[0];

  async function persist(body: Record<string, unknown>) {
    setStatus("saving");
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  }

  function handleRatingChange(next: number | null) {
    setRating(next);
    persist({ rating: next });
  }

  function handleNoteChange(next: string) {
    setNote(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist({ ratingNote: next }), 600);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-surface p-3.5">
      <div className="relative w-20 h-24 shrink-0 rounded-lg overflow-hidden bg-surface-raised">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/public/social/assets/${cover.assetId}`} alt={cover.altText} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-muted text-[10px]">No image</div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <PlatformBadge platform={post.platform} />
          <StatusBadge status={post.status} />
          <PillarBadge pillar={post.pillar} />
          <span className="text-[11px] text-ink-faint ml-auto shrink-0">
            {new Date(post.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
        <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{post.caption}</p>

        <div className="flex items-center justify-between gap-3 pt-1">
          <RatingInput value={rating} onChange={handleRatingChange} />
          <span className="text-[11px] text-ink-faint w-10 text-right shrink-0">
            {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
          </span>
        </div>
        <textarea
          value={note}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder="What worked, what didn't..."
          rows={2}
          className="w-full px-2.5 py-1.5 rounded-md bg-surface-raised border border-border-strong text-xs text-ink outline-none focus:border-indigo resize-none placeholder:text-ink-faint"
        />
      </div>
    </div>
  );
}
