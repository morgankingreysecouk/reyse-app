"use client";

import { useState } from "react";
import { X, Check, XCircle, Send, Undo2, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillarBadge, PlatformBadge, StatusBadge } from "./badges";
import type { SocialPost, SocialPostImage } from "@/generated/prisma/client";

type PostWithImages = SocialPost & { images: SocialPostImage[] };

export function PostModal({
  post: initial,
  onClose,
  onChanged,
}: {
  post: PostWithImages;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [post, setPost] = useState(initial);
  const [caption, setCaption] = useState(initial.caption);
  const [hashtagText, setHashtagText] = useState(initial.hashtags.join(" "));
  const [scheduledFor, setScheduledFor] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTrashed = !!post.deletedAt;
  const dirty = caption !== post.caption || hashtagText !== post.hashtags.join(" ");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/social/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        return false;
      }
      setPost(json.post);
      onChanged();
      return true;
    } catch {
      setError("Couldn't reach the server");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits() {
    await patch({ caption, hashtags: hashtagText.split(/\s+/).filter(Boolean).map((h) => h.replace(/^#/, "")) });
  }

  async function del() {
    setBusy(true);
    await fetch(`/api/social/posts/${post.id}`, { method: "DELETE" });
    setBusy(false);
    onChanged();
    onClose();
  }

  async function restore() {
    setBusy(true);
    await fetch(`/api/social/posts/${post.id}/restore`, { method: "POST" });
    setBusy(false);
    onChanged();
    onClose();
  }

  const activeImage = post.images[slideIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-surface shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-base font-semibold text-ink mr-1">Post</h2>
            <PlatformBadge platform={post.platform} />
            <PillarBadge pillar={post.pillar} />
            <StatusBadge status={post.status} />
            <span className="text-[11px] text-ink-muted">
              Cross-posted -- edits here only affect this platform&apos;s version
            </span>
            {isTrashed && <span className="text-xs text-danger font-medium">In Trash</span>}
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
          <div className="flex flex-col gap-2">
            <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-surface-raised border border-border-strong">
              {activeImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/public/social/assets/${activeImage.assetId}`}
                  alt={activeImage.altText}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-muted text-sm">No image</div>
              )}
              {post.images.length > 1 && (
                <>
                  <button
                    onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                    disabled={slideIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 disabled:opacity-30"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setSlideIndex((i) => Math.min(post.images.length - 1, i + 1))}
                    disabled={slideIndex === post.images.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1.5 disabled:opacity-30"
                    aria-label="Next slide"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[11px] px-2 py-0.5 rounded-full">
                    {slideIndex + 1} / {post.images.length}
                  </div>
                </>
              )}
            </div>
            {activeImage && <p className="text-[11px] text-ink-muted px-1">Alt text: {activeImage.altText}</p>}
            {post.status === "PUBLISHED" && post.externalPostId && (
              <p className="text-[11px] text-ink-muted px-1">Live post ID: {post.externalPostId}</p>
            )}
            {post.status === "FAILED" && post.failureReason && (
              <p className="text-[11px] text-danger px-1">Failed: {post.failureReason}</p>
            )}
            {post.status === "REJECTED" && post.rejectionReason && (
              <p className="text-[11px] text-ink-muted px-1">Reason: {post.rejectionReason}</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Caption</p>
              <textarea
                rows={8}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={isTrashed || busy}
                className="w-full px-3 py-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo resize-none disabled:opacity-50"
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Hashtags</p>
              <input
                value={hashtagText}
                onChange={(e) => setHashtagText(e.target.value)}
                disabled={isTrashed || busy}
                placeholder="hashtag1 hashtag2 hashtag3"
                className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo disabled:opacity-50"
              />
            </div>
            {dirty && !isTrashed && (
              <Button size="sm" variant="secondary" onClick={saveEdits} disabled={busy}>
                Save edits
              </Button>
            )}

            {error && <p className="text-xs text-danger">{error}</p>}

            {!isTrashed && post.status === "DRAFT" && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="flex-1 h-9 px-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      patch({ action: "approve", scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined })
                    }
                    disabled={busy}
                  >
                    <Check size={14} /> Approve &amp; schedule
                  </Button>
                </div>
                <p className="text-[11px] text-ink-muted">Leave the date blank to schedule for right away.</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => patch({ action: "publish_now" })} disabled={busy}>
                    <Send size={14} /> Publish now
                  </Button>
                  {!showRejectInput ? (
                    <Button size="sm" variant="danger" onClick={() => setShowRejectInput(true)} disabled={busy}>
                      <XCircle size={14} /> Reject
                    </Button>
                  ) : null}
                </div>
                {showRejectInput && (
                  <div className="flex items-center gap-2">
                    <input
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Why? (optional)"
                      className="flex-1 h-9 px-2 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
                    />
                    <Button size="sm" variant="danger" onClick={() => patch({ action: "reject", rejectionReason })} disabled={busy}>
                      Confirm reject
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!isTrashed && post.status === "SCHEDULED" && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="secondary" onClick={() => patch({ action: "publish_now" })} disabled={busy}>
                  <Send size={14} /> Publish now
                </Button>
                <Button size="sm" variant="secondary" onClick={() => patch({ action: "undo" })} disabled={busy}>
                  <Undo2 size={14} /> Undo (back to draft)
                </Button>
              </div>
            )}

            {!isTrashed && post.status === "FAILED" && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" onClick={() => patch({ action: "publish_now" })} disabled={busy}>
                  <Send size={14} /> Retry publish
                </Button>
              </div>
            )}

            {!isTrashed && post.status === "PUBLISHED" && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="danger" onClick={() => patch({ action: "undo" })} disabled={busy}>
                  <Undo2 size={14} /> Undo (remove from {post.platform === "INSTAGRAM" ? "Instagram" : "Facebook"})
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          {isTrashed ? (
            <Button variant="secondary" onClick={restore} disabled={busy}>
              <RotateCcw size={14} /> Restore
            </Button>
          ) : (
            <Button variant="danger" onClick={del} disabled={busy}>
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
