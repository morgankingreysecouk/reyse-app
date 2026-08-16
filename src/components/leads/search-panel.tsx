"use client";

import { useRef, useState } from "react";
import { Search, Loader2, MapPin, Globe, LayoutGrid, X } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/cn";
import { SEARCH_TERMS, UK_REGIONS } from "@/lib/leadgen/searchTerms";

interface Collection {
  id: string;
  name: string;
}

interface ProgressState {
  message: string;
  saved: number;
  skipped: number;
  failed: number;
  combosRun?: number;
  combosTotal?: number;
  capped?: string;
}

// Whole-county search, not pick-a-town-and-a-phrase-and-click-repeatedly.
// Morgan's explicit call (5 Aug 2026): type/pick a county, and it works
// through every town in it x every search phrase automatically -- "every
// single lead possible," no manual per-town selection. The three separate
// region/town/phrase selects this used to have are gone; the server
// (src/app/api/leads/search/route.ts) does the looping now.
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
  const [collectionId, setCollectionId] = useState<string>("");
  const [newCollectionName, setNewCollectionName] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const region = UK_REGIONS.find((r) => r.name === regionName) ?? UK_REGIONS[0]!;
  const comboCount = region.points.length * SEARCH_TERMS.length;

  const runSearch = async () => {
    setRunning(true);
    setError(null);
    setProgress({ message: "Starting...", saved: 0, skipped: 0, failed: 0 });

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

    const url = new URL("/api/leads/search", window.location.origin);
    url.searchParams.set("mode", mode);
    url.searchParams.set("region", region.name);
    if (activeCollectionId) url.searchParams.set("collectionId", activeCollectionId);

    const es = new EventSource(url.toString());
    esRef.current = es;
    let saved = 0;
    let skipped = 0;
    let failed = 0;
    // The server still sends its normal "done" stats after a fatal "error"
    // (e.g. 5 combos in a row failing the same way) -- it's the same code
    // path as a clean finish, just arrived at early. Once the fatal error
    // is shown, "done" arriving moments later shouldn't silently overwrite
    // it back to a cheerful "Done."
    let fatalErrorShown = false;

    es.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (fatalErrorShown) return;
      if (data.type === "status") {
        setProgress((p) => ({ ...(p ?? { saved, skipped, failed, message: "" }), saved, skipped, failed, message: data.message }));
      } else if (data.type === "classified") {
        saved++;
        setProgress((p) => ({ ...(p ?? { message: "" }), saved, skipped, failed, message: `Saved: ${data.lead.name}` }));
      } else if (data.type === "skipped") {
        skipped++;
        setProgress((p) => ({ ...(p ?? { message: "" }), saved, skipped, failed }));
      } else if (data.type === "combo-error") {
        failed++;
        setProgress((p) => ({
          ...(p ?? { message: "" }),
          saved,
          skipped,
          failed,
          message: `${data.point} -- "${data.term}" failed: ${data.message}`,
        }));
      } else if (data.type === "capped") {
        setProgress((p) => ({ ...(p ?? { message: "" }), saved, skipped, failed, capped: data.message }));
      } else if (data.type === "error") {
        fatalErrorShown = true;
        es.close();
        setRunning(false);
        setError(data.message);
      } else if (data.type === "done") {
        setProgress((p) => ({
          message: "Done.",
          saved: data.stats.saved,
          skipped: data.stats.skippedDuplicates,
          failed: data.stats.combosFailed ?? failed,
          combosRun: data.stats.combosRun,
          combosTotal: data.stats.combosTotal,
          capped: p?.capped,
        }));
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

  const cancelSearch = () => {
    esRef.current?.close();
    setRunning(false);
    setProgress((p) => (p ? { ...p, message: "Cancelled -- whatever was already found is saved." } : p));
    onSearchComplete();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search size={16} /> Find leads
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Search using</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={running}
              onClick={() => setMode("places")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
                mode === "places"
                  ? "bg-indigo/10 border-indigo text-indigo"
                  : "border-border-strong text-ink-muted hover:border-ink-faint"
              )}
            >
              <MapPin size={14} /> Map search
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => setMode("cse")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-9 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none",
                mode === "cse"
                  ? "bg-indigo/10 border-indigo text-indigo"
                  : "border-border-strong text-ink-muted hover:border-ink-faint"
              )}
            >
              <Globe size={14} /> Web search
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">County</p>
          <Combobox
            options={UK_REGIONS.map((r) => r.name)}
            value={regionName}
            onChange={setRegionName}
            placeholder="Type a county..."
            disabled={running}
          />
          <p className="text-xs text-ink-muted mt-2 flex items-start gap-1.5">
            <LayoutGrid size={12} className="shrink-0 mt-0.5" />
            <span>
              Every town in {region.name} ({region.points.length}) x every search phrase ({SEARCH_TERMS.length}) ·{" "}
              {comboCount} searches, no picking required.
            </span>
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-2">Collection (optional)</p>
          <div className="space-y-2">
            <select
              value={collectionId}
              disabled={running}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none disabled:opacity-50 disabled:pointer-events-none"
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
              disabled={running}
              onChange={(e) => {
                setNewCollectionName(e.target.value);
                setCollectionId("");
              }}
              placeholder="...or name a new collection"
              className="w-full h-9 px-2.5 rounded-md bg-surface-raised border border-border-strong text-sm text-ink outline-none placeholder:text-ink-faint disabled:opacity-50 disabled:pointer-events-none"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" disabled={running} onClick={runSearch}>
            {running ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {running ? "Searching..." : `Search all of ${region.name}`}
          </Button>
          {running && (
            <Button variant="secondary" onClick={cancelSearch} title="Stop this search -- whatever's already found stays saved">
              <X size={14} /> Cancel
            </Button>
          )}
        </div>

        {progress && (
          <div
            className={cn(
              "text-xs rounded-md px-3 py-2 space-y-0.5",
              progress.capped ? "bg-warning/10 text-warning" : "bg-surface-raised text-ink-muted"
            )}
          >
            {progress.combosRun !== undefined && progress.combosTotal !== undefined && (
              <p className="text-ink font-medium">
                Covered {progress.combosRun} of {progress.combosTotal} town/phrase searches
              </p>
            )}
            <p>{progress.capped ?? progress.message}</p>
            <p className="text-ink-muted">
              Saved {progress.saved}
              {progress.skipped > 0 && ` · Skipped ${progress.skipped} already known`}
              {progress.failed > 0 && ` · ${progress.failed} search${progress.failed === 1 ? "" : "es"} failed`}
            </p>
          </div>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
