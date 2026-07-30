import type { gmail_v1 } from "googleapis";
import { db } from "@/lib/db";
import { getAuthorizedGmailClient } from "./googleClient";
import { listFolders, logSyncError } from "./labels";
import { organizeNewMessages, type InboxMessage } from "./organizer";

// Same 5-minute tick as the social media autopilot -- confirmed pattern for
// a background job on Railway's persistent process.
const TICK_INTERVAL_MS = 5 * 60 * 1000;

// Caps how many messages one tick will classify and file, so a big backlog
// (e.g. the very first sync) doesn't fire an enormous single AI call --
// it'll just catch up over a few ticks instead.
const MAX_MESSAGES_PER_TICK = 20;

async function getMessageDetails(gmail: gmail_v1.Gmail, id: string): Promise<InboxMessage & { hasUserLabel: boolean }> {
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Subject", "From"],
  });
  const headers = data.payload?.headers ?? [];
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
  const from = headers.find((h) => h.name === "From")?.value ?? "(unknown sender)";

  // A message that already carries a user-created label has already been
  // filed (by an earlier tick, or manually in Gmail) -- skip re-filing it.
  const labelIds = data.labelIds ?? [];
  const hasUserLabel = labelIds.some((l) => !SYSTEM_LABEL_PREFIXES.some((p) => l === p || l.startsWith(p)));

  return { id, subject, from, snippet: data.snippet ?? "", hasUserLabel };
}

const SYSTEM_LABEL_PREFIXES = [
  "INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "IMPORTANT", "UNREAD", "CHAT", "CATEGORY_",
];

async function scanRecentInbox(gmail: gmail_v1.Gmail): Promise<string[]> {
  // No history cursor (first run ever, or the old one expired) -- take a
  // bounded slice of the current inbox to establish/re-establish a
  // starting point rather than trying to process everything at once.
  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox",
    maxResults: MAX_MESSAGES_PER_TICK,
  });
  return (data.messages ?? []).map((m) => m.id!).filter(Boolean);
}

async function findNewMessageIds(gmail: gmail_v1.Gmail, historyId: string | null): Promise<string[]> {
  if (!historyId) {
    return scanRecentInbox(gmail);
  }

  try {
    const ids = new Set<string>();
    let pageToken: string | undefined;
    do {
      const { data } = await gmail.users.history.list({
        userId: "me",
        startHistoryId: historyId,
        historyTypes: ["messageAdded"],
        pageToken,
      });
      for (const record of data.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          if (added.message?.id) ids.add(added.message.id);
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken && ids.size < MAX_MESSAGES_PER_TICK);

    return Array.from(ids).slice(0, MAX_MESSAGES_PER_TICK);
  } catch (error) {
    // Gmail only keeps history for about a week -- if the app was offline
    // longer than that (or historyId is otherwise invalid), history.list
    // 404s. Without this fallback the scheduler would fail identically on
    // every tick forever, since nothing else ever resets historyId.
    // Falling back to a fresh inbox scan self-heals: syncAndOrganize
    // re-derives a current historyId from getProfile() right after this
    // returns, same as the very-first-run path.
    console.warn("Mail sync: history cursor invalid, falling back to a fresh inbox scan:", error);
    return scanRecentInbox(gmail);
  }
}

async function syncAndOrganize(): Promise<void> {
  const authorized = await getAuthorizedGmailClient();
  if (!authorized) return; // not connected yet

  const { gmail, account } = authorized;

  try {
    const candidateIds = await findNewMessageIds(gmail, account.historyId);
    const details = await Promise.all(candidateIds.map((id) => getMessageDetails(gmail, id)));
    const unfiled = details.filter((m) => !m.hasUserLabel);

    if (unfiled.length > 0) {
      const folders = await listFolders(gmail);
      await organizeNewMessages(gmail, unfiled, folders);
    }

    const profile = await gmail.users.getProfile({ userId: "me" });
    await db.mailAccount.update({
      where: { id: "singleton" },
      data: {
        historyId: profile.data.historyId ?? account.historyId,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Mail sync/organize tick failed:", error);
    await logSyncError(`Sync failed: ${message}`).catch(() => {});
    await db.mailAccount
      .update({ where: { id: "singleton" }, data: { lastSyncError: message } })
      .catch(() => {});
  }
}

let started = false;

export function startMailScheduler(): void {
  if (started) return;
  started = true;
  console.log("Email Assistant: scheduler started, checking every 5 minutes.");
  setInterval(() => {
    syncAndOrganize().catch((error) => console.error("Mail scheduler tick failed:", error));
  }, TICK_INTERVAL_MS);
}
