import { Heart, MessageCircle, Send, Bookmark, ThumbsUp, MessageSquare, Share2, Globe } from "lucide-react";

// A same-size, same-chrome mock of the real Instagram/Facebook post so
// review decisions are made against what the post will actually look like
// in-feed, not a bare image + a textarea -- requested directly ("do I know
// how this will actually look"). Deliberately shows NO fake counts (likes,
// comments, followers) since a fabricated number would be exactly the kind
// of dishonest social proof Reyse's brand rules elsewhere reject; every
// other frame element (icons, layout, truncation point) mirrors the real
// app faithfully.

function firstLine(caption: string): string {
  const idx = caption.indexOf("\n");
  return idx === -1 ? caption : caption.slice(0, idx);
}

export function InstagramPreview({
  imageUrl,
  caption,
  hashtags,
  slideCount,
  slideIndex,
}: {
  imageUrl: string | null;
  caption: string;
  hashtags: string[];
  slideCount: number;
  slideIndex: number;
}) {
  return (
    <div className="w-full max-w-[360px] mx-auto rounded-lg border border-border-strong bg-black overflow-hidden text-white font-sans">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 flex items-center justify-center text-[11px] font-bold shrink-0">
          R
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight truncate">reyse.co.uk</p>
        </div>
        <div className="flex gap-1">
          {slideCount > 1 &&
            Array.from({ length: slideCount }).map((_, i) => (
              <span
                key={i}
                className={`w-1 h-1 rounded-full ${i === slideIndex ? "bg-white" : "bg-white/30"}`}
              />
            ))}
        </div>
      </div>
      <div className="relative aspect-[4/5] bg-neutral-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">No image</div>
        )}
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3.5">
          <Heart size={22} strokeWidth={1.5} />
          <MessageCircle size={22} strokeWidth={1.5} />
          <Send size={22} strokeWidth={1.5} />
        </div>
        <Bookmark size={22} strokeWidth={1.5} />
      </div>
      <div className="px-3 pb-3">
        <p className="text-[13px] leading-snug">
          <span className="font-semibold mr-1.5">reyse.co.uk</span>
          {firstLine(caption)}
          <span className="text-white/50"> more</span>
        </p>
        {hashtags.length > 0 && (
          <p className="text-[13px] leading-snug text-sky-400/90 mt-0.5">{hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
      </div>
    </div>
  );
}

export function FacebookPreview({
  imageUrl,
  caption,
  hashtags,
  slideCount,
  slideIndex,
}: {
  imageUrl: string | null;
  caption: string;
  hashtags: string[];
  slideCount: number;
  slideIndex: number;
}) {
  return (
    <div className="w-full max-w-[360px] mx-auto rounded-lg border border-border-strong bg-[#242526] overflow-hidden text-white font-sans">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-[12px] font-bold shrink-0">
          R
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight truncate">Reyse</p>
          <div className="flex items-center gap-1 text-white/50 text-[11px]">
            <span>Just now</span>
            <Globe size={10} />
          </div>
        </div>
        {slideCount > 1 && (
          <span className="text-[11px] text-white/50 shrink-0">
            {slideIndex + 1}/{slideCount}
          </span>
        )}
      </div>
      <div className="px-3 pb-2.5">
        <p className="text-[13px] leading-snug whitespace-pre-line">{caption}</p>
        {hashtags.length > 0 && (
          <p className="text-[13px] leading-snug text-sky-400/90 mt-1">{hashtags.map((h) => `#${h}`).join(" ")}</p>
        )}
      </div>
      <div className="relative aspect-[4/5] bg-neutral-900">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40 text-xs">No image</div>
        )}
      </div>
      <div className="flex items-center justify-around px-2 py-1.5 border-t border-white/10 mt-1">
        <div className="flex items-center gap-1.5 text-white/60 text-[12px] px-3 py-1.5">
          <ThumbsUp size={16} strokeWidth={1.5} /> Like
        </div>
        <div className="flex items-center gap-1.5 text-white/60 text-[12px] px-3 py-1.5">
          <MessageSquare size={16} strokeWidth={1.5} /> Comment
        </div>
        <div className="flex items-center gap-1.5 text-white/60 text-[12px] px-3 py-1.5">
          <Share2 size={16} strokeWidth={1.5} /> Share
        </div>
      </div>
    </div>
  );
}
