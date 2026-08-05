"use client";

import { useState } from "react";
import { Search, Loader2, MapPin, Globe } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEARCH_TERMS, UK_REGIONS } from "@/lib/leadgen/searchTerms";

interface Collection {
  id: string;
  name: string;
}

interface ProgressState {
  message: string;
  candidatesFound?: number;
  saved: number;
  skipped: number;
}

export function SearchPanel({
  collections,
  onCreateCollection,
  onSearchComplete,
}: {
  collections: Collection[];
  onCreateCollection: (name: string) => Promise<string>;
  onSearchComplete: () => void;
}) {
  const [mode, setMode] = useState<"places" | "cse">("places");
  const [regionName, setRegionName] = useState(UK_REGIONS[0]!.name);
  const [pointName, setPointName] = useState(UK_REGIONS[0]!.points[0]!.name);
  const [term, setTerm] = useState<string>(SEARCH_TERMS[0]);
  const [collectionId, setCollectionId] = useState<string>("");
  const [newCollectionName, setNewCollectionName] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const region = UK_REGIONS.find((r) => r.name === regionName)!;
  const point = region.points.find((p) => p.name === pointName) ?? region.points[0]!;

  const runSearch = async () => {
    setRunning(true);
    setError(null);
    setProgress({ message: "Starting...", saved: 0, skipped: 0 });

    let activeCollectionId = collectionId;
    if (!activeCollectionId && newCollectionName.trim()) {
      try {
        activeCollectionId = await onCreateCollection(newCollectionName.trim());
        setCollectionId(activeCollectionId);
        setNewCollectionName("");
      } catch {
        setError("Couldn't create the collection.");
        setRunning(false);
        return;
      }
    }

    const query = mode === "places" ? term : `${term} ${point.name}`;
    const url = new URL("/api/leads/search", window.location.origin);
    url.searchParams.set("mode", mode);
    url.searchParams.set("query", query);
    if (mode === "places") {
      url.searchParams.set("lat", String(point.lat));
      url.searchParams.set("lng", String(point.lng));
    }
    if (activeCollectionId) url.searchParams.set("collectionId", activeCollectionId);

    const es = new EventSource(url.toString());
    let saved = 0;
    let skipped = 0;

    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === "status") {
        setProgress((p) => ({ saved: p?.saved ?? saved, skipped: p?.skipped ?? skipped, message: data.message }));
      } else if (data.type === "classified") {
        saved++;
        setProgress({ saved, skipped, message: `Saved: ${data.lead.name}` });
      } else if (data.type === "skipped") {
        skipped++;
        setProgress((p) => ({ saved, skipped, message: p?.message ?? "" }));
      } else if (data.type === "error") {
        setError(data.message);
      } else if (data.type === "done") {
        setProgress({
          message: "Done.",
          candidatesFound: data.stats.candidatesFound,
          saved: data.stats.saved,
          skipped: data.stats.skippedDuplicates,
        });
        es.close();
        setRunning(false);
        onSearchComplete();
      }
    };
    es.onerror = () => {
      es.close();
      setRunning(false);
      setError((prev) => prev ?? "Connection to the search stream was lost.");
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search size={16} /> Find leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("places")}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors ${
              mode === "places" ? "bg-indigo/10 border-indigo text-indigo" : "border-border-strong text-ink-muted"
            }`}
          >
            <MapPin size={14} /> Map search
          </button>
          <button
            onClick={() => setMode("cse")}
            className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors ${
              mode === "cse" ? "bg-indigo/10 border-indigo text-indigo" : "border-border-strong text-ink-muted"
            }`}
          >
            <Globe size={14} /> Web search
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            value={regionName}
            onChange={(e) => {
              setRegionName(e.target.value);
              setPointName(UK_REGIONS.find((r) => r.name === e.target.value)!.points[0]!.name);
            }}
            className="h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none"
          >
            {UK_REGIONS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          <select
            value={pointName}
            onChange={(e) => setPointName(e.target.value)}
            className="h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none"
          >
            {region.points.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <select
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          className="w-full h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none"
        >
          {SEARCH_TERMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Stacked, not side-by-side -- this panel is only ~320px wide, and
            two fields sharing that width left "or new collection name"
            visibly cut off. */}
        <div className="space-y-2">
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="w-full h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none"
          >
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            value={newCollectionName}
            onChange={(e) => {
              setNewCollectionName(e.target.value);
              setCollectionId("");
            }}
            placeholder="...or name a new collection"
            className="w-full h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </div>

        <Button className="w-full" disabled={running} onClick={runSearch}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {running ? "Searching..." : "Search"}
        </Button>

        {progress && (
          <div className="text-xs text-ink-muted bg-surface-raised rounded-md px-3 py-2">
            <p>{progress.message}</p>
            <p className="mt-0.5">
              Saved {progress.saved}
              {progress.skipped > 0 && ` · Skipped ${progress.skipped} already known`}
            </p>
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
