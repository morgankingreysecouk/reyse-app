import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthorizedGmailClient } from "@/lib/mail/googleClient";

const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authorized = await getAuthorizedGmailClient();
  if (!authorized) return NextResponse.json({ error: "Not connected" }, { status: 409 });

  const { gmail } = authorized;
  const labelId = request.nextUrl.searchParams.get("labelId") || "INBOX";

  const list = await gmail.users.messages.list({
    userId: "me",
    labelIds: [labelId],
    maxResults: PAGE_SIZE,
  });

  const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
  const messages = await Promise.all(
    ids.map(async (id) => {
      const { data } = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From"],
      });
      const headers = data.payload?.headers ?? [];
      return {
        id,
        subject: headers.find((h) => h.name === "Subject")?.value ?? "(no subject)",
        from: headers.find((h) => h.name === "From")?.value ?? "(unknown sender)",
        snippet: data.snippet ?? "",
        date: data.internalDate ? new Date(Number(data.internalDate)).toISOString() : null,
        unread: (data.labelIds ?? []).includes("UNREAD"),
      };
    }),
  );

  messages.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return NextResponse.json({ messages });
}
