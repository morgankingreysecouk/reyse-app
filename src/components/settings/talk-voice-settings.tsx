"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Volume2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TALK_VOICES } from "@/lib/talk/voices";
import type { TalkSettings } from "@/generated/prisma/client";

const NO_BLEND = "__none__";

export function TalkVoiceSettings() {
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState("bm_lewis");
  const [blendVoice, setBlendVoice] = useState<string>(NO_BLEND);
  const [speed, setSpeed] = useState(1.0);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/talk/settings")
      .then((res) => res.json())
      .then((data: { settings: TalkSettings }) => {
        setVoice(data.settings.voice);
        setBlendVoice(data.settings.blendVoice ?? NO_BLEND);
        setSpeed(data.settings.speed);
      })
      .catch(() => setError("Couldn't load current voice settings."))
      .finally(() => setLoading(false));
  }, []);

  async function preview() {
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/talk/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice,
          blendVoice: blendVoice === NO_BLEND ? null : blendVoice,
          speed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      const audioEl = audioRef.current ?? new Audio();
      audioRef.current = audioEl;
      audioEl.src = `data:audio/mpeg;base64,${data.audio}`;
      await audioEl.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/talk/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice,
          blendVoice: blendVoice === NO_BLEND ? null : blendVoice,
          speed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-ink-muted">Loading voice settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 size={16} /> Rey&apos;s voice
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <p className="text-xs text-ink-muted -mt-1">
          Controls what Talk to Rey sounds like. There&apos;s no separate pitch or tone dial in the
          engine behind this &mdash; voice choice, an optional blend of two voices, and speed are the
          real controls available.
        </p>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">Voice</p>
          <select
            value={voice}
            onChange={(e) => {
              const next = e.target.value;
              setVoice(next);
              if (next === blendVoice) setBlendVoice(NO_BLEND);
            }}
            className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
          >
            {TALK_VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} &mdash; grade {v.grade}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-1.5">
            Blend with (optional)
          </p>
          <select
            value={blendVoice}
            onChange={(e) => setBlendVoice(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none focus:border-indigo"
          >
            <option value={NO_BLEND}>None &mdash; single voice only</option>
            {TALK_VOICES.filter((v) => v.id !== voice).map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink-muted mt-1">
            Mixes the two voices in equal measure for a custom in-between sound.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Speed</p>
            <span className="text-xs text-ink-muted">{speed.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.05}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full accent-indigo"
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        {saved && !error && <p className="text-xs text-accent">Saved &mdash; Talk to Rey will use this from the next turn.</p>}

        <div className="flex gap-2">
          <Button variant="secondary" onClick={preview} disabled={previewing}>
            <Play size={14} /> {previewing ? "Playing..." : "Preview"}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
