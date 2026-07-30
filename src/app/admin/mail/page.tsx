"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail as MailIcon, Inbox, Folder, RefreshCw, AlertCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MailFolder {
  id: string;
  name: string;
}

interface MailMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string | null;
  unread: boolean;
}

interface ActivityEntry {
  id: string;
  action: string;
  summary: string;
  createdAt: string;
}

interface Status {
  connected: boolean;
  email?: string;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function MailPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status | null>(null);
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const statusRes = await fetch("/api/mail/status");
      const statusData: Status = await statusRes.json();
      setStatus(statusData);

      if (statusData.connected) {
        const [foldersRes, messagesRes, activityRes] = await Promise.all([
          fetch("/api/mail/labels"),
          fetch(`/api/mail/messages?labelId=${encodeURIComponent(selectedFolder)}`),
          fetch("/api/mail/activity"),
        ]);
        if (foldersRes.ok) setFolders((await foldersRes.json()).folders);
        if (messagesRes.ok) setMessages((await messagesRes.json()).messages);
        if (activityRes.ok) setActivity((await activityRes.json()).activity);
      }
    } catch {
      setError("Couldn't load your inbox. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [selectedFolder]);

  useEffect(() => {
    // Same plain fetch-on-mount/change pattern as the rest of this app --
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const connectError = searchParams.get("connectError");
  const justConnected = searchParams.get("connected") === "true";

  if (loading && !status) {
    return (
      <div className="h-full flex items-center justify-center text-ink-muted text-sm">
        Loading...
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="max-w-md w-full text-center px-8 py-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo/10 text-indigo">
            <MailIcon size={22} />
          </div>
          <h2 className="font-display text-lg font-semibold text-ink mb-1.5">Connect your inbox</h2>
          <p className="text-sm text-ink-muted leading-relaxed mb-5">
            Give Rey access to morgan.king@reyse.co.uk to read it, organise it into folders, and (soon)
            draft replies. Nothing is ever sent without you hitting send yourself.
          </p>
          {connectError && (
            <p className="text-xs text-danger mb-4">Couldn&apos;t connect: {connectError}</p>
          )}
          {error && <p className="text-xs text-danger mb-4">{error}</p>}
          <Button onClick={() => (window.location.href = "/api/mail/connect")}>
            Connect Gmail
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-ink">Mail</h1>
          <p className="text-sm text-ink-muted">{status.email}</p>
        </div>
        <div className="flex items-center gap-3">
          {justConnected && <Badge tone="success">Connected</Badge>}
          {status.lastSyncError ? (
            <Badge tone="danger">
              <AlertCircle size={12} /> Sync error
            </Badge>
          ) : status.lastSyncedAt ? (
            <span className="text-xs text-ink-faint">Synced {timeAgo(status.lastSyncedAt)}</span>
          ) : (
            <span className="text-xs text-ink-faint">Not synced yet -- first pass runs within 5 minutes</span>
          )}
          <Button variant="secondary" size="sm" onClick={() => load()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex-1 grid grid-cols-[200px_1fr_280px] gap-4 min-h-0">
        <Card className="overflow-y-auto">
          <CardContent className="p-2">
            <button
              onClick={() => setSelectedFolder("INBOX")}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                selectedFolder === "INBOX" ? "bg-indigo/10 text-indigo" : "text-ink-muted hover:bg-surface-raised"
              }`}
            >
              <Inbox size={15} /> Inbox
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                  selectedFolder === folder.id ? "bg-indigo/10 text-indigo" : "text-ink-muted hover:bg-surface-raised"
                }`}
              >
                <Folder size={15} />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
            {folders.length === 0 && (
              <p className="text-xs text-ink-faint px-3 py-2">
                No folders yet -- Rey creates these automatically as mail comes in.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-y-auto">
          <CardContent className="p-0 divide-y divide-border">
            {messages.length === 0 && (
              <p className="text-sm text-ink-faint px-5 py-6">Nothing here.</p>
            )}
            {messages.map((message) => (
              <div key={message.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm truncate ${message.unread ? "font-semibold text-ink" : "text-ink-muted"}`}>
                    {message.from}
                  </span>
                  {message.date && (
                    <span className="text-xs text-ink-faint shrink-0">{timeAgo(message.date)}</span>
                  )}
                </div>
                <p className={`text-sm truncate ${message.unread ? "text-ink" : "text-ink-muted"}`}>
                  {message.subject}
                </p>
                <p className="text-xs text-ink-faint truncate">{message.snippet}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-y-auto">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {activity.length === 0 && (
              <p className="text-sm text-ink-faint px-5 py-6">Nothing yet.</p>
            )}
            {activity.map((entry) => (
              <div key={entry.id} className="px-5 py-3">
                <p className="text-sm text-ink">{entry.summary}</p>
                <p className="text-xs text-ink-faint">{timeAgo(entry.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
