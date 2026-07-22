"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Trash2, Settings, Sparkles, BookOpen } from "lucide-react";
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

export default function InstagramPage() {
  const [posts, setPosts] = useState<PostWithImages[]>([]);
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [settings, setSettings] = useState<SocialSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | "">("DRAFT");
  const [pillarFilter, setPillarFilter] = useState<SocialPillar | "">("");
  const [showTrash, setShowTrash] = useState(false);

  const [selected, setSelected] = useState<PostWithImages | null>(null);
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
        <div>
          <h1 className="font-display text-xl font-semibold text-ink flex items-center gap-2">
            <Camera size={20} />
            Social
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            AI-generated Instagram and Facebook posts promoting Reyse -- single posts and carousels, reviewed here before anything goes live.
          </p>
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

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              onClick={() => setStatusFilter(tab.value)}
              className={`text-sm px-2.5 py-1 rounded-md transition-colors ${
                statusFilter === tab.value ? "bg-indigo/10 text-indigo" : "text-ink-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={pillarFilter}
          onChange={(e) => setPillarFilter(e.target.value as SocialPillar | "")}
          className="h-8 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
        >
          <option value="">All pillars</option>
          {PILLAR_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p.replace(/_/g, " ").toLowerCase()}
            </option>
          ))}
        </select>
        <button
          onClick={() => setShowTrash((v) => !v)}
          className={`ml-auto inline-flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-md border transition-colors ${
            showTrash ? "bg-danger/10 text-danger border-danger/30" : "text-ink-muted border-border-strong hover:text-ink"
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onClick={() => setSelected(post)} />
          ))}
        </div>
      )}

      {selected && (
        <PostModal
          post={selected}
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
