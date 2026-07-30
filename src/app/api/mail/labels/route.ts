import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthorizedGmailClient } from "@/lib/mail/googleClient";
import { listFolders } from "@/lib/mail/labels";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authorized = await getAuthorizedGmailClient();
  if (!authorized) return NextResponse.json({ error: "Not connected" }, { status: 409 });

  const folders = await listFolders(authorized.gmail);
  return NextResponse.json({ folders });
}
