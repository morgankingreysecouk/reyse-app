"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History as HistoryIcon, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HistoryRow } from "@/components/social/history-row";
import type { SocialPillar, SocialPost, SocialPostImage, SocialPostStatus } from "@/generated/prisma/client";

type PostWithImages = SocialPost & { images: Pick<SocialPostImage, "id" | "order" | "assetId" | "altText">[] };

const STATUS_OPTIONS: { value: SocialPostStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
  { value: "REJECTED", label: "Rejected" },
];

const PILLAR_OPTIONS: SocialPillar[] = ["EDUCATION", "TIPS", "PROMOTION", "SOCIAL_PROOF", "BEHIND_THE_SCENES", "NEWS"];

const RATED_OPTIONS: { value: "" | "rated" | "unrated"; label: string }[] = [
  { value: "", label: "Rated or not" },
  { value: "rated", label: "Rated only" },
  { value: "unrated", label: "Unrated only" },
];

// The full history of everything ever generated, not just the review
// queue -- every post here can be rated 1-10 and given a written note, both
// saving themselves the moment they change (see HistoryRow). Requested
// directly: a way to build up a real record of what's actually working
// across the whole feed, not just what's currently pending approval.
export default function SocialHistoryPage() {
  const [posts, setPosts] = useState<PostWithImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | "">("");
  const [pillarFilter, setPillarFilter] = useState<SocialPillar | "">("");
  const [ratedFilter, setRatedFilter] = useState<"" | "rated" | "unrated">("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (pillarFilter) params.set("pillar", pillarFilter);
      const res = await fetch(`/api/social/posts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPosts(json.posts);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pillarFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visible = posts.filter((p) => {
    if (ratedFilter === "rated") return p.rating !== null;
    if (ratedFilter === "unrated") return p.rating === null;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo to-indigo-deep text-white shadow-[0_4px_16px_-4px_rgba(99,102,241,0.6)]">
          <HistoryIcon size={20} />
        </span>
        <div className="flex-1">
          <h1 className="font-display text-xl font-semibold text-ink">Post history</h1>
          <p className="text-sm text-ink-muted mt-0.5">Every post ever generated. Rate it and leave notes -- both save as you go.</p>
        </div>
        <Link
          href="/admin/social"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors shrink-0"
        >
          <ArrowLeft size={14} /> Back to Social
        </Link>
      </div>

      <Card className="p-2.5 flex flex-wrap items-center gap-2.5">
        <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as SocialPostStatus | "")} options={STATUS_OPTIONS} />
        <FilterSelect
          value={pillarFilter}
          onChange={(v) => setPillarFilter(v as SocialPillar | "")}
          options={[{ value: "", label: "All pillars" }, ...PILLAR_OPTIONS.map((p) => ({ value: p, label: p.replace(/_/g, " ").toLowerCase() }))]}
        />
        <FilterSelect value={ratedFilter} onChange={(v) => setRatedFilter(v as "" | "rated" | "unrated")} options={RATED_OPTIONS} />
        <span className="ml-auto text-xs text-ink-muted">
          {visible.length} post{visible.length === 1 ? "" : "s"}
        </span>
      </Card>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-muted">No posts match these filters.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((post) => (
            <HistoryRow key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-3 pr-8 rounded-lg bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}
