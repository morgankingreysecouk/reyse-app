import type { gmail_v1 } from "googleapis";
import type { MailBackfillStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getAuthorizedGmailClient } from "./googleClient";
import { isFolderLabel, listFolders, logSyncError, type Folder } from "./labels";
import { organizeMessages, type InboxMessage } from "./organizer";

// Same 5-minute tick as the social media autopilot -- confirmed pattern for
// a background job on Railway's persistent process.
const TICK_INTERVAL_MS = 5 * 60 * 1000;

// Caps how many messages one tick will classify and file, so a big backlog
// doesn't fire an enormous single AI call -- it catches up gradually
// across ticks instead. Applies separately to the ongoing new-mail job and
// the backfill sweep, so neither one starves the other.
const MAX_MESSAGES_PER_TICK = 20;
const BACKFILL_PAGE_SIZE = 20;

interface RawMessage {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  labelIds: string[];
}

async function getMessageDetails(gmail: gmail_v1.Gmail, id: string): Promise<RawMessage> {
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Subject", "From"],
  });
  const headers = data.payload?.headers ?? [];
  const subject = headers.find((h) => h.name === "Subject")?.value ?? "(no subject)";
  const from = headers.find((h) => h.name === "From")?.value ?? "(unknown sender)";
  return { id, subject, from, snippet: data.snippet ?? "", labelIds: data.labelIds ?? [] };
}

function toInboxMessage(raw: RawMessage, folderById: Map<string, Folder>): InboxMessage {
  const currentFolders = raw.labelIds
    .filter(isFolderLabel)
    .map((id) => folderById.get(id))
    .filter((f): f is Folder => Boolean(f));
  return { id: raw.id, subject: raw.subject, from: raw.from, snippet: raw.snippet, currentFolders };
}

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
    console.warn("Mail sync: history cursor invalid, falling back to a fresh inbox scan:", error);
    return scanRecentInbox(gmail);
  }
}

// The ongoing job: catches genuinely new, unfiled mail as it arrives.
// Deliberately conservative -- only touches messages with no folder on
// them yet, so it never fights a manual filing choice Morgan made himself
// between ticks. The backfill sweep below is the one that reconsiders
// everything, including mail that already has a folder.
async function syncNewMail(gmail: gmail_v1.Gmail, historyId: string | null): Promise<string | null | undefined> {
  const candidateIds = await findNewMessageIds(gmail, historyId);
  const details = await Promise.all(candidateIds.map((id) => getMessageDetails(gmail, id)));
  const unfiled = details.filter((m) => !m.labelIds.some(isFolderLabel));

  if (unfiled.length > 0) {
    const folders = await listFolders(gmail);
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const messages: InboxMessage[] = unfiled.map((m) => toInboxMessage(m, folderById));
    await organizeMessages(gmail, messages, folders);
  }

  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.historyId ?? historyId;
}

// The one-off (well, resumable-across-ticks) sweep through the *entire*
// existing mailbox -- Morgan asked for this explicitly (30 July 2026):
// look at everything already sitting in folders, not just new arrivals,
// and move things properly rather than only ever adding a label on top.
// Excludes Sent/Drafts/Trash/Spam/Chat -- reorganising your own outgoing
// mail or things already on their way out doesn't make sense.
async function runBackfillTick(
  gmail: gmail_v1.Gmail,
  status: MailBackfillStatus,
  pageToken: string | null,
): Promise<{ status: MailBackfillStatus; pageToken: string | null }> {
  if (status === "DONE") return { status, pageToken };

  let data: gmail_v1.Schema$ListMessagesResponse;
  try {
    ({ data } = await gmail.users.messages.list({
      userId: "me",
      q: "-in:sent -in:draft -in:trash -in:spam -in:chat",
      maxResults: BACKFILL_PAGE_SIZE,
      pageToken: pageToken ?? undefined,
    }));
  } catch (error) {
    // A pageToken can go stale over a sweep spanning hours (a big mailbox
    // takes many ticks). Restarting from the first page is safe, not just
    // convenient -- refileMessage() is a no-op for anything already
    // correctly filed, so re-walking already-processed mail costs some
    // wasted API/AI calls but never re-does or undoes real work. Without
    // this, a stale token would fail identically forever, the same class
    // of bug already fixed once for the new-mail sync cursor.
    console.warn("Mail backfill: page token invalid, restarting the sweep from the first page:", error);
    ({ data } = await gmail.users.messages.list({
      userId: "me",
      q: "-in:sent -in:draft -in:trash -in:spam -in:chat",
      maxResults: BACKFILL_PAGE_SIZE,
    }));
  }

  const ids = (data.messages ?? []).map((m) => m.id!).filter(Boolean);
  if (ids.length > 0) {
    const [details, folders] = await Promise.all([
      Promise.all(ids.map((id) => getMessageDetails(gmail, id))),
      listFolders(gmail),
    ]);
    const folderById = new Map(folders.map((f) => [f.id, f]));
    const messages: InboxMessage[] = details.map((m) => toInboxMessage(m, folderById));
    await organizeMessages(gmail, messages, folders);
  }

  const nextPageToken = data.nextPageToken ?? null;
  return { status: nextPageToken ? "IN_PROGRESS" : "DONE", pageToken: nextPageToken };
}

async function tick(): Promise<void> {
  const authorized = await getAuthorizedGmailClient();
  if (!authorized) return; // not connected yet

  const { gmail, account } = authorized;

  try {
    const newHistoryId = await syncNewMail(gmail, account.historyId);
    const backfill = await runBackfillTick(gmail, account.backfillStatus, account.backfillPageToken);

    await db.mailAccount.update({
      where: { id: "singleton" },
      data: {
        historyId: newHistoryId,
        lastSyncedAt: new Date(),
        lastSyncError: null,
        backfillStatus: backfill.status,
        backfillPageToken: backfill.pageToken,
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
    tick().catch((error) => console.error("Mail scheduler tick failed:", error));
  }, TICK_INTERVAL_MS);
}
