import type { gmail_v1 } from "googleapis";
import { db } from "@/lib/db";

// Every function here both makes the real Gmail-side change and writes the
// matching MailActivityLog row -- one place, so there's no way to make a
// change here without it showing up in the on-page activity feed.
async function log(
  action: "MESSAGE_FILED" | "MESSAGE_MOVED" | "LABEL_CREATED" | "LABEL_RENAMED" | "LABEL_DELETED" | "SYNC_ERROR",
  summary: string,
) {
  await db.mailActivityLog.create({ data: { action, summary } });
}

export interface Folder {
  id: string;
  name: string;
}

// Gmail's own system labels (INBOX, SENT, TRASH, CATEGORY_*, UNREAD, ...)
// -- never candidates to create/rename/delete/remove, only Morgan's own
// user-created labels (Gmail's "folders") are. Shared between here and
// scheduler.ts so both agree on exactly the same definition of "a folder."
const SYSTEM_LABEL_PREFIXES = [
  "INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "IMPORTANT", "UNREAD", "CHAT", "CATEGORY_",
];

export function isFolderLabel(labelId: string): boolean {
  return !SYSTEM_LABEL_PREFIXES.some((p) => labelId === p || labelId.startsWith(p));
}

// Gmail's own system labels (INBOX, SENT, TRASH, CATEGORY_*, ...) come back
// with type "user" or "system" -- only "user" ones are the real folders
// Morgan can see and rename in Gmail's own UI, so those are the only ones
// Rey creates, renames, or deletes.
export async function listFolders(gmail: gmail_v1.Gmail): Promise<Folder[]> {
  const { data } = await gmail.users.labels.list({ userId: "me" });
  return (data.labels ?? [])
    .filter((label) => label.type === "user" && label.id && label.name)
    .map((label) => ({ id: label.id!, name: label.name! }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFolder(gmail: gmail_v1.Gmail, name: string): Promise<Folder> {
  const { data } = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name, labelListVisibility: "labelShow", messageListVisibility: "show" },
  });
  await log("LABEL_CREATED", `Created folder "${name}"`);
  return { id: data.id!, name: data.name! };
}

export async function renameFolder(gmail: gmail_v1.Gmail, id: string, oldName: string, newName: string): Promise<void> {
  await gmail.users.labels.patch({ userId: "me", id, requestBody: { name: newName } });
  await log("LABEL_RENAMED", `Renamed folder "${oldName}" to "${newName}"`);
}

export async function deleteFolder(gmail: gmail_v1.Gmail, id: string, name: string): Promise<void> {
  // Gmail-level delete only removes the label, never the underlying
  // messages -- they stay in the inbox/wherever else they're labelled, so
  // this is always recoverable by recreating the folder and refiling.
  await gmail.users.labels.delete({ userId: "me", id });
  await log("LABEL_DELETED", `Deleted folder "${name}"`);
}

// Reconciles a message's actual folder membership with where it should be:
// adds whatever's missing, removes whatever user-created folder it's
// sitting in that it shouldn't be any more. This is what makes "take it
// out of one folder and put it in another" real -- fileMessage used to
// only ever add, never remove, which meant a message could pick up
// folders but never actually move between them.
export async function refileMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
  subject: string,
  currentFolders: Folder[],
  targetFolders: Folder[],
  inInbox: boolean,
): Promise<void> {
  const currentIds = new Set(currentFolders.map((f) => f.id));
  const targetIds = new Set(targetFolders.map((f) => f.id));

  const toAdd = targetFolders.filter((f) => !currentIds.has(f.id));
  const toRemove = currentFolders.filter((f) => !targetIds.has(f.id));
  const addLabelIds = toAdd.map((f) => f.id);
  const removeLabelIds = toRemove.map((f) => f.id);

  // Filing into a folder also archives out of the primary inbox view --
  // Gmail's standard "move to folder" behaviour, confirmed with Morgan 31
  // July 2026, not just tagging it. But a message with *no* target folder
  // is the deliberate exception: Morgan's own call (16 August 2026) --
  // something that genuinely needs his direct, urgent action should stay
  // sitting in the main inbox, not get filed away into an "Important"
  // folder where it's easy to lose track of. So the inbox rule flips
  // depending on whether anything's actually being filed: filing archives,
  // not-filing keeps (or puts back) in the inbox. INBOX is a system label,
  // deliberately excluded from currentFolders/targetFolders (see
  // isFolderLabel above), so it can't be picked up by the folder diff
  // above and is handled here instead. Gated on inInbox rather than
  // touched unconditionally so a message already in the right state
  // doesn't get a pointless extra API call every tick.
  if (targetFolders.length > 0) {
    if (inInbox) removeLabelIds.push("INBOX");
  } else if (!inInbox) {
    addLabelIds.push("INBOX");
  }

  if (addLabelIds.length === 0 && removeLabelIds.length === 0) return; // already correct

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  });

  if (targetFolders.length === 0) {
    const fromList = currentFolders.map((f) => `"${f.name}"`).join(", ");
    await log(
      "MESSAGE_MOVED",
      `Kept "${subject}" in the main inbox -- looks like it needs your direct attention${fromList ? ` (moved out of ${fromList})` : ""}`,
    );
    return;
  }

  const targetList = targetFolders.map((f) => `"${f.name}"`).join(", ");
  const folderSetChanged = toAdd.length > 0 || toRemove.length > 0;
  if (currentFolders.length === 0) {
    const suffix = inInbox ? " (archived out of inbox)" : "";
    await log("MESSAGE_FILED", `Filed "${subject}" under ${targetList}${suffix}`);
  } else if (!folderSetChanged) {
    // Very common on the first backfill sweep: mail filed correctly before
    // this feature existed, sitting in the right folder already, but never
    // archived out of the inbox since that behaviour didn't exist yet.
    // Worth its own message -- "moved from Y to Y" would be a confusing
    // way to describe "no folder change, just archived."
    await log("MESSAGE_MOVED", `Archived "${subject}" out of the inbox (already correctly filed under ${targetList})`);
  } else {
    const fromList = currentFolders.map((f) => `"${f.name}"`).join(", ");
    const suffix = inInbox ? ", and archived out of the inbox" : "";
    await log("MESSAGE_MOVED", `Moved "${subject}" from ${fromList} to ${targetList}${suffix}`);
  }
}

export async function logSyncError(message: string): Promise<void> {
  await log("SYNC_ERROR", message);
}
