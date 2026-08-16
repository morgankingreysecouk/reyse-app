import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAuthorizedGmailClient } from "@/lib/mail/googleClient";
import { deleteFolder, listFolders } from "@/lib/mail/labels";

// One-time (Morgan-triggered) reset: deletes every existing folder Rey can
// see, then restarts the backfill sweep from scratch so the whole mailbox
// gets reclassified into a fresh set of folders built from actual email
// content, rather than whatever Morgan had manually organised before.
// Only removes the labels -- Gmail-level delete never touches the
// underlying messages, so nothing is actually lost, everything just goes
// back to unfiled until the sweep re-files it.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authorized = await getAuthorizedGmailClient();
  if (!authorized) return NextResponse.json({ error: "Not connected" }, { status: 409 });

  const { gmail } = authorized;
  const folders = await listFolders(gmail);
  for (const folder of folders) {
    await deleteFolder(gmail, folder.id, folder.name);
  }

  await db.mailAccount.update({
    where: { id: "singleton" },
    data: { backfillStatus: "NOT_STARTED", backfillPageToken: null },
  });

  return NextResponse.json({ deletedFolders: folders.length });
}
