"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Trash2, Settings, Sparkles, BookOpen, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SocialStatsBar, type SocialStats } from "@/components/social/stats-bar";
import { PostCard } from "@/components/social/post-card";
import { PostModal } from "@/components/social/post-modal";
import { SettingsPanel } from "@/components/social/settings-panel";
import { KnowledgeModal } from "@/components/chat/knowledge-modal";
import type { SocialPillar, SocialPost, SocialPostImage, SocialPostStatus, SocialSettings } from "@/generated/prisma/client";

type PostWithImages = SocialPost & { images: SocialPostImage[] };

const STATUS_TABS: { value: SocialPostStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Awaiting review" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
  { value: "REJECTED", label: "Rejected" },
];

const PILLAR_OPTIONS: SocialPillar[] = ["EDUCATION", "TIPS", "PROMOTION", "SOCIAL_PROOF", "BEHIND_THE_SCENES", "NEWS"];

// Two rows share a groupId (one Instagram, one Facebook version of the
// same content) -- grouped into one card instead of two visually-identical
// cards, which Morgan flagged as reading like accidental duplication.
// Instagram sorted first for a consistent default in the modal.
function groupPosts(posts: PostWithImages[]): PostWithImages[][] {
  const byGroup = new Map<string, PostWithImages[]>();
  for (const post of posts) {
    const group = byGroup.get(post.groupId) ?? [];
    group.push(post);
    byGroup.set(post.groupId, group);
  }
  return Array.from(byGroup.values()).map((group) =>
    [...group].sort((a) => (a.platform === "INSTAGRAM" ? -1 : 1)),
  );
}

export default function InstagramPage() {
  const [posts, setPosts] = useState<PostWithImages[]>([]);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | "">("DRAFT");
  const [pillarFilter, setPillarFilter] = useState<SocialPillar | "">("");
  const [showTrash, setShowTrash] = useState(false);

  const [selected, setSelected] = useState<PostWithImages[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeContent, setKnowledgeContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (pillarFilter) params.set("pillar", pillarFilter);
      if (showTrash) params.set("trashed", "true");

      const [postsRes, statsRes, settingsRes] = await Promise.all([
        fetch(`/api/social/posts?${params.toString()}`),
        fetch("/api/social/stats"),
        fetch("/api/social/settings"),
      ]);
      if (!postsRes.ok || !statsRes.ok || !settingsRes.ok) throw new Error("Request failed");

      const postsData = await postsRes.json();
      setPosts(postsData.posts);
      setStats(await statsRes.json());
      setSettings((await settingsRes.json()).settings);
    } catch {
      setError("Couldn't load posts. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pillarFilter, showTrash]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openKnowledge = async () => {
    const res = await fetch("/api/chat/knowledge");
    if (!res.ok) return;
    const { knowledge } = await res.json();
    setKnowledgeContent(knowledge.content);
    setKnowledgeOpen(true);
  };

  const saveKnowledge = async (content: string) => {
    const res = await fetch("/api/chat/knowledge", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error("Failed to save");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/social/generate", { method: "POST" });
      if (res.ok) await load();
      else {
        const json = await res.json();
        setError(json.error ?? "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo to-indigo-deep text-white shadow-[0_4px_16px_-4px_rgba(99,102,241,0.6)]">
            <Camera size={20} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Social</h1>
            <p className="text-sm text-ink-muted mt-0.5">
              AI-generated Instagram and Facebook posts promoting Reyse -- reviewed here before anything goes live.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={openKnowledge}>
            <BookOpen size={14} /> Edit knowledge base
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings size={14} /> Settings
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={generating}>
            <Sparkles size={14} /> {generating ? "Generating..." : "Generate now"}
          </Button>
        </div>
      </div>

      {stats && <SocialStatsBar stats={stats} />}

      {settings && !settings.enabled && (
        <Card className="px-4 py-3 border-warning/40 bg-warning/5">
          <p className="text-sm text-warning">Automation is currently paused in Settings -- nothing is generating or publishing.</p>
        </Card>
      )}

      <Card className="p-2.5 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-0.5 flex-wrap bg-surface-raised/60 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              onClick={() => setStatusFilter(tab.value)}
              className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
                statusFilter === tab.value ? "bg-indigo text-white shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <select
            value={pillarFilter}
            onChange={(e) => setPillarFilter(e.target.value as SocialPillar | "")}
            className="h-9 pl-3 pr-8 rounded-lg bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo appearance-none cursor-pointer"
          >
            <option value="">All pillars</option>
            {PILLAR_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p.replace(/_/g, " ").toLowerCase()}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        </div>
        <button
          onClick={() => setShowTrash((v) => !v)}
          className={`ml-auto inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border font-medium transition-colors ${
            showTrash ? "bg-danger/10 text-danger border-danger/30" : "text-ink-muted border-border-strong hover:text-ink hover:border-ink-faint"
          }`}
        >
          <Trash2 size={13} /> {showTrash ? "Viewing Trash" : "Trash"}
        </button>
      </Card>

      {loading ? (
        <div className="p-8 text-center text-sm text-ink-muted">Loading...</div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-danger">{error}</div>
      ) : posts.length === 0 ? (
        <div className="p-8 text-center text-sm text-ink-muted">
          {showTrash ? "Trash is empty." : "No posts match these filters yet -- try Generate now."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {groupPosts(posts).map((group) => (
            <PostCard key={group[0].groupId} posts={group} onClick={() => setSelected(group)} />
          ))}
        </div>
      )}

      {selected && (
        <PostModal
          posts={selected}
          onClose={() => setSelected(null)}
          onChanged={load}
        />
      )}

      {settingsOpen && settings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSaved={(s) => {
            setSettings(s);
            setSettingsOpen(false);
          }}
        />
      )}

      {knowledgeOpen && (
        <KnowledgeModal
          initialContent={knowledgeContent}
          onClose={() => setKnowledgeOpen(false)}
          onSave={saveKnowledge}
        />
      )}
    </div>
  );
}
