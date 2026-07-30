import type { gmail_v1 } from "googleapis";
import { db } from "@/lib/db";

// Every function here both makes the real Gmail-side change and writes the
// matching MailActivityLog row -- one place, so there's no way to make a
// change here without it showing up in the on-page activity feed.
async function log(action: "MESSAGE_FILED" | "LABEL_CREATED" | "LABEL_RENAMED" | "LABEL_DELETED" | "SYNC_ERROR", summary: string) {
  await db.mailActivityLog.create({ data: { action, summary } });
}

export interface Folder {
  id: string;
  name: string;
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

export async function fileMessage(
  gmail: gmail_v1.Gmail,
  messageId: string,
  subject: string,
  folderNames: string[],
  labelIds: string[],
): Promise<void> {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: labelIds },
  });
  const folderList = folderNames.map((n) => `"${n}"`).join(", ");
  await log("MESSAGE_FILED", `Filed "${subject}" under ${folderList}`);
}

export async function logSyncError(message: string): Promise<void> {
  await log("SYNC_ERROR", message);
}
